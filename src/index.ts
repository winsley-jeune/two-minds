import "dotenv/config.js";
import Anthropic from "@anthropic-ai/sdk";
const client = new Anthropic();

async function ask(system: string , messages: Anthropic.MessageParam[]){
    const stream =client.messages.stream({
        model:"claude-opus-4-7",
        max_tokens:1024,
        system,
        messages
    })

    stream.on("text", (textDelta)=> process.stdout.write(textDelta));
    const finalMessage = await stream.finalMessage();
    process.stdout.write("\n");
    return finalMessage;

}


  async function main() {
    const optimist =
      "You are a relentless optimist about technology. Respond directly to the other speaker in 2-3 conversational sentences. No lists.";
    const skeptic =
      "You are a sharp technology skeptic. Respond directly to the other speaker in 2-3 conversational sentences. No lists.";

    const topic = "Is remote work good for society?";

    const optimistView: Anthropic.MessageParam[] = [];
    const skepticView: Anthropic.MessageParam[] = [];

    // Kick-off: the topic is the opening prompt the optimist answers first.
    optimistView.push({ role: "user", content: topic });

    for (let round = 0; round < 3; round++) {
      process.stdout.write("\n🌞 OPTIMIST: ");
      const o = await ask(optimist, optimistView);
      optimistView.push({ role: "assistant", content: o.content }); // its own line
      skepticView.push({ role: "user", content: o.content });        // opponent's line

      process.stdout.write("\n🌧️ SKEPTIC: ");
      const s = await ask(skeptic, skepticView);
      skepticView.push({ role: "assistant", content: s.content });
      optimistView.push({ role: "user", content: s.content });
    }
  }
  main();