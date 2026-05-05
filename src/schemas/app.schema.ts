import { z } from "zod";
import { FieldTypeEnum } from "./architecture.schema.js";

export const HttpMethodEnum = z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]);

export const ApiFieldSchema = z
  .object({
    name: z.string().min(1),
    type: FieldTypeEnum,
    required: z.boolean()
  })
  .strict();

export const DataBindingSchema = z
  .object({
    endpoint: z.string().min(1),
    method: HttpMethodEnum,
    requestFields: z.array(z.string().min(1)).optional(),
    responseFields: z.array(z.string().min(1)).optional()
  })
  .strict();

export const VisibilitySchema = z
  .object({
    roles: z.array(z.string().min(1)).optional(),
    featureFlag: z.string().min(1).optional()
  })
  .strict();

export type UIComponent = {
  id: string;
  type:
    | "form"
    | "table"
    | "chart"
    | "card"
    | "list"
    | "button"
    | "input"
    | "text"
    | "modal"
    | "tabs";
  label?: string;
  dataBinding?: z.infer<typeof DataBindingSchema>;
  visibility?: z.infer<typeof VisibilitySchema>;
  children?: UIComponent[];
};

export const UIComponentSchema: z.ZodType<UIComponent> = z.lazy(() =>
  z
    .object({
      id: z.string().min(1),
      type: z.enum([
        "form",
        "table",
        "chart",
        "card",
        "list",
        "button",
        "input",
        "text",
        "modal",
        "tabs"
      ]),
      label: z.string().optional(),
      dataBinding: DataBindingSchema.optional(),
      visibility: VisibilitySchema.optional(),
      children: z.array(UIComponentSchema).optional()
    })
    .strict()
);

export const FullAppSchemaZod = z
  .object({
    uiConfig: z
      .object({
        pages: z.array(
          z
            .object({
              name: z.string().min(1),
              route: z.string().min(1),
              accessRoles: z.array(z.string().min(1)),
              layout: z.enum(["single-column", "two-column", "dashboard"]),
              components: z.array(UIComponentSchema)
            })
            .strict()
        )
      })
      .strict(),
    apiConfig: z
      .object({
        endpoints: z.array(
          z
            .object({
              name: z.string().min(1),
              path: z.string().min(1),
              method: HttpMethodEnum,
              authRequired: z.boolean(),
              roles: z.array(z.string().min(1)),
              request: z
                .object({
                  params: z.array(ApiFieldSchema).optional(),
                  body: z.array(ApiFieldSchema).optional()
                })
                .strict()
                .optional(),
              response: z
                .object({
                  fields: z.array(ApiFieldSchema)
                })
                .strict(),
              sourceEntity: z.string().min(1).optional()
            })
            .strict()
        )
      })
      .strict(),
    dbSchema: z
      .object({
        tables: z.array(
          z
            .object({
              name: z.string().min(1),
              columns: z.array(ApiFieldSchema),
              relations: z.array(
                z
                  .object({
                    type: z.enum(["one-to-one", "one-to-many", "many-to-one", "many-to-many"]),
                    table: z.string().min(1),
                    field: z.string().min(1)
                  })
                  .strict()
              )
            })
            .strict()
        )
      })
      .strict(),
    authConfig: z
      .object({
        strategy: z.enum(["jwt", "session", "oauth"]),
        roles: z.array(z.string().min(1)),
        routeGuards: z.array(
          z
            .object({
              route: z.string().min(1),
              roles: z.array(z.string().min(1))
            })
            .strict()
        ),
        permissionRules: z.array(
          z
            .object({
              resource: z.string().min(1),
              action: z.string().min(1),
              roles: z.array(z.string().min(1))
            })
            .strict()
        )
      })
      .strict(),
    businessLogic: z
      .object({
        featureFlags: z.array(
          z
            .object({
              name: z.string().min(1),
              enabledByDefault: z.boolean(),
              description: z.string().optional()
            })
            .strict()
        ),
        accessGates: z.array(
          z
            .object({
              feature: z.string().min(1),
              roles: z.array(z.string().min(1)),
              requiredPlan: z.enum(["free", "premium", "enterprise"]).optional()
            })
            .strict()
        ),
        computedFields: z.array(
          z
            .object({
              entity: z.string().min(1),
              field: z.string().min(1),
              expression: z.string().min(1)
            })
            .strict()
        )
      })
      .strict()
  })
  .strict();

export type FullAppSchema = z.infer<typeof FullAppSchemaZod>;

export const FullAppSchemaContract = `{
  "uiConfig": {
    "pages": [{
      "name": string,
      "route": string,
      "accessRoles": string[],
      "layout": "single-column|two-column|dashboard",
      "components": [{
        "id": string,
        "type": "form|table|chart|card|list|button|input|text|modal|tabs",
        "label": string?,
        "dataBinding": {
          "endpoint": string,
          "method": "GET|POST|PUT|PATCH|DELETE",
          "requestFields": string[]?,
          "responseFields": string[]?
        }?,
        "visibility": { "roles": string[]?, "featureFlag": string? }?,
        "children": UIComponent[]?
      }]
    }]
  },
  "apiConfig": {
    "endpoints": [{
      "name": string,
      "path": string,
      "method": "GET|POST|PUT|PATCH|DELETE",
      "authRequired": boolean,
      "roles": string[],
      "request": { "params": ApiField[]?, "body": ApiField[]? }?,
      "response": { "fields": ApiField[] },
      "sourceEntity": string?
    }]
  },
  "dbSchema": {
    "tables": [{
      "name": string,
      "columns": ApiField[],
      "relations": [{ "type": "one-to-one|one-to-many|many-to-one|many-to-many", "table": string, "field": string }]
    }]
  },
  "authConfig": {
    "strategy": "jwt|session|oauth",
    "roles": string[],
    "routeGuards": [{ "route": string, "roles": string[] }],
    "permissionRules": [{ "resource": string, "action": string, "roles": string[] }]
  },
  "businessLogic": {
    "featureFlags": [{ "name": string, "enabledByDefault": boolean, "description": string? }],
    "accessGates": [{ "feature": string, "roles": string[], "requiredPlan": "free|premium|enterprise"? }],
    "computedFields": [{ "entity": string, "field": string, "expression": string }]
  }
}`;
