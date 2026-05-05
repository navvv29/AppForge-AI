import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { generateAppConfiguration } from "../pipeline/generator.js";
import { deriveFailureTypeFromRepairs, toMarkdownTable, type EvalResult } from "./metrics.js";
import { sampleComparisonPrompts, suiteAPrompts, suiteBPrompts } from "./test-prompts.js";

async function runSuite(prompts: string[], suite: "A" | "B"): Promise<EvalResult[]> {
  const rows: EvalResult[] = [];
  for (const prompt of prompts) {
    const result = await generateAppConfiguration(prompt, { mode: "quality" });
    if (result.failed) {
      rows.push({
        prompt,
        suite,
        success: false,
        retries: result.repairLog.totalRetries,
        repairsApplied: result.repairLog.entries.map((entry) => entry.fix),
        failureType: result.failureType,
        latencyMs: 0,
        tokensUsed: 0,
        costUsd: 0
      });
      continue;
    }

    rows.push({
      prompt,
      suite,
      success: result.simulationReport.passed,
      retries: result.repairLog.totalRetries,
      repairsApplied: result.repairLog.entries.map((entry) => entry.fix),
      failureType: result.simulationReport.passed
        ? null
        : deriveFailureTypeFromRepairs(result.repairLog.entries.map((entry) => entry.fix)) ?? "mismatch",
      latencyMs: result.metrics.latencyMs,
      tokensUsed: result.metrics.tokensUsed,
      costUsd: result.metrics.costUsd
    });
  }
  return rows;
}

async function runModeComparison(prompts: string[]) {
  const rows: Array<{
    prompt: string;
    fastSuccess: boolean;
    qualitySuccess: boolean;
    fastTokens: number;
    qualityTokens: number;
    fastCostUsd: number;
    qualityCostUsd: number;
  }> = [];

  for (const prompt of prompts) {
    const fast = await generateAppConfiguration(prompt, { mode: "fast" });
    const quality = await generateAppConfiguration(prompt, { mode: "quality" });

    rows.push({
      prompt,
      fastSuccess: !fast.failed && fast.simulationReport.passed,
      qualitySuccess: !quality.failed && quality.simulationReport.passed,
      fastTokens: fast.failed ? 0 : fast.metrics.tokensUsed,
      qualityTokens: quality.failed ? 0 : quality.metrics.tokensUsed,
      fastCostUsd: fast.failed ? 0 : fast.metrics.costUsd,
      qualityCostUsd: quality.failed ? 0 : quality.metrics.costUsd
    });
  }

  const header =
    "| Prompt | Fast Success | Quality Success | Fast Tokens | Quality Tokens | Fast Cost(USD) | Quality Cost(USD) |\n" +
    "| --- | --- | --- | --- | --- | --- | --- |";
  const body = rows
    .map(
      (row) =>
        `| ${row.prompt.replace(/\|/g, "\\|")} | ${row.fastSuccess} | ${row.qualitySuccess} | ${row.fastTokens} | ${row.qualityTokens} | ${row.fastCostUsd.toFixed(6)} | ${row.qualityCostUsd.toFixed(6)} |`
    )
    .join("\n");

  return { rows, markdown: `${header}\n${body}` };
}

async function main(): Promise<void> {
  const suiteAResults = await runSuite(suiteAPrompts, "A");
  const suiteBResults = await runSuite(suiteBPrompts, "B");
  const allResults = [...suiteAResults, ...suiteBResults];
  const comparison = await runModeComparison(sampleComparisonPrompts);

  const markdownTable = toMarkdownTable(allResults);
  console.log("\n## Evaluation Results\n");
  console.log(markdownTable);
  console.log("\n## Fast vs Quality Comparison\n");
  console.log(comparison.markdown);

  const outputDir = path.resolve(process.cwd(), "eval-output");
  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(
    path.join(outputDir, "metrics.json"),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        results: allResults,
        comparison: comparison.rows
      },
      null,
      2
    ),
    "utf8"
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
