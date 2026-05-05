import { z } from "zod";

export const FieldTypeEnum = z.enum([
  "id",
  "string",
  "text",
  "integer",
  "number",
  "float",
  "boolean",
  "date",
  "datetime",
  "json",
  "enum"
]);

export const DbFieldSchema = z
  .object({
    name: z.string().min(1),
    type: FieldTypeEnum,
    required: z.boolean()
  })
  .strict();

export const AppArchitectureSchemaZod = z
  .object({
    pages: z.array(
      z
        .object({
          name: z.string().min(1),
          route: z.string().min(1),
          accessRoles: z.array(z.string().min(1))
        })
        .strict()
    ),
    apiGroups: z.array(
      z
        .object({
          resource: z.string().min(1),
          actions: z.array(z.string().min(1))
        })
        .strict()
    ),
    dbEntities: z.array(
      z
        .object({
          name: z.string().min(1),
          fields: z.array(DbFieldSchema)
        })
        .strict()
    ),
    authModel: z
      .object({
        strategy: z.enum(["jwt", "session", "oauth"]),
        roles: z.array(z.string().min(1)),
        permissionsMatrix: z.record(z.string(), z.array(z.string()))
      })
      .strict(),
    assumptions: z.array(z.string().min(1))
  })
  .strict();

export type FieldType = z.infer<typeof FieldTypeEnum>;
export type DbField = z.infer<typeof DbFieldSchema>;
export type AppArchitectureSchema = z.infer<typeof AppArchitectureSchemaZod>;

export const AppArchitectureSchemaContract = `{
  "pages": [{ "name": string, "route": string, "accessRoles": string[] }],
  "apiGroups": [{ "resource": string, "actions": string[] }],
  "dbEntities": [{ "name": string, "fields": [{ "name": string, "type": "id|string|text|integer|number|float|boolean|date|datetime|json|enum", "required": boolean }] }],
  "authModel": {
    "strategy": "jwt|session|oauth",
    "roles": string[],
    "permissionsMatrix": { [role: string]: string[] }
  },
  "assumptions": string[]
}`;
