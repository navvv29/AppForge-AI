import { LLMClient, type RunMode } from "../llm/client.js";
import type { ZodType } from "zod";
import {
  AppArchitectureSchemaZod,
  FullAppSchemaZod,
  IntentSchemaZod,
  RepairLogSchema,
  type AppArchitectureSchema,
  type FullAppSchema,
  type IntentSchema,
  type RepairLog,
  type SimulationReport
} from "../schemas/index.js";
import { simulateFullSchema } from "../runtime/simulator.js";
import {
  buildConstrainedRetryInstruction,
  detectLikelyFailureType,
  validateStageOutput
} from "../validation/validator.js";
import { runStage1Intent } from "./stage1-intent.js";
import { runStage2Architect } from "./stage2-architect.js";
import { runStage3Schema } from "./stage3-schema.js";
import { resolveConsistency, runStage4Refine } from "./stage4-refine.js";

type StageName = "stage1" | "stage2" | "stage3" | "stage4";

type StageAttemptResult<T> = {
  data: T;
  provider: string;
  model: string;
  retries: number;
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    latencyMs: number;
    costUsd: number;
  };
};

export interface GenerateOptions {
  mode?: RunMode;
}

export interface GenerationMetrics {
  mode: RunMode;
  provider: string;
  model: string;
  tokensUsed: number;
  latencyMs: number;
  costUsd: number;
}

export interface GenerationResult {
  intent: IntentSchema;
  architecture: AppArchitectureSchema;
  fullAppSchema: FullAppSchema;
  repairLog: RepairLog;
  simulationReport: SimulationReport;
  metrics: GenerationMetrics;
  failed: false;
}

export interface GenerationFailure {
  failed: true;
  failureType: "validation" | "hallucination" | "mismatch" | "ambiguity";
  repairLog: RepairLog;
  message: string;
}

function createInitialRepairLog(): RepairLog {
  return {
    entries: [],
    totalRetries: 0,
    clarificationRequired: []
  };
}

async function executeValidatedStage<T>({
  stageName,
  repairLog,
  execute,
  schema
}: {
  stageName: StageName;
  repairLog: RepairLog;
  execute: (retryInstruction?: string) => Promise<{
    raw: unknown;
    provider: string;
    model: string;
    usage: {
      inputTokens: number;
      outputTokens: number;
      totalTokens: number;
      latencyMs: number;
      costUsd: number;
    };
  }>;
  schema: ZodType<T>;
}): Promise<StageAttemptResult<T> | GenerationFailure> {
  let retries = 0;
  let retryInstruction: string | undefined;
  let provider = "mock";
  let model = "deterministic";
  let usage = { inputTokens: 0, outputTokens: 0, totalTokens: 0, latencyMs: 0, costUsd: 0 };

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const response = await execute(retryInstruction);
    provider = response.provider;
    model = response.model;
    usage = {
      inputTokens: usage.inputTokens + response.usage.inputTokens,
      outputTokens: usage.outputTokens + response.usage.outputTokens,
      totalTokens: usage.totalTokens + response.usage.totalTokens,
      latencyMs: usage.latencyMs + response.usage.latencyMs,
      costUsd: Number((usage.costUsd + response.usage.costUsd).toFixed(6))
    };

    const validated = validateStageOutput(response.raw, schema);
    for (const repair of validated.repairs) {
      repairLog.entries.push({
        stage: "validator",
        issue: `${stageName} emitted invalid/non-normalized output.`,
        fix: repair,
        retries: attempt - 1
      });
    }

    if (validated.success) {
      return {
        data: validated.data,
        provider,
        model,
        retries,
        usage
      };
    }

    if (attempt === 2) {
      const failureType = detectLikelyFailureType(validated.errors);
      const clarification = `${stageName} needs clarification: ${validated.errors.join(" | ")}`;
      repairLog.clarificationRequired.push(clarification);
      repairLog.entries.push({
        stage: stageName,
        issue: `Stage failed validation after 2 attempts.`,
        fix: `Halted stage and requested clarification from user.`,
        retries
      });
      return {
        failed: true,
        failureType,
        repairLog,
        message: clarification
      };
    }

    retries += 1;
    repairLog.totalRetries += 1;
    retryInstruction = buildConstrainedRetryInstruction(validated.errors);
    repairLog.entries.push({
      stage: stageName,
      issue: `Validation failed on attempt ${attempt}.`,
      fix: `Retried ${stageName} with constrained schema-focused prompt.`,
      retries
    });
  }

  return {
    failed: true,
    failureType: "ambiguity",
    repairLog,
    message: "Unexpected stage execution state."
  };
}

function isFailure(result: StageAttemptResult<unknown> | GenerationFailure): result is GenerationFailure {
  return (result as GenerationFailure).failed === true;
}

export async function generateAppConfiguration(
  prompt: string,
  options: GenerateOptions = {}
): Promise<GenerationResult | GenerationFailure> {
  const mode = options.mode ?? "quality";
  const llm = new LLMClient();
  const repairLog = createInitialRepairLog();

  const stage1 = await executeValidatedStage({
    stageName: "stage1",
    repairLog,
    execute: (retryInstruction) => runStage1Intent(prompt, mode, llm, retryInstruction),
    schema: IntentSchemaZod
  });
  if (isFailure(stage1)) {
    return stage1;
  }
  const conflicts = stage1.data.ambiguities.filter((item) => /^conflict:/i.test(item));
  for (const conflict of conflicts) {
    repairLog.entries.push({
      stage: "stage1",
      issue: conflict,
      fix: "Conflicting subsection was constrained and non-conflicting requirements were generated.",
      retries: 0
    });
    repairLog.clarificationRequired.push(conflict);
  }

  const stage2 = await executeValidatedStage({
    stageName: "stage2",
    repairLog,
    execute: (retryInstruction) => runStage2Architect(stage1.data, mode, llm, retryInstruction),
    schema: AppArchitectureSchemaZod
  });
  if (isFailure(stage2)) {
    return stage2;
  }

  const stage3 = await executeValidatedStage({
    stageName: "stage3",
    repairLog,
    execute: (retryInstruction) => runStage3Schema(stage2.data, mode, llm, retryInstruction),
    schema: FullAppSchemaZod
  });
  if (isFailure(stage3)) {
    return stage3;
  }

  const stage4 = await executeValidatedStage({
    stageName: "stage4",
    repairLog,
    execute: (retryInstruction) => runStage4Refine(stage3.data, mode, llm, retryInstruction),
    schema: FullAppSchemaZod
  });
  if (isFailure(stage4)) {
    return stage4;
  }

  const consistency = resolveConsistency(stage4.data);
  for (const entry of consistency.repairs) {
    repairLog.entries.push({
      stage: "stage4",
      issue: entry.issue,
      fix: entry.fix,
      retries: 0
    });
  }

  let fullAppSchema = consistency.schema;
  let simulationReport = simulateFullSchema(fullAppSchema);
  if (!simulationReport.passed && mode === "quality") {
    const secondPass = resolveConsistency(fullAppSchema);
    for (const entry of secondPass.repairs) {
      repairLog.entries.push({
        stage: "stage4",
        issue: entry.issue,
        fix: `${entry.fix} (quality second pass)`,
        retries: 1
      });
    }
    fullAppSchema = secondPass.schema;
    simulationReport = simulateFullSchema(fullAppSchema);
  }
  if (!simulationReport.passed) {
    const unresolved = `Issues: ${simulationReport.issues.join(" | ")}`;
    repairLog.entries.push({
      stage: "simulator",
      issue: "Simulation validator found unresolved issues.",
      fix: unresolved,
      retries: mode === "quality" ? 1 : 0
    });
    if (mode === "quality") {
      repairLog.clarificationRequired.push(`Cross-layer mismatch unresolved: ${simulationReport.issues.join(" | ")}`);
      return {
        failed: true,
        failureType: "mismatch",
        repairLog,
        message: "Quality mode could not resolve all cross-layer mismatches. Clarification is required."
      };
    }
  }

  const metrics: GenerationMetrics = {
    mode,
    provider: stage4.provider,
    model: stage4.model,
    tokensUsed: stage1.usage.totalTokens + stage2.usage.totalTokens + stage3.usage.totalTokens + stage4.usage.totalTokens,
    latencyMs: stage1.usage.latencyMs + stage2.usage.latencyMs + stage3.usage.latencyMs + stage4.usage.latencyMs,
    costUsd: Number(
      (
        stage1.usage.costUsd +
        stage2.usage.costUsd +
        stage3.usage.costUsd +
        stage4.usage.costUsd
      ).toFixed(6)
    )
  };

  const parsedRepairLog = RepairLogSchema.parse(repairLog);

  return {
    failed: false,
    intent: stage1.data,
    architecture: stage2.data,
    fullAppSchema,
    repairLog: parsedRepairLog,
    simulationReport,
    metrics
  };
}
