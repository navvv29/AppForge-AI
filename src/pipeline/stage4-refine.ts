import { LLMClient, estimateModeCost, type LLMUsage, type RunMode } from "../llm/client.js";
import { FullAppSchemaContract, type FullAppSchema, type UIComponent } from "../schemas/app.schema.js";
import { normalizeName, singularize, unique } from "./utils.js";

export interface StageOutput<T> {
  raw: unknown;
  usage: LLMUsage;
  provider: string;
  model: string;
}

export interface ConsistencyRepair {
  issue: string;
  fix: string;
}

function walkComponents(components: UIComponent[], fn: (component: UIComponent) => void): void {
  for (const component of components) {
    fn(component);
    if (component.children?.length) {
      walkComponents(component.children, fn);
    }
  }
}

function buildField(name: string) {
  return { name, type: "string" as const, required: false };
}

function getEndpointKey(path: string, method: string): string {
  return `${method.toUpperCase()} ${path}`;
}

function findOrCreateTable(schema: FullAppSchema, tableName: string): { table: FullAppSchema["dbSchema"]["tables"][number]; created: boolean } {
  const normalized = singularize(normalizeName(tableName));
  const existing = schema.dbSchema.tables.find((table) => table.name === normalized);
  if (existing) {
    return { table: existing, created: false };
  }
  const newTable = {
    name: normalized,
    columns: [
      { name: "id", type: "id" as const, required: true },
      { name: "name", type: "string" as const, required: true }
    ],
    relations: []
  };
  schema.dbSchema.tables.push(newTable);
  return { table: newTable, created: true };
}

export function resolveConsistency(input: FullAppSchema): { schema: FullAppSchema; repairs: ConsistencyRepair[] } {
  const schema: FullAppSchema = JSON.parse(JSON.stringify(input));
  const repairs: ConsistencyRepair[] = [];

  const endpointMap = new Map<string, FullAppSchema["apiConfig"]["endpoints"][number]>();
  for (const endpoint of schema.apiConfig.endpoints) {
    endpointMap.set(getEndpointKey(endpoint.path, endpoint.method), endpoint);
  }

  for (const page of schema.uiConfig.pages) {
    walkComponents(page.components, (component) => {
      const binding = component.dataBinding;
      if (!binding) {
        return;
      }

      const bindingKey = getEndpointKey(binding.endpoint, binding.method);
      if (!endpointMap.has(bindingKey)) {
        const candidate = schema.apiConfig.endpoints.find((endpoint) => endpoint.path === binding.endpoint);
        if (candidate) {
          const oldMethod = binding.method;
          component.dataBinding = { ...binding, method: candidate.method };
          repairs.push({
            issue: `UI component "${component.id}" references missing endpoint method ${oldMethod} ${binding.endpoint}.`,
            fix: `Updated component binding method to ${candidate.method} to match existing API endpoint.`
          });
          return;
        }

        const sourceEntity = singularize(normalizeName(binding.endpoint.replace(/^\//, ""))) || "record";
        const requestFields = (binding.requestFields ?? []).map((field) => buildField(field));
        const responseFields = (binding.responseFields ?? []).map((field) => buildField(field));
        const createdEndpoint = {
          name: `${binding.method.toLowerCase()}_${sourceEntity}`,
          path: binding.endpoint,
          method: binding.method,
          authRequired: page.accessRoles.length > 0,
          roles: page.accessRoles,
          request: requestFields.length ? { body: requestFields } : undefined,
          response: {
            fields: responseFields.length
              ? responseFields
              : [
                  { name: "id", type: "id" as const, required: true },
                  { name: "name", type: "string" as const, required: true }
                ]
          },
          sourceEntity
        };
        schema.apiConfig.endpoints.push(createdEndpoint);
        endpointMap.set(bindingKey, createdEndpoint);
        repairs.push({
          issue: `UI component "${component.id}" references missing endpoint ${binding.method} ${binding.endpoint}.`,
          fix: `Created API endpoint ${createdEndpoint.name} to satisfy UI binding.`
        });
      }

      const activeBinding = component.dataBinding ?? binding;
      const resolvedEndpoint = endpointMap.get(getEndpointKey(activeBinding.endpoint, activeBinding.method));
      if (!resolvedEndpoint) {
        return;
      }
      const requestFieldNames = new Set([
        ...(resolvedEndpoint.request?.params ?? []).map((field) => field.name),
        ...(resolvedEndpoint.request?.body ?? []).map((field) => field.name)
      ]);
      const responseFieldNames = new Set(resolvedEndpoint.response.fields.map((field) => field.name));

      for (const requestField of activeBinding.requestFields ?? []) {
        if (!requestFieldNames.has(requestField)) {
          if (!resolvedEndpoint.request) {
            resolvedEndpoint.request = { body: [] };
          }
          if (!resolvedEndpoint.request.body) {
            resolvedEndpoint.request.body = [];
          }
          resolvedEndpoint.request.body.push(buildField(requestField));
          requestFieldNames.add(requestField);
          repairs.push({
            issue: `UI request field "${requestField}" in component "${component.id}" was missing from endpoint "${resolvedEndpoint.name}".`,
            fix: `Added request field "${requestField}" to endpoint "${resolvedEndpoint.name}".`
          });
        }
      }
      for (const responseField of activeBinding.responseFields ?? []) {
        if (!responseFieldNames.has(responseField)) {
          resolvedEndpoint.response.fields.push(buildField(responseField));
          responseFieldNames.add(responseField);
          repairs.push({
            issue: `UI response field "${responseField}" in component "${component.id}" was missing from endpoint "${resolvedEndpoint.name}".`,
            fix: `Added response field "${responseField}" to endpoint "${resolvedEndpoint.name}".`
          });
        }
      }
    });
  }

  for (const endpoint of schema.apiConfig.endpoints) {
    const sourceEntity = endpoint.sourceEntity ?? (singularize(normalizeName(endpoint.path.replace(/^\//, ""))) || "record");
    endpoint.sourceEntity = sourceEntity;
    const tableResult = findOrCreateTable(schema, sourceEntity);
    if (tableResult.created) {
      repairs.push({
        issue: `API endpoint "${endpoint.name}" referenced missing DB table "${sourceEntity}".`,
        fix: `Created table "${sourceEntity}" with default columns.`
      });
    }

    const table = tableResult.table;
    const knownColumns = new Set(table.columns.map((column) => column.name));
    const fields = [
      ...(endpoint.request?.params ?? []),
      ...(endpoint.request?.body ?? []),
      ...endpoint.response.fields
    ];
    for (const field of fields) {
      if (!knownColumns.has(field.name)) {
        table.columns.push({ ...field, required: false });
        knownColumns.add(field.name);
        repairs.push({
          issue: `API field "${field.name}" in endpoint "${endpoint.name}" was missing in DB table "${table.name}".`,
          fix: `Added "${field.name}" column to table "${table.name}".`
        });
      } else {
        const dbColumn = table.columns.find((column) => column.name === field.name);
        if (dbColumn && dbColumn.type !== field.type) {
          field.type = dbColumn.type;
          repairs.push({
            issue: `API field "${field.name}" type mismatch detected in endpoint "${endpoint.name}".`,
            fix: `Aligned API field "${field.name}" type to DB type "${dbColumn.type}" in table "${table.name}".`
          });
        }
      }
    }
  }

  const referencedRoles = new Set<string>();
  schema.uiConfig.pages.forEach((page) => {
    page.accessRoles.forEach((role) => referencedRoles.add(role));
    walkComponents(page.components, (component) => {
      component.visibility?.roles?.forEach((role) => referencedRoles.add(role));
      if (component.visibility?.featureFlag) {
        const hasFlag = schema.businessLogic.featureFlags.some((flag) => flag.name === component.visibility?.featureFlag);
        if (!hasFlag) {
          schema.businessLogic.featureFlags.push({
            name: component.visibility.featureFlag,
            enabledByDefault: false,
            description: "Added from UI visibility rule."
          });
          repairs.push({
            issue: `Component "${component.id}" referenced missing feature flag "${component.visibility.featureFlag}".`,
            fix: `Added feature flag "${component.visibility.featureFlag}" in businessLogic.featureFlags.`
          });
        }
      }
    });
  });
  schema.apiConfig.endpoints.forEach((endpoint) => endpoint.roles.forEach((role) => referencedRoles.add(role)));
  schema.authConfig.routeGuards.forEach((guard) => guard.roles.forEach((role) => referencedRoles.add(role)));
  schema.authConfig.permissionRules.forEach((rule) => rule.roles.forEach((role) => referencedRoles.add(role)));
  schema.businessLogic.accessGates.forEach((gate) => gate.roles.forEach((role) => referencedRoles.add(role)));
  for (const gate of schema.businessLogic.accessGates) {
    const hasFlag = schema.businessLogic.featureFlags.some((flag) => flag.name === gate.feature);
    if (!hasFlag) {
      schema.businessLogic.featureFlags.push({
        name: gate.feature,
        enabledByDefault: false,
        description: "Added from access gate requirement."
      });
      repairs.push({
        issue: `Access gate feature "${gate.feature}" had no matching feature flag.`,
        fix: `Added feature flag "${gate.feature}" to businessLogic.featureFlags.`
      });
    }
  }

  const roleSet = new Set(schema.authConfig.roles);
  for (const role of referencedRoles) {
    if (!roleSet.has(role)) {
      schema.authConfig.roles.push(role);
      roleSet.add(role);
      repairs.push({
        issue: `Role "${role}" was referenced but missing in authConfig.roles.`,
        fix: `Added role "${role}" to authConfig.roles.`
      });
    }
  }
  schema.authConfig.roles = unique(schema.authConfig.roles);

  const routeGuardByRoute = new Map(schema.authConfig.routeGuards.map((guard) => [guard.route, guard]));
  for (const page of schema.uiConfig.pages) {
    if (!page.accessRoles.length) {
      continue;
    }
    const guard = routeGuardByRoute.get(page.route);
    if (!guard) {
      schema.authConfig.routeGuards.push({ route: page.route, roles: page.accessRoles });
      routeGuardByRoute.set(page.route, schema.authConfig.routeGuards[schema.authConfig.routeGuards.length - 1]);
      repairs.push({
        issue: `Missing route guard for page route "${page.route}".`,
        fix: `Added route guard for "${page.route}" with roles [${page.accessRoles.join(", ")}].`
      });
      continue;
    }
    const mergedRoles = unique([...guard.roles, ...page.accessRoles]);
    if (mergedRoles.length !== guard.roles.length) {
      guard.roles = mergedRoles;
      repairs.push({
        issue: `Route guard "${page.route}" was missing one or more page access roles.`,
        fix: `Merged guard roles to [${mergedRoles.join(", ")}].`
      });
    }
  }

  const permissionKey = (resource: string, action: string, role: string): string => `${resource}:${action}:${role}`;
  const permissionSet = new Set<string>();
  for (const rule of schema.authConfig.permissionRules) {
    for (const role of rule.roles) {
      permissionSet.add(permissionKey(rule.resource, rule.action, role));
    }
  }
  for (const endpoint of schema.apiConfig.endpoints) {
    const resource = endpoint.sourceEntity ?? (singularize(normalizeName(endpoint.path.replace(/^\//, ""))) || "general");
    const action =
      endpoint.method === "GET"
        ? endpoint.path.includes("/:id")
          ? "get"
          : "list"
        : endpoint.method === "POST"
          ? "create"
          : endpoint.method === "PATCH" || endpoint.method === "PUT"
            ? "update"
            : endpoint.method === "DELETE"
              ? "delete"
              : "execute";
    for (const role of endpoint.roles) {
      const key = permissionKey(resource, action, role);
      if (!permissionSet.has(key)) {
        schema.authConfig.permissionRules.push({
          resource,
          action,
          roles: [role]
        });
        permissionSet.add(key);
        repairs.push({
          issue: `Permission rule missing for endpoint "${endpoint.name}" and role "${role}".`,
          fix: `Added permission rule ${resource}:${action} for role "${role}".`
        });
      }
    }
  }

  return { schema, repairs };
}

export async function runStage4Refine(
  schema: FullAppSchema,
  mode: RunMode,
  llm: LLMClient,
  retryInstruction?: string
): Promise<StageOutput<FullAppSchema>> {
  if (llm.isMock() || mode === "fast" || llm.provider === "groq") {
    const refined = resolveConsistency(schema).schema;
    const inputTokens = Math.ceil(JSON.stringify(schema).length / 4);
    const outputTokens = Math.ceil(JSON.stringify(refined).length / 4);
    return {
      raw: refined,
      provider: llm.provider,
      model: llm.isMock()
        ? "deterministic-stage4"
        : llm.provider === "groq"
          ? "groq-safe-consistency"
          : "fast-consistency",
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
    "You are Stage 4: Refinement & Consistency Resolver in a software-generation compiler.",
    "Return JSON only. No markdown. No prose.",
    "Fix internal mismatches across UI, API, DB, and auth layers while preserving intent.",
    "Output must exactly match this schema:",
    FullAppSchemaContract
  ].join("\n");

  const userPrompt = [
    `FullAppSchema input:\n${JSON.stringify(schema, null, 2)}`,
    "Checks to satisfy:",
    "- every UI field binding maps to an API endpoint",
    "- every API field exists in DB schema",
    "- every role referenced in UI/API exists in authConfig.roles",
    "- patch only inconsistent layer; no full regeneration",
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
