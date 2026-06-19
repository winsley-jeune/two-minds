 import { runDebate, type DebateEvent } from "./debate";                                                                                                                                                                                                                      
  function printEvent(event: DebateEvent) {
    if (event.type === "speaker") {
      const label = event.speaker === "optimist" ? "🌞 OPTIMIST" : "🌧️ SKEPTIC";
      process.stdout.write(`\n\n${label}: `);
    } else if (event.type === "token") {
      process.stdout.write(event.text);
    } else if (event.type === "done") {
      process.stdout.write("\n\n[debate complete]\n");
    }
  }

  runDebate("Is remote work good for society?", printEvent);
