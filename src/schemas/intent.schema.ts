import { z } from "zod";

export const IntentSchemaZod = z
  .object({
    entities: z.array(z.string().min(1)),
    features: z.array(z.string().min(1)),
    roles: z.array(z.string().min(1)),
    integrations: z.array(z.string().min(1)),
    ambiguities: z.array(z.string().min(1))
  })
  .strict();

export type IntentSchema = z.infer<typeof IntentSchemaZod>;

export const IntentSchemaContract = `{
  "entities": string[],
  "features": string[],
  "roles": string[],
  "integrations": string[],
  "ambiguities": string[]
}`;
