import type { FailureType } from "../schemas/repair.schema.js";

export interface EvalResult {
  prompt: string;
  suite: "A" | "B";
  success: boolean;
  retries: number;
  repairsApplied: string[];
  failureType: FailureType | null;
  latencyMs: number;
  tokensUsed: number;
  costUsd: number;
}

export function toMarkdownTable(rows: EvalResult[]): string {
  const header =
    "| Suite | Prompt | Success | Retries | Repairs | Failure | Tokens | Latency(ms) | Cost(USD) |\n" +
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- |";
  const body = rows
    .map((row) => {
      const repairsSummary =
        row.repairsApplied.length === 0
          ? "0"
          : `${row.repairsApplied.length} (${row.repairsApplied.slice(0, 2).join("; ").replace(/\|/g, "\\|")})`;
      return `| ${row.suite} | ${row.prompt.replace(/\|/g, "\\|")} | ${row.success} | ${row.retries} | ${repairsSummary} | ${row.failureType ?? ""} | ${row.tokensUsed} | ${row.latencyMs} | ${row.costUsd.toFixed(6)} |`;
    })
    .join("\n");
  return `${header}\n${body}`;
}

export function deriveFailureTypeFromRepairs(repairs: string[]): FailureType | null {
  const joined = repairs.join(" ").toLowerCase();
  if (!joined) return null;
  if (joined.includes("clarification") || joined.includes("conflict")) return "ambiguity";
  if (joined.includes("missing endpoint") || joined.includes("missing db") || joined.includes("unknown role")) return "mismatch";
  if (joined.includes("normalized field type")) return "hallucination";
  if (joined.includes("validation")) return "validation";
  return null;
}
