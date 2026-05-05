import type { FullAppSchema } from "../schemas/app.schema.js";

export type RuntimeRoute = {
  method: string;
  path: string;
  sourceEntity?: string;
  authRequired: boolean;
  roles: string[];
};

export function compileApiRoutes(schema: FullAppSchema): RuntimeRoute[] {
  return schema.apiConfig.endpoints.map((endpoint) => ({
    method: endpoint.method,
    path: endpoint.path,
    sourceEntity: endpoint.sourceEntity,
    authRequired: endpoint.authRequired,
    roles: endpoint.roles
  }));
}
