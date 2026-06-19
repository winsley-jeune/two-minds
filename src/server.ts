 import express from "express";
  import { runDebate } from "./debate";

  const app = express();

  app.get("/debate", async (req, res) => {
    const topic = String(req.query.topic ?? "Is remote work good for society?");

    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    await runDebate(topic, (event) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    });

    res.end();
  });

  const PORT = 3001;
  app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });
