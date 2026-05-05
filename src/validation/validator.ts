import { z } from "zod";
import { normalizeFieldTypesInObject, repairJsonText } from "./repair.js";

export type ValidationResult<T> =
  | {
      success: true;
      data: T;
      errors: [];
      repairs: string[];
    }
  | {
      success: false;
      data: null;
      errors: string[];
      repairs: string[];
    };

function parseRawInput(raw: unknown): { value: unknown; repairs: string[]; parseError?: string } {
  if (typeof raw !== "string") {
    return { value: raw, repairs: [] };
  }

  try {
    return { value: JSON.parse(raw), repairs: [] };
  } catch {
    const repaired = repairJsonText(raw);
    try {
      return { value: JSON.parse(repaired.repaired), repairs: repaired.fixes };
    } catch (finalError) {
      return {
        value: null,
        repairs: repaired.fixes,
        parseError: finalError instanceof Error ? finalError.message : "Invalid JSON output."
      };
    }
  }
}

export function validateStageOutput<T>(raw: unknown, schema: z.ZodType<T>): ValidationResult<T> {
  const parsed = parseRawInput(raw);
  if (parsed.parseError) {
    return {
      success: false,
      data: null,
      errors: [`Invalid JSON: ${parsed.parseError}`],
      repairs: parsed.repairs
    };
  }

  const normalized = normalizeFieldTypesInObject(parsed.value);
  const result = schema.safeParse(normalized.normalized);
  if (!result.success) {
    const errors = result.error.issues.map((issue) => {
      const path = issue.path.length ? issue.path.join(".") : "<root>";
      return `${path}: ${issue.message}`;
    });
    return {
      success: false,
      data: null,
      errors,
      repairs: [...parsed.repairs, ...normalized.fixes]
    };
  }

  return {
    success: true,
    data: result.data,
    errors: [],
    repairs: [...parsed.repairs, ...normalized.fixes]
  };
}

export function buildConstrainedRetryInstruction(errors: string[]): string {
  return [
    "Your previous output failed strict validation.",
    "Return JSON only with no prose or markdown.",
    "Fix these exact errors:",
    ...errors.map((error) => `- ${error}`)
  ].join("\n");
}

export function detectLikelyFailureType(errors: string[]): "validation" | "hallucination" | "mismatch" | "ambiguity" {
  const joined = errors.join(" ").toLowerCase();
  if (joined.includes("invalid json") || joined.includes("required")) {
    return "validation";
  }
  if (joined.includes("type") || joined.includes("enum")) {
    return "hallucination";
  }
  if (joined.includes("route") || joined.includes("role") || joined.includes("field")) {
    return "mismatch";
  }
  return "ambiguity";
}
