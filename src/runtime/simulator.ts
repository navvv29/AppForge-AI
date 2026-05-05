import type { FullAppSchema, UIComponent } from "../schemas/app.schema.js";
import type { SimulationReport } from "../schemas/repair.schema.js";

function walkComponents(components: UIComponent[], fn: (component: UIComponent) => void): void {
  for (const component of components) {
    fn(component);
    if (component.children?.length) {
      walkComponents(component.children, fn);
    }
  }
}

function endpointKey(path: string, method: string): string {
  return `${method.toUpperCase()} ${path}`;
}

export function simulateFullSchema(schema: FullAppSchema): SimulationReport {
  const issues: string[] = [];
  const endpointMap = new Map(
    schema.apiConfig.endpoints.map((endpoint) => [endpointKey(endpoint.path, endpoint.method), endpoint])
  );
  const tables = new Map(schema.dbSchema.tables.map((table) => [table.name, table]));
  const roles = new Set(schema.authConfig.roles);
  const guardByRoute = new Map(schema.authConfig.routeGuards.map((guard) => [guard.route, guard]));
  const flags = new Set(schema.businessLogic.featureFlags.map((flag) => flag.name));

  for (const page of schema.uiConfig.pages) {
    for (const role of page.accessRoles) {
      if (!roles.has(role)) {
        issues.push(`Page "${page.name}" references unknown role "${role}".`);
      }
    }
    if (page.accessRoles.length > 0) {
      const guard = guardByRoute.get(page.route);
      if (!guard) {
        issues.push(`Page "${page.name}" is missing route guard for "${page.route}".`);
      } else {
        for (const role of page.accessRoles) {
          if (!guard.roles.includes(role)) {
            issues.push(`Route guard "${page.route}" is missing page role "${role}".`);
          }
        }
      }
    }
    walkComponents(page.components, (component) => {
      component.visibility?.roles?.forEach((role) => {
        if (!roles.has(role)) {
          issues.push(`Component "${component.id}" references unknown visibility role "${role}".`);
        }
      });
      if (component.visibility?.featureFlag && !flags.has(component.visibility.featureFlag)) {
        issues.push(`Component "${component.id}" references unknown feature flag "${component.visibility.featureFlag}".`);
      }
      if (!component.dataBinding) {
        return;
      }
      const key = endpointKey(component.dataBinding.endpoint, component.dataBinding.method);
      const endpoint = endpointMap.get(key);
      if (!endpoint) {
        issues.push(
          `Component "${component.id}" binds to missing endpoint ${component.dataBinding.method} ${component.dataBinding.endpoint}.`
        );
        return;
      }
      const requestFieldSet = new Set([
        ...(endpoint.request?.params ?? []).map((field) => field.name),
        ...(endpoint.request?.body ?? []).map((field) => field.name)
      ]);
      const responseFieldSet = new Set(endpoint.response.fields.map((field) => field.name));
      for (const field of component.dataBinding.requestFields ?? []) {
        if (!requestFieldSet.has(field)) {
          issues.push(
            `Component "${component.id}" request field "${field}" is not defined in endpoint "${endpoint.name}".`
          );
        }
      }
      for (const field of component.dataBinding.responseFields ?? []) {
        if (!responseFieldSet.has(field)) {
          issues.push(
            `Component "${component.id}" response field "${field}" is not defined in endpoint "${endpoint.name}".`
          );
        }
      }
    });
  }

  for (const endpoint of schema.apiConfig.endpoints) {
    endpoint.roles.forEach((role) => {
      if (!roles.has(role)) {
        issues.push(`Endpoint "${endpoint.name}" references unknown role "${role}".`);
      }
    });

    const source = endpoint.sourceEntity;
    if (!source) {
      issues.push(`Endpoint "${endpoint.name}" is missing sourceEntity.`);
      continue;
    }
    const table = tables.get(source);
    if (!table) {
      issues.push(`Endpoint "${endpoint.name}" references missing DB table "${source}".`);
      continue;
    }
    const columns = new Set(table.columns.map((column) => column.name));
    const columnTypeMap = new Map(table.columns.map((column) => [column.name, column.type]));
    const fields = [
      ...(endpoint.request?.params ?? []),
      ...(endpoint.request?.body ?? []),
      ...endpoint.response.fields
    ];
    for (const field of fields) {
      if (!columns.has(field.name)) {
        issues.push(
          `Endpoint "${endpoint.name}" field "${field.name}" does not exist in table "${table.name}".`
        );
      } else {
        const dbType = columnTypeMap.get(field.name);
        if (dbType && dbType !== field.type) {
          issues.push(
            `Endpoint "${endpoint.name}" field "${field.name}" type "${field.type}" mismatches DB type "${dbType}" in table "${table.name}".`
          );
        }
      }
    }
  }

  schema.authConfig.routeGuards.forEach((guard) => {
    guard.roles.forEach((role) => {
      if (!roles.has(role)) {
        issues.push(`Route guard "${guard.route}" references unknown role "${role}".`);
      }
    });
  });
  schema.authConfig.permissionRules.forEach((rule) => {
    rule.roles.forEach((role) => {
      if (!roles.has(role)) {
        issues.push(`Permission ${rule.resource}:${rule.action} references unknown role "${role}".`);
      }
    });
  });
  schema.businessLogic.accessGates.forEach((gate) => {
    if (!flags.has(gate.feature)) {
      issues.push(`Access gate "${gate.feature}" has no matching feature flag.`);
    }
    gate.roles.forEach((role) => {
      if (!roles.has(role)) {
        issues.push(`Access gate "${gate.feature}" references unknown role "${role}".`);
      }
    });
  });

  return {
    passed: issues.length === 0,
    issues
  };
}
