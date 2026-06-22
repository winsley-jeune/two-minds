# Two Minds — Theory & Concepts

A deep, code-free walkthrough of every concept used to build this project — the *why* and the mental models, not the syntax. Organized from the AI core outward to the engineering, because the LLM concepts are what the whole thing is built on.

---

## Layer 1 — What an LLM call actually is

### 1. The model runs elsewhere; you talk to it over HTTP
Claude runs on Anthropic's servers, not your machine. "Using Claude" is a **client–server interaction** like a browser hitting a website: you send a **request** (JSON, over HTTPS, to `POST /v1/messages`) with your API key, and get a **response** (JSON with the reply) back. Streaming, agents, RAG — all variations on this one request/response.

**Mental model:** an LLM is a *function over the network*. Input: a conversation. Output: the next message. Stateless, like an HTTP endpoint — not like a chat app with memory.

### 2. The SDK is a wrapper, not magic
`@anthropic-ai/sdk` doesn't contain Claude. It builds the HTTP request for you — auth header, JSON serialization, response parsing, retries, streaming. You could do it with raw `fetch`; the SDK removes boilerplate and adds types. Knowing it's "just HTTP underneath" is what lets you debug it (our 404 was a plain HTTP 404 the SDK surfaced).

### 3. The three required ingredients
- **`model`** — which Claude (`claude-opus-4-8`). Wrong string → 404 (the `clude` typo).
- **`max_tokens`** — the **maximum reply length**. Required. A cap; the model stops there even mid-sentence (`stop_reason: "max_tokens"`).
- **`messages`** — the conversation so far, an **array** of `{ role, content }`.

### 4. Tokens — the unit of everything
A **token** is a chunk of text (~¾ of a word). The model reads and writes in tokens. It matters for:
- **`max_tokens`** is measured in them.
- **Billing** is per-token, and input vs output are priced differently (`usage: { input_tokens, output_tokens }` is the meter).
- **Context window** (how much the model can see at once) is measured in tokens — now ~1M for Opus, which is why the 2023 obsession with "token budgeting" faded.

**Mental model:** tokens are the model's currency *and* its field of vision.

### 5. `stop_reason` — why it stopped
`end_turn` (finished naturally), `max_tokens` (hit your cap — output truncated), `tool_use` (wants a tool — Month 3), `refusal` (declined for safety). Production code branches on this. We only saw `end_turn`, but the others are the unhappy paths you eventually handle.

---

## Layer 2 — Conversation modeling (the heart of Two Minds)

### 6. Roles, and why they're *relative*
A conversation is `user` ↔ `assistant`. The deep insight: **the model you're calling is always the `assistant`, and everything it responds to is `user`.** Roles aren't identities — they're *seats relative to whoever's generating right now*. This is the entire basis of the role-flip (#11).

### 7. `content` is an array of typed blocks
The reply isn't a plain string — `content` is an **array** of **typed blocks** (`{ type: "text", text }`). Why? A reply can mix kinds — text, tool calls, thinking. The API hands you a structured list so you pull out the piece you want. That's why we looped and checked `block.type` instead of grabbing `content[0].text`. Forward-compatible: enable a feature, a new block type appears, you add a branch.

### 8. The API is **stateless** — "memory" is an illusion you maintain
The single most important concept in the roadmap. **Anthropic stores nothing between calls.** A chatbot "remembers" only because *you* keep the full transcript and **resend the entire history every call**. We proved it: send history → it knows your name; send only the question → blank stare. "Memory" = an array you choose to resend. Every stateful-feeling AI app does this; later, *managing* that growing array (compaction, context windows) is its own discipline.

### 9. System prompts — the persona channel
The `system` field is **separate from `messages`** — the character sheet for the whole conversation. In Two Minds, the *entire* difference between optimist and skeptic was **one `system` string each**: same model, same question, opposite voice. Two points:
- **`system` ≠ a user message.** Higher authority, set once.
- **It doesn't overwrite trained-in behavior.** Safety/values live in the **weights** (the trained actor); `system` is the **script** you hand that actor. There's no hidden Anthropic prompt under yours at the API. You direct your own calls; you can change the script, never the actor's core.

### 10. Why instructions get ignored
Models weight **recent** tokens heavily, so an early instruction gets *outvoted* by newer context; and **placement = authority** (`system` > a buried `user` message). The fix: re-assert, recently and forcefully. This is *why* personas belong in `system`, and why mid-conversation system messages exist — to re-inject authority without losing cached history.

### 11. The role-flip / dual histories
Two personas, **one shared exchange**, but **each sees it from its own seat**. So we keep **two separate `messages` arrays** and **cross-post each line into both with flipped roles**: a speaker's own line is `assistant` in their view and `user` in the opponent's. That mirroring is what makes them genuinely respond to each other. It's **multi-agent conversation modeling** in miniature — "just two histories and a role flip."

---

## Layer 3 — Streaming & the network

### 12. Streaming — receiving the answer *as it's produced*
`messages.create()` waits for the whole reply; `messages.stream()` returns immediately and emits **deltas** as the model generates them. The model doesn't change — you read it live. Matters for UX (no frozen screen) and, here, *is* the demo (bubbles typing themselves).

### 13. SSE — the mechanism underneath
Streaming arrives via **Server-Sent Events**: an HTTP connection held open, the server pushing `data: ...\n\n` events over time. Raw sequence: `message_start → content_block_delta (×many) → content_block_stop → message_delta → message_stop`. `stream.on("text", …)` just filters the text deltas; `finalMessage()` gives the complete assembled message (for history, `stop_reason`, usage). SSE reappears as *your server's* protocol to the browser — same mechanism, one more hop.

### 14. The client–server security boundary
**The API key must never reach the browser** (browser code is fully visible). Mandatory shape: **Browser → your server (holds the key) → Anthropic**. This is *the* reason a web LLM app needs a backend. Express holds the key and re-streams; React never sees it. (Same boundary as gitignoring `.env` — the secret stays out of source control.)

### 15. SSE end-to-end + `EventSource`
The server *receives* SSE from Anthropic and *re-emits* SSE to the browser. The browser's built-in **`EventSource`** opens the connection (GET only — why the route is GET and the topic rides in the query string), auto-parses each `data:` payload, fires `onmessage`. Two footguns: it **decodes UTF-8 by spec** (the charset/mojibake lesson — declare encoding), and it **auto-reconnects** (so you *must* `es.close()` on `done`, or it restarts the whole debate forever).

### 16. CORS & the dev proxy
Browser (Vite :5173) and API (Express :3001) are **different origins**; browsers block cross-origin by default (CORS). Fixes: enable CORS, or **proxy** `/debate` through Vite so the browser sees same-origin. We proxied — cleaner, and mirrors a real deploy (one origin).

---

## Layer 4 — Engineering & language foundations

### 17. Separation of concerns (engine vs transport)
The pivotal refactor: the engine (`debate.ts`) doesn't print or write HTTP — it **emits structured events** (`DebateEvent`) through a callback. The CLI and the server are **interchangeable consumers**. Same engine fed a terminal *and* a browser with zero changes. *Logic shouldn't know about its output medium.*

### 18. Premature abstraction / extract-on-second-use
We only extracted when a **second consumer** appeared (`ask` for both personas; `bubbleStyle` for real + typing bubbles; `debate.ts` for CLI + server). Principle: **structure matches what exists now, refactored the moment a real reason appears.** Speculative modules and empty placeholders are over-engineering. "Professional" ≠ maximally layered.

### 19. Discriminated unions & narrowing (TypeScript)
`DebateEvent` is a **discriminated union**: shapes sharing a `type` field, where other fields depend on `type`. `if (event.type === "token")` **narrows** it — inside, TS knows `event.text` exists. Same pattern as the SDK's content blocks. Core TS mental model: *check the discriminant, then the compiler grants the type-specific fields.*

### 20. Callbacks / higher-order functions
`onToken`, `onEvent`, `printEvent` — functions passed as arguments. The engine doesn't know *what* happens per token; the caller supplies it. This is what makes the engine reusable (#17 rests on it), and it's the same idea as React event handlers and `.map`.

### 21. Promises, async/await, the `sleep` idiom
A network call returns a **Promise** (a placeholder for a future value); `await` pauses until it resolves. `sleep` = `setTimeout` wrapped in a Promise so `await sleep(1500)` pauses — and because the pause is in the engine/server, it paces the event stream, making the "is writing…" beat visible. **Pacing is a server concern; the indicator is a client concern.**

### 22. React state, immutability, and the StrictMode trap
State must be **immutable** — always return *new* arrays/objects (`[...prev, x]`, `{ ...last, text: … }`), never mutate. Reasons: React detects change by reference; and **StrictMode runs the updater twice in dev** to catch impurity — a mutating updater would double tokens. Plus **functional updates** (`setX(prev => …)`) to avoid stale closures when updates fire dozens of times a second. This cluster is where most React-with-streaming bugs live.

### 23. The toolchain truths
- **ESM vs CommonJS** — `import`/`export` (modern) vs `require` (legacy), enabled by `"type": "module"`.
- **`tsx` transpiles, `tsc` type-checks** — we felt the gap: `tsx` ran code with a type error (wrong arg count), because it strips types without checking. That's why the bug reached runtime, and why a real type-check step matters.
- **`dependencies` vs `devDependencies`** — needed-to-run vs needed-to-build. **Semver `^`** — accept compatible updates, not breaking ones.
- **Secrets via env vars** — code references the *name*; the *value* lives in gitignored `.env`. The endpoint owner owns the plaintext (TLS protects against the network, not the endpoint owner).

---

## The through-line

Almost everything reduces to a few ideas repeated at different layers:

- **Stateless + you resend context** — the API, and the whole "memory" story.
- **Typed unions + narrowing** — content blocks, `DebateEvent`.
- **Streams of events over an open connection** — Anthropic→server, server→browser (SSE both times).
- **Separation of concerns / decoupling** — engine vs transport, persona-in-`system` vs topic-in-`messages`, pacing-server vs indicator-client.
- **Build for now, abstract on real need.**

If you can teach *those five* to someone else, you understand Month 1 — not just that it ran.

---

## The 2023 → 2026 shifts this project demonstrates

| Concept | The 2023 way | What Two Minds uses (2026) |
|---|---|---|
| Reasoning steering | `temperature` / "think step by step" hacks | Plain literal system prompts; `temperature` is removed on the latest models |
| Personas | "act like X" in the user message | A dedicated `system` prompt per persona (higher-authority channel) |
| "Memory" | Assume the model remembers | Stateless API; app resends full history every call |
| Live output | Wait for the whole reply | Streaming via the SDK, re-streamed to the browser over SSE |
| Architecture | One script that does everything | Separation of concerns — engine emits events; CLI and server are interchangeable transports |

---

*Part of a hands-on journey from beginner to AI application engineer — Month 1.*
