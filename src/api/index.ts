import "dotenv/config";
import cors from "cors";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getAIProviderStatus } from "../llm/client.js";
import { generateAppConfiguration } from "../pipeline/generator.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.resolve(__dirname, "../../public");
app.use(express.static(publicDir));

app.get("/health", (_req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

app.get("/ai-status", (_req, res) => {
  res.json(getAIProviderStatus());
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
      ai: getAIProviderStatus(),
      fullAppSchema: result.fullAppSchema,
      repairLog: result.repairLog,
      simulationReport: result.simulationReport,
      metrics: result.metrics
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const isRateLimited = /rate limit|429/i.test(message);
    res.status(isRateLimited ? 429 : 500).json({
      error: isRateLimited ? "rate_limited" : "generation_failed",
      message
    });
  }
});

app.post("/eval/single", async (req, res) => {
  const prompt = typeof req.body?.prompt === "string" ? req.body.prompt.trim() : "";
  if (!prompt) {
    res.status(400).json({ error: "prompt is required" });
    return;
  }

  try {
    const fastResult = await generateAppConfiguration(prompt, { mode: "fast" });
    const qualityResult = await generateAppConfiguration(prompt, { mode: "quality" });

    res.json({
      prompt,
      fast: {
        success: !fastResult.failed && (!fastResult.failed && fastResult.simulationReport.passed),
        retries: fastResult.repairLog?.totalRetries ?? 0,
        repairs: fastResult.repairLog?.entries?.length ?? 0,
        tokensUsed: fastResult.failed ? 0 : fastResult.metrics.tokensUsed,
        latencyMs: fastResult.failed ? 0 : fastResult.metrics.latencyMs,
        costUsd: fastResult.failed ? 0 : fastResult.metrics.costUsd,
        failureType: fastResult.failed ? fastResult.failureType : null
      },
      quality: {
        success: !qualityResult.failed && (!qualityResult.failed && qualityResult.simulationReport.passed),
        retries: qualityResult.repairLog?.totalRetries ?? 0,
        repairs: qualityResult.repairLog?.entries?.length ?? 0,
        tokensUsed: qualityResult.failed ? 0 : qualityResult.metrics.tokensUsed,
        latencyMs: qualityResult.failed ? 0 : qualityResult.metrics.latencyMs,
        costUsd: qualityResult.failed ? 0 : qualityResult.metrics.costUsd,
        failureType: qualityResult.failed ? qualityResult.failureType : null
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: "eval_failed", message });
  }
});

app.get(/.*/, (_req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => {
  console.log(`API server running on http://localhost:${port}`);
});
