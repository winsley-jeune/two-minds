# Two Minds 🌞🌧️

Two AI personas — a relentless optimist and a sharp skeptic — **debate any topic you give them, live**, streaming token-by-token into a Messenger-style chat thread. Each persona genuinely responds to the other; the argument actually evolves.

Built with the **Anthropic SDK** (Claude), **Express + Server-Sent Events** for live streaming, and a **React (Vite)** frontend.

> _Demo:_ <!-- TODO: drop a screen-recording GIF here -->
> `![Two Minds demo](docs/demo.gif)`

---

## How it works

```
Browser (React)  ──EventSource("/debate")──►  Vite dev proxy  ──►  Express (:3001)
      ▲                                                                  │
      └──────────────  SSE: speaker / token / done events  ◄────────────┘
                                                                         │
                                                          Anthropic API (Claude)
```

- **`src/debate.ts` — the engine.** Runs the alternating debate and *emits transport-agnostic events* (`speaker`, `token`, `done`) through a callback. It knows nothing about terminals or browsers. Each persona is just a different **system prompt**, and the conversation is maintained as two role-flipped message histories (each persona sees its own lines as `assistant`, the other's as `user`).
- **`src/server.ts` — the transport.** An Express endpoint (`GET /debate?topic=...`) that runs the engine and re-streams each event to the browser as **SSE** (`data: {json}\n\n`). The Anthropic API key stays here, server-side — it never reaches the browser.
- **`src/index.ts` — a CLI consumer** of the same engine (prints the debate to the terminal), proving the engine is decoupled from how it's displayed.
- **`client/` — the React app.** Opens an `EventSource`, parses each event, and renders a live chat thread with a typing indicator.

## Run it locally

**Prerequisites:** Node 18+ and an [Anthropic API key](https://console.anthropic.com/).

```bash
# 1. Backend deps + API key
npm install
cp .env.example .env          # then paste your key into .env

# 2. Frontend deps
cd client && npm install && cd ..
```

Then run the two processes in separate terminals:

```bash
# Terminal 1 — Express SSE server (auto-reloads)
npm run server

# Terminal 2 — React dev server
cd client && npm run dev
```

Open the Vite URL (usually `http://localhost:5173`), type a topic, and hit **Start debate**.

Prefer the terminal? `npm run cli` runs the same debate straight to stdout.

## What I learned (2023 → 2026)

This is Month 1 of an AI-engineering roadmap, built to surface how the practice has shifted:

| Concept | The 2023 way | What this project uses (2026) |
|---|---|---|
| Reasoning steering | `temperature` / "think step by step" prompt hacks | Plain, literal system prompts (newer models follow them closely — aggressive prompts *over*trigger; `temperature` is removed on the latest models) |
| Personas | Cramming "act like X" into the user message | A dedicated `system` prompt per persona — the reliable, higher-authority channel |
| "Memory" | Assuming the model remembers | The API is **stateless**; the app maintains and resends the full message history every call |
| Live output | Wait for the whole reply | **Streaming** via the SDK's token stream, re-streamed to the browser over **SSE** |
| Architecture | One script that does everything | **Separation of concerns** — engine emits events; CLI and server are interchangeable transports |

## Known limitations / next

- **No cancel-on-disconnect.** If the browser tab closes mid-debate, the server keeps generating (and billing) tokens. Proper fix: thread an `AbortController` through the engine. _(Production-hardening, slated for later in the roadmap.)_
- Debate length and personas are hard-coded — easy to parameterize next.

---

*Part of a hands-on journey from beginner to AI application engineer.*
