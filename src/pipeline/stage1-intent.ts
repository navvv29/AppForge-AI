import { LLMClient, estimateModeCost, type LLMUsage, type RunMode } from "../llm/client.js";
import { IntentSchemaContract, type IntentSchema } from "../schemas/intent.schema.js";
import { unique } from "./utils.js";

export interface StageOutput<T> {
  raw: unknown;
  usage: LLMUsage;
  provider: string;
  model: string;
}

function inferIntentFromPrompt(prompt: string): IntentSchema {
  const text = prompt.toLowerCase();
  const entities: string[] = [];

  const entityHints: Array<[RegExp, string[]]> = [
    [/\bcrm\b/, ["contacts", "deals", "accounts"]],
    [/\bcontact(s)?\b/, ["contacts"]],
    [/\bdeal(s)?\b/, ["deals"]],
    [/\bblog\b/, ["posts", "authors"]],
    [/\bsubscription(s)?\b/, ["subscriptions", "plans"]],
    [/\be-?commerce|store|checkout\b/, ["products", "orders", "customers", "inventory"]],
    [/\bproject management|tasks?|teams?\b/, ["projects", "tasks", "teams"]],
    [/\bbooking|calendar\b/, ["bookings", "slots", "availability"]],
    [/\bhr|payroll|onboarding\b/, ["employees", "onboarding_tasks", "payroll_records"]],
    [/\blms|learning|courses?|quizzes?\b/, ["courses", "lessons", "quizzes", "enrollments"]],
    [/\bsupport|ticket\b/, ["tickets", "sla_policies"]],
    [/\banalytics|tracking\b/, ["events", "dashboards", "reports"]]
  ];

  for (const [regex, names] of entityHints) {
    if (regex.test(text)) {
      entities.push(...names);
    }
  }

  const features = unique(
    [
      /\blogin|auth|sign in\b/.test(text) ? "authentication" : "",
      /\brole\b|\bpermission\b|\brbac\b/.test(text) ? "role_based_access" : "",
      /\bdashboard\b/.test(text) ? "dashboard" : "",
      /\bpayment|premium|subscription|billing|checkout\b/.test(text) ? "payments" : "",
      /\bpremium|plan\b/.test(text) ? "premium_plan" : "",
      /\bemail\b/.test(text) ? "email_notifications" : "",
      /\breal[- ]?time\b/.test(text) ? "realtime_updates" : "",
      /\boffline\b/.test(text) ? "offline_support" : ""
    ].filter(Boolean)
  );

  const roles = unique(
    [
      /\badmin\b/.test(text) ? "admin" : "",
      /\bmanager\b/.test(text) ? "manager" : "",
      /\bagent\b/.test(text) ? "agent" : "",
      /\bmember\b/.test(text) ? "member" : "",
      /\bguest\b/.test(text) ? "guest" : "",
      /\binstructor\b/.test(text) ? "instructor" : "",
      /\bstudent\b/.test(text) ? "student" : "",
      /\bemployee\b/.test(text) ? "employee" : "",
      /\bcustomer\b/.test(text) ? "customer" : "",
      /\buser\b/.test(text) ? "user" : ""
    ].filter(Boolean)
  );

  const integrations = unique(
    [
      /\bpayment|stripe|razorpay|paypal|billing\b/.test(text) ? "payments" : "",
      /\bemail|sendgrid|smtp\b/.test(text) ? "email" : "",
      /\bcalendar|google calendar\b/.test(text) ? "calendar" : "",
      /\bml|ai prediction|prediction\b/.test(text) ? "ml_predictions" : "",
      /\banalytics|mixpanel|segment\b/.test(text) ? "analytics" : ""
    ].filter(Boolean)
  );

  if (features.includes("authentication")) {
    entities.push("users");
  }
  if (features.includes("payments") || integrations.includes("payments")) {
    entities.push("subscriptions", "plans", "payment_transactions");
  }
  if (!entities.length) {
    entities.push("users");
  }

  const ambiguities: string[] = [];
  if (!/\b(auth|login|sign in|rbac|role)\b/.test(text)) {
    ambiguities.push("Authentication model is not explicit; JWT auth is assumed.");
  }
  if (!/\b(sql|database|data|store|table|entity)\b/.test(text)) {
    ambiguities.push("Data persistence requirements are not explicit.");
  }
  if (/\bbuild me an app\b/.test(text) || text.trim().split(/\s+/).length < 4) {
    ambiguities.push("Prompt is vague; default entities, pages, and permissions are assumed.");
  }
  if (/\beveryone\b.*\badmin\b/.test(text) && /\bno one\b.*\bdelete\b/.test(text)) {
    ambiguities.push("Conflict: broad admin assignment conflicts with explicit delete prohibition.");
  }
  if (/\bguest(s)?\b/.test(text) && /\bedit all\b/.test(text)) {
    ambiguities.push("Conflict: guest edit-all access conflicts with common least-privilege policy.");
  }
  if (/\breal[- ]?time\b/.test(text) && /\boffline(-first)?\b/.test(text) && /\bno backend\b/.test(text)) {
    ambiguities.push("Conflict: real-time + offline-first without backend is technically inconsistent.");
  }

  return {
    entities: unique(entities),
    features,
    roles: roles.length ? roles : ["admin", "user"],
    integrations,
    ambiguities: unique(ambiguities)
  };
}

export async function runStage1Intent(
  prompt: string,
  mode: RunMode,
  llm: LLMClient,
  retryInstruction?: string
): Promise<StageOutput<IntentSchema>> {
  if (llm.isMock()) {
    const inferred = inferIntentFromPrompt(prompt);
    const inputTokens = Math.ceil(prompt.length / 4);
    const outputTokens = Math.ceil(JSON.stringify(inferred).length / 4);
    return {
      raw: inferred,
      provider: llm.provider,
      model: "deterministic-stage1",
      usage: {
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        latencyMs: 1,
        costUsd: estimateModeCost(mode, inputTokens, outputTokens)
      }
    };
  }

  const systemPrompt = [
    "You are Stage 1: Intent Extractor in a software-generation compiler.",
    "Return JSON only. No markdown. No prose.",
    "Extract entities, features, roles, integrations, and ambiguities from the product prompt.",
    "Output must exactly match this schema:",
    IntentSchemaContract
  ].join("\n");

  const userPrompt = [
    `Input prompt: """${prompt}"""`,
    "Rules:",
    "- Keep values concise and deduplicated.",
    "- Integrations should include external systems like payments/email/calendar/analytics.",
    "- Ambiguities must list unclear requirements or conflicts.",
    retryInstruction ?? ""
  ]
    .filter(Boolean)
    .join("\n");

  const response = await llm.generateJson(systemPrompt, userPrompt, mode);
  return {
    raw: response.text,
    usage: response.usage,
    provider: response.provider,
    model: response.model
  };
}
