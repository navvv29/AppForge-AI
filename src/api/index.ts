import "dotenv/config";
import cors from "cors";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateAppConfiguration } from "../pipeline/generator.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.resolve(__dirname, "../../public");
app.use(express.static(publicDir));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/generate", async (req, res) => {
  const prompt = typeof req.body?.prompt === "string" ? req.body.prompt.trim() : "";
  const mode = req.body?.mode === "fast" ? "fast" : "quality";

  if (!prompt) {
    res.status(400).json({ error: "prompt is required" });
    return;
  }

  try {
    const result = await generateAppConfiguration(prompt, { mode });
    if (result.failed) {
      res.status(422).json({
        error: "clarification_required",
        failureType: result.failureType,
        message: result.message,
        repairLog: result.repairLog
      });
      return;
    }

    res.json({
      mode,
      fullAppSchema: result.fullAppSchema,
      repairLog: result.repairLog,
      simulationReport: result.simulationReport,
      metrics: result.metrics
    });
  } catch (error) {
    res.status(500).json({
      error: "generation_failed",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

app.get(/.*/, (_req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => {
  console.log(`API server running on http://localhost:${port}`);
});
