import { LLMClient, estimateModeCost, type LLMUsage, type RunMode } from "../llm/client.js";
import type { IntentSchema } from "../schemas/intent.schema.js";
import {
  AppArchitectureSchemaContract,
  type AppArchitectureSchema,
  type FieldType
} from "../schemas/architecture.schema.js";
import { normalizeName, singularize, toRoute, unique } from "./utils.js";

export interface StageOutput<T> {
  raw: unknown;
  usage: LLMUsage;
  provider: string;
  model: string;
}

function inferFieldType(name: string): FieldType {
  const key = name.toLowerCase();
  if (key === "id" || key.endsWith("_id")) {
    return "id";
  }
  if (key.includes("count") || key.includes("amount") || key.includes("price")) {
    return "number";
  }
  if (key.includes("date") || key.includes("at")) {
    return "datetime";
  }
  if (key.startsWith("is_") || key.startsWith("has_")) {
    return "boolean";
  }
  return "string";
}

function buildDbFieldsForEntity(entity: string, mode: RunMode) {
  const normalized = normalizeName(entity);
  const defaultFieldNames =
    mode === "fast"
      ? ["id", "name", "created_at"]
      : ["id", "name", "description", "created_at", "updated_at"];
  const uniqueFieldNames = unique(
    normalized.includes("ticket")
      ? [...defaultFieldNames, "status", "priority"]
      : normalized.includes("deal")
        ? [...defaultFieldNames, "value", "stage"]
        : normalized.includes("booking")
          ? [...defaultFieldNames, "start_at", "end_at"]
          : normalized.includes("payment")
            ? [...defaultFieldNames, "amount", "currency", "status", "paid_at"]
            : normalized.includes("subscription")
              ? [...defaultFieldNames, "plan_id", "status", "renewal_at"]
          : defaultFieldNames
  );

  return uniqueFieldNames.map((name) => ({
    name,
    type: inferFieldType(name),
      required: name === "id" || name === "name"
    }));
}

function inferArchitecture(intent: IntentSchema, mode: RunMode): AppArchitectureSchema {
  const roles = unique(intent.roles.length ? intent.roles : ["admin", "user"]);
  const hasPayments = intent.features.includes("payments") || intent.integrations.includes("payments");
  const hasAuthentication = intent.features.includes("authentication");
  const deleteRestricted = intent.ambiguities.some((item) => /delete prohibition|no one.*delete|delete restrictions/i.test(item));

  const basePages = [{ name: "dashboard", route: "/", accessRoles: roles }];
  const authPages = hasAuthentication
    ? [{ name: "login", route: "/login", accessRoles: [] as string[] }]
    : [];
  const billingPages = hasPayments ? [{ name: "billing", route: "/billing", accessRoles: roles }] : [];

  const entityPages = intent.entities.map((entity) => ({
    name: normalizeName(entity),
    route: toRoute(entity),
    accessRoles: roles
  }));

  const pages = [...authPages, ...basePages, ...billingPages, ...entityPages];
  const defaultActions = deleteRestricted
    ? ["create", "list", "get", "update"]
    : ["create", "list", "get", "update", "delete"];
  const apiGroups = intent.entities.map((entity) => {
    const resource = normalizeName(entity);
    const resourceActions = resource === "plans" || resource === "subscriptions"
      ? ["list", "get", "create", "update"]
      : defaultActions;
    return {
      resource,
      actions: resourceActions
    };
  });
  if (hasAuthentication) {
    apiGroups.push({ resource: "auth", actions: ["login", "me"] });
  }
  if (hasPayments) {
    apiGroups.push({ resource: "payments", actions: ["create", "list", "get"] });
  }

  const normalizedEntities = unique(intent.entities.map((entity) => singularize(normalizeName(entity))));
  const dbEntityNames = unique(
    hasPayments
      ? [...normalizedEntities, "plan", "subscription", "payment_transaction"]
      : normalizedEntities
  );
  if (hasAuthentication && !dbEntityNames.includes("user")) {
    dbEntityNames.push("user");
  }
  const dbEntities = dbEntityNames.map((entity) => ({
    name: entity,
    fields: buildDbFieldsForEntity(entity, mode)
  }));

  const permissionsMatrix: Record<string, string[]> = {};
  const allPermissions = apiGroups.flatMap((group) =>
    group.actions.map((action) => `${group.resource}:${action}`)
  );
  for (const role of roles) {
    const isAdmin = role.toLowerCase() === "admin";
    permissionsMatrix[role] = isAdmin
      ? allPermissions
      : allPermissions.filter((permission) => {
          const [, action] = permission.split(":");
          return action === "list" || action === "get" || action === "update" || action === "me";
        });
  }

  const assumptions = unique([
    "REST API architecture is assumed.",
    "RBAC with JWT is assumed unless overridden.",
    hasPayments ? "Payments are modeled with plan/subscription/transaction entities." : "",
    deleteRestricted ? "Delete operations are disabled due to explicit policy conflict." : "",
    ...intent.ambiguities
  ].filter(Boolean));

  return {
    pages,
    apiGroups,
    dbEntities,
    authModel: {
      strategy: "jwt",
      roles,
      permissionsMatrix
    },
    assumptions
  };
}

export async function runStage2Architect(
  intent: IntentSchema,
  mode: RunMode,
  llm: LLMClient,
  retryInstruction?: string
): Promise<StageOutput<AppArchitectureSchema>> {
  if (llm.isMock()) {
    const inferred = inferArchitecture(intent, mode);
    const inputTokens = Math.ceil(JSON.stringify(intent).length / 4);
    const outputTokens = Math.ceil(JSON.stringify(inferred).length / 4);
    return {
      raw: inferred,
      provider: llm.provider,
      model: "deterministic-stage2",
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
    "You are Stage 2: System Designer in a software-generation compiler.",
    "Return JSON only. No markdown. No prose.",
    "Design pages, API groups, DB entities, auth model, and assumptions.",
    "Output must exactly match this schema:",
    AppArchitectureSchemaContract
  ].join("\n");

  const userPrompt = [
    `IntentSchema input:\n${JSON.stringify(intent, null, 2)}`,
    "Rules:",
    "- Only use field types from the allowed enum.",
    "- Ensure all roles are reflected in pages and authModel.roles.",
    "- Put every assumption explicitly in assumptions[].",
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
