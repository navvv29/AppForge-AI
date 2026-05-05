import { LLMClient, estimateModeCost, type LLMUsage, type RunMode } from "../llm/client.js";
import type { AppArchitectureSchema, FieldType } from "../schemas/architecture.schema.js";
import { FullAppSchemaContract, type FullAppSchema } from "../schemas/app.schema.js";
import { normalizeName, singularize, unique } from "./utils.js";

export interface StageOutput<T> {
  raw: unknown;
  usage: LLMUsage;
  provider: string;
  model: string;
}

function toHttpMethod(action: string): "GET" | "POST" | "PUT" | "PATCH" | "DELETE" {
  const lower = action.toLowerCase();
  if (lower === "create") return "POST";
  if (lower === "list" || lower === "get") return "GET";
  if (lower === "update") return "PATCH";
  if (lower === "delete") return "DELETE";
  return "PATCH";
}

function buildField(name: string, type: FieldType = "string", required = false) {
  return { name, type, required };
}

function inferFullSchema(architecture: AppArchitectureSchema): FullAppSchema {
  const entityMap = new Map(
    architecture.dbEntities.map((entity) => [singularize(normalizeName(entity.name)), entity.fields])
  );
  const authRoles = unique([...architecture.authModel.roles]);
  const roleSet = new Set(authRoles);
  const hasPayments = architecture.apiGroups.some(
    (group) => group.resource.includes("payment") || group.resource.includes("subscription") || group.resource.includes("plan")
  );

  const toResource = (value: string): string => singularize(normalizeName(value));
  const resourceByPath = (route: string): string => toResource(route.replace(/^\//, "")) || "record";

  const pages = architecture.pages.map((page) => {
    const resource = normalizeName(page.name);
    const routeResource = page.route === "/" ? toResource(architecture.apiGroups[0]?.resource ?? "dashboard") : resourceByPath(page.route);
    const endpointPath = `/${routeResource}`;
    const components =
      resource === "login"
        ? [
            {
              id: "login-form",
              type: "form" as const,
              label: "Login",
              dataBinding: {
                endpoint: "/auth/login",
                method: "POST" as const,
                requestFields: ["email", "password"],
                responseFields: ["token", "user"]
              }
            }
          ]
        : resource === "billing"
          ? [
              {
                id: "billing-subscriptions-table",
                type: "table" as const,
                label: "Subscriptions",
                dataBinding: {
                  endpoint: "/subscriptions",
                  method: "GET" as const,
                  responseFields: ["id", "status", "renewal_at"]
                }
              },
              {
                id: "billing-payment-form",
                type: "form" as const,
                label: "Create Payment",
                dataBinding: {
                  endpoint: "/payments",
                  method: "POST" as const,
                  requestFields: ["subscription_id", "amount", "currency"],
                  responseFields: ["id", "status", "paid_at"]
                }
              }
            ]
        : [
            {
              id: `${resource}-table`,
              type: "table" as const,
              label: `${page.name} List`,
              dataBinding: {
                endpoint: endpointPath,
                method: "GET" as const,
                responseFields: ["id", "name"]
              }
            },
            {
              id: `${resource}-form`,
              type: "form" as const,
              label: `${page.name} Form`,
              dataBinding: {
                endpoint: endpointPath,
                method: "POST" as const,
                requestFields: ["name", "description"],
                responseFields: ["id", "name", "description"]
              }
            }
          ];

    return {
      name: page.name,
      route: page.route,
      accessRoles: page.accessRoles,
      layout: (page.route === "/" ? "dashboard" : "single-column") as "dashboard" | "single-column",
      components
    };
  });

  const endpoints = architecture.apiGroups.flatMap((group) => {
    const resource = singularize(normalizeName(group.resource));
    const basePath = `/${resource}`;
    const modelFields = entityMap.get(resource) ?? [
      buildField("id", "id", true),
      buildField("name", "string", true),
      buildField("description", "text", false)
    ];
    const editableFields = modelFields.filter((field) => !["id", "created_at", "updated_at"].includes(field.name));

    return group.actions.map((action) => {
      if (resource === "auth" && action === "login") {
        return {
          name: "login",
          path: "/auth/login",
          method: "POST" as const,
          authRequired: false,
          roles: [],
          request: { body: [buildField("email", "string", true), buildField("password", "string", true)] },
          response: {
            fields: [
              buildField("token", "string", true),
              buildField("user_id", "id", true),
              buildField("role", "enum", true)
            ]
          },
          sourceEntity: "user"
        };
      }
      if (resource === "auth" && action === "me") {
        return {
          name: "me",
          path: "/auth/me",
          method: "GET" as const,
          authRequired: true,
          roles: authRoles,
          request: undefined,
          response: {
            fields: [buildField("id", "id", true), buildField("email", "string", true), buildField("role", "enum", true)]
          },
          sourceEntity: "user"
        };
      }

      const method = toHttpMethod(action);
      const itemPath = `${basePath}/:id`;
      const path = action === "get" || action === "update" || action === "delete" ? itemPath : basePath;
      const isList = action === "list";
      const isGet = action === "get";
      const isWrite = action === "create" || action === "update";

      return {
        name: `${action}_${resource}`,
        path,
        method,
        authRequired: true,
        roles: authRoles,
        request: isList
          ? undefined
          : isGet || action === "delete"
          ? {
              params: [buildField("id", "id", true)]
            }
          : isWrite
            ? {
                ...(action === "update" ? { params: [buildField("id", "id", true)] } : {}),
                body: editableFields.map((field) => ({ ...field, required: action === "create" ? field.required : false }))
              }
            : undefined,
        response: {
          fields: modelFields
        },
        sourceEntity: resource
      };
    });
  });
  const endpointMap = new Map<string, (typeof endpoints)[number]>();
  for (const endpoint of endpoints) {
    endpointMap.set(`${endpoint.method} ${endpoint.path}`, endpoint);
  }
  const dedupedEndpoints = [...endpointMap.values()];

  const tables = architecture.dbEntities.map((entity) => ({
    name: singularize(normalizeName(entity.name)),
    columns: entity.fields,
    relations: [] as Array<{
      type: "one-to-one" | "one-to-many" | "many-to-one" | "many-to-many";
      table: string;
      field: string;
    }>
  }));

  const hasUserTable = tables.some((table) => table.name === "user");
  if (!tables.find((table) => table.name === "user")) {
    tables.push({
      name: "user",
      columns: [
        buildField("id", "id", true),
        buildField("email", "string", true),
        buildField("password_hash", "string", true),
        buildField("role", "enum", true)
      ],
      relations: []
    });
  }
  if (!hasUserTable && !roleSet.has("user")) {
    authRoles.push("user");
    roleSet.add("user");
  }
  const tableMap = new Map(tables.map((table) => [table.name, table]));
  if (tableMap.has("subscription") && tableMap.has("plan")) {
    tableMap.get("subscription")!.relations.push({
      type: "many-to-one",
      table: "plan",
      field: "plan_id"
    });
  }
  if (tableMap.has("payment_transaction") && tableMap.has("subscription")) {
    tableMap.get("payment_transaction")!.relations.push({
      type: "many-to-one",
      table: "subscription",
      field: "subscription_id"
    });
  }

  const permissionRules = Object.entries(architecture.authModel.permissionsMatrix).flatMap(([role, permissions]) =>
    permissions.map((permission) => {
      const [resource, action] = permission.includes(":")
        ? permission.split(":")
        : [permission, "list"];
      return {
        resource: resource || "general",
        action: action || "list",
        roles: [role]
      };
    })
  );

  const featureFlags = unique([
    ...architecture.assumptions
      .filter((assumption) => assumption.toLowerCase().includes("premium") || assumption.toLowerCase().includes("subscription"))
      .map(() => "premium_plan"),
    ...architecture.apiGroups
      .map((group) => group.resource)
      .filter((resource) => resource.includes("payment") || resource.includes("subscription"))
      .map(() => "premium_plan")
  ]).map((name) => ({
    name,
    enabledByDefault: false,
    description: "Automatically inferred feature flag."
  }));
  if (hasPayments && !featureFlags.find((flag) => flag.name === "premium_plan")) {
    featureFlags.push({
      name: "premium_plan",
      enabledByDefault: false,
      description: "Required for paid features."
    });
  }
  const accessGates = featureFlags.map((flag) => ({
    feature: flag.name,
    roles: authRoles,
    requiredPlan: flag.name.includes("premium") ? ("premium" as const) : undefined
  }));
  if (hasPayments) {
    accessGates.push({
      feature: "billing_portal",
      roles: authRoles,
      requiredPlan: "premium" as const
    });
  }

  const computedFields = hasPayments
    ? [
        {
          entity: "subscription",
          field: "is_active",
          expression: "status == 'active' && renewal_at > now()"
        }
      ]
    : [];

  if (!dedupedEndpoints.find((endpoint) => endpoint.path === "/analytics/summary" && endpoint.method === "GET")) {
    dedupedEndpoints.push({
      name: "analytics_summary",
      path: "/analytics/summary",
      method: "GET",
      authRequired: true,
      roles: authRoles,
      request: undefined,
      response: {
        fields: [buildField("total_records", "integer", true), buildField("active_users", "integer", true)]
      },
      sourceEntity: "user"
    });
  }

  return {
    uiConfig: { pages },
    apiConfig: { endpoints: dedupedEndpoints },
    dbSchema: { tables },
    authConfig: {
      strategy: architecture.authModel.strategy,
      roles: unique(authRoles),
      routeGuards: architecture.pages
        .filter((page) => page.accessRoles.length > 0)
        .map((page) => ({ route: page.route, roles: unique(page.accessRoles) })),
      permissionRules
    },
    businessLogic: {
      featureFlags,
      accessGates,
      computedFields
    }
  };
}

export async function runStage3Schema(
  architecture: AppArchitectureSchema,
  mode: RunMode,
  llm: LLMClient,
  retryInstruction?: string
): Promise<StageOutput<FullAppSchema>> {
  if (llm.isMock() || mode === "fast") {
    const inferred = inferFullSchema(architecture);
    const inputTokens = Math.ceil(JSON.stringify(architecture).length / 4);
    const outputTokens = Math.ceil(JSON.stringify(inferred).length / 4);
    return {
      raw: inferred,
      provider: llm.provider,
      model: llm.isMock() ? "deterministic-stage3" : "fast-schema-compiler",
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
    "You are Stage 3: Schema Generator in a software-generation compiler.",
    "Return JSON only. No markdown. No prose.",
    "Generate a complete executable FullAppSchema from AppArchitectureSchema.",
    "Output must exactly match this schema:",
    FullAppSchemaContract
  ].join("\n");

  const userPrompt = [
    `AppArchitectureSchema input:\n${JSON.stringify(architecture, null, 2)}`,
    "Rules:",
    "- Ensure uiConfig data bindings map to apiConfig endpoints.",
    "- Ensure apiConfig sourceEntity and fields are represented in dbSchema tables/columns.",
    "- Ensure all referenced roles exist in authConfig.roles.",
    "- Include business logic for premium/subscription/payment-related features where applicable.",
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
