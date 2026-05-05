import type { FieldType } from "../schemas/architecture.schema.js";

const FIELD_TYPE_MAP: Record<string, FieldType> = {
  id: "id",
  uuid: "id",
  string: "string",
  varchar: "string",
  char: "string",
  text: "text",
  int: "integer",
  integer: "integer",
  bigint: "integer",
  number: "number",
  decimal: "number",
  numeric: "number",
  float: "float",
  double: "float",
  boolean: "boolean",
  bool: "boolean",
  date: "date",
  datetime: "datetime",
  timestamp: "datetime",
  json: "json",
  object: "json",
  enum: "enum"
};

const FALLBACK_FIELD_TYPE: FieldType = "string";

function stripCodeFences(text: string): string {
  return text
    .replace(/```json/gi, "```")
    .replace(/```/g, "")
    .trim();
}

function findBalancedJson(text: string, openChar: "{" | "[", closeChar: "}" | "]"): string | null {
  const start = text.indexOf(openChar);
  if (start < 0) {
    return null;
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < text.length; index += 1) {
    const char = text[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") {
      inString = true;
      continue;
    }
    if (char === openChar) {
      depth += 1;
      continue;
    }
    if (char === closeChar) {
      depth -= 1;
      if (depth === 0) {
        return text.slice(start, index + 1);
      }
    }
  }

  return null;
}

function clampToJsonObject(text: string): string {
  const objectStart = text.indexOf("{");
  const arrayStart = text.indexOf("[");

  if (objectStart >= 0 && (arrayStart < 0 || objectStart < arrayStart)) {
    return findBalancedJson(text, "{", "}") ?? text;
  }

  if (arrayStart >= 0) {
    return findBalancedJson(text, "[", "]") ?? text;
  }

  return text;
}

export function repairJsonText(raw: string): { repaired: string; fixes: string[] } {
  const fixes: string[] = [];
  let repaired = stripCodeFences(raw);
  if (repaired !== raw) {
    fixes.push("Removed markdown code fences.");
  }

  const clamped = clampToJsonObject(repaired);
  if (clamped !== repaired) {
    repaired = clamped;
    fixes.push("Trimmed non-JSON prefix/suffix.");
  }

  const smartQuotesFixed = repaired
    .replace(/[“”]/g, "\"")
    .replace(/[‘’]/g, "'");
  if (smartQuotesFixed !== repaired) {
    repaired = smartQuotesFixed;
    fixes.push("Replaced smart quotes.");
  }

  const singleToDouble = repaired.replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, "\"$1\"");
  if (singleToDouble !== repaired) {
    repaired = singleToDouble;
    fixes.push("Converted single-quoted strings to double quotes.");
  }

  const trailingCommaFixed = repaired.replace(/,\s*([}\]])/g, "$1");
  if (trailingCommaFixed !== repaired) {
    repaired = trailingCommaFixed;
    fixes.push("Removed trailing commas.");
  }

  const quotedKeys = repaired.replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)(\s*:)/g, "$1\"$2\"$3");
  if (quotedKeys !== repaired) {
    repaired = quotedKeys;
    fixes.push("Added quotes around object keys.");
  }

  return { repaired, fixes };
}

export function normalizeFieldType(rawType: unknown): { normalized: FieldType; changed: boolean } {
  if (typeof rawType !== "string") {
    return { normalized: FALLBACK_FIELD_TYPE, changed: true };
  }
  const key = rawType.trim().toLowerCase();
  const normalized = FIELD_TYPE_MAP[key] ?? FALLBACK_FIELD_TYPE;
  return { normalized, changed: normalized !== key };
}

export function normalizeFieldTypesInObject<T>(value: T): { normalized: T; fixes: string[] } {
  const fixes: string[] = [];

  const walk = (input: unknown, path: string): unknown => {
    if (Array.isArray(input)) {
      return input.map((item, index) => walk(item, `${path}[${index}]`));
    }
    if (!input || typeof input !== "object") {
      return input;
    }

    const record = input as Record<string, unknown>;
    const next: Record<string, unknown> = {};

    for (const [key, val] of Object.entries(record)) {
      if (key === "type" && typeof record.required === "boolean") {
        const normalized = normalizeFieldType(val);
        next[key] = normalized.normalized;
        if (normalized.changed) {
          fixes.push(`Normalized field type at ${path ? `${path}.` : ""}type to "${normalized.normalized}".`);
        }
      } else {
        next[key] = walk(val, path ? `${path}.${key}` : key);
      }
    }
    return next;
  };

  return { normalized: walk(value, "") as T, fixes };
}
