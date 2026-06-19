import { useState, type CSSProperties } from "react";

type Speaker = "optimist" | "skeptic";

type DebateEvent =
  | { type: "speaker"; speaker: Speaker }
  | { type: "token"; speaker: Speaker; text: string }
  | { type: "done" };

type Message = { speaker: Speaker; text: string };

export default function App() {
  const [topic, setTopic] = useState("Is remote work good for society?");
  const [messages, setMessages] = useState<Message[]>([]);
  const [typing, setTyping] = useState<Speaker | null>(null);
  const [running, setRunning] = useState(false);

  function startDebate() {
    setMessages([]);
    setTyping(null);
    setRunning(true);

    const es = new EventSource(`/debate?topic=${encodeURIComponent(topic)}`);

    es.onmessage = (e) => {
      const event: DebateEvent = JSON.parse(e.data);

      if (event.type === "speaker") {
        setTyping(event.speaker);
      } else if (event.type === "token") {
        setTyping(null);
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.speaker === event.speaker) {
            return [...prev.slice(0, -1), { ...last, text: last.text + event.text }];
          }
          return [...prev, { speaker: event.speaker, text: event.text }];
        });
      } else if (event.type === "done") {
        setTyping(null);
        setRunning(false);
        es.close();
      }
    };

    es.onerror = () => {
      setTyping(null);
      setRunning(false);
      es.close();
    };
  }

  function bubbleStyle(isOptimist: boolean): CSSProperties {
    return {
      alignSelf: isOptimist ? "flex-start" : "flex-end",
      maxWidth: "75%",
      background: isOptimist ? "#e7f0ff" : "#e9ffe7",
      color: "#111",
      padding: "0.6rem 0.9rem",
      borderRadius: "1rem",
    };
  }

  return (
    <div style={{ fontFamily: "system-ui", padding: "1.5rem", maxWidth: 640, margin: "0 auto" }}>
      <h1>Two Minds</h1>

      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
        <input
          style={{ flex: 1, padding: "0.5rem" }}
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
        />
        <button onClick={startDebate} disabled={running}>
          {running ? "Debating…" : "Start debate"}
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {messages.map((m, i) => {
          const isOptimist = m.speaker === "optimist";
          return (
            <div key={i} style={bubbleStyle(isOptimist)}>
              <div style={{ fontSize: "0.8rem", opacity: 0.6, marginBottom: "0.2rem" }}>
                {isOptimist ? "🌞 Optimist" : "🌧️ Skeptic"}
              </div>
              <div style={{ whiteSpace: "pre-wrap" }}>{m.text}</div>
            </div>
          );
        })}

        {typing && (
          <div style={{ ...bubbleStyle(typing === "optimist"), opacity: 0.6, fontStyle: "italic" }}>
            {typing === "optimist" ? "🌞 Optimist" : "🌧️ Skeptic"} is writing…
          </div>
        )}
      </div>
    </div>
  );
}
