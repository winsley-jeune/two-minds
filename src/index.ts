import "dotenv/config.js";
import Anthropic from "@anthropic-ai/sdk";
const client = new Anthropic();

async function main() {
    const stream = client.messages.stream({
      model: "claude-opus-4-8",
      max_tokens: 1024,
      messages: [
        { role: "user", content: "In three sentences, what makes a debate interesting?" },
      ],
    });

    stream.on("text", (textDelta) => {
      process.stdout.write(textDelta);
    });

    await stream.finalMessage();
    process.stdout.write("\n");
  }
  main();
