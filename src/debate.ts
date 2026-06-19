import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type Speaker = "optimist" | "skeptic";

export type DebateEvent =
  | { type: "speaker"; speaker: Speaker }
  | { type: "token"; speaker: Speaker; text: string }
  | { type: "done" };

async function ask(
  system: string,
  messages: Anthropic.MessageParam[],
  onToken: (text: string) => void,
) {
  const stream = client.messages.stream({
    model: "claude-opus-4-8",
    max_tokens: 1024,
    system,
    messages,
  });

  stream.on("text", (textDelta) => onToken(textDelta));

  const finalMessage = await stream.finalMessage();
  return finalMessage;
}

export async function runDebate(
  topic: string,
  onEvent: (event: DebateEvent) => void,
) {
  const optimist =
    "You are a relentless optimist about technology. Respond directly to the other speaker in 2-3 conversational sentences. No lists.";
  const skeptic =
    "You are a sharp technology skeptic. Respond directly to the other speaker in 2-3 conversational sentences. No lists.";

  const optimistView: Anthropic.MessageParam[] = [];
  const skepticView: Anthropic.MessageParam[] = [];

  optimistView.push({ role: "user", content: topic });

  for (let round = 0; round < 3; round++) {
    onEvent({ type: "speaker", speaker: "optimist" });
    await sleep(1500);
    const o = await ask(optimist, optimistView, (text) =>
      onEvent({ type: "token", speaker: "optimist", text }),
    );
    optimistView.push({ role: "assistant", content: o.content });
    skepticView.push({ role: "user", content: o.content });

    onEvent({ type: "speaker", speaker: "skeptic" });
    await sleep(1500);
    const s = await ask(skeptic, skepticView, (text) =>
      onEvent({ type: "token", speaker: "skeptic", text }),
    );
    skepticView.push({ role: "assistant", content: s.content });
    optimistView.push({ role: "user", content: s.content });
  }

  onEvent({ type: "done" });
}
