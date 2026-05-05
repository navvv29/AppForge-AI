import { z } from "zod";

export const RepairEntrySchema = z
  .object({
    stage: z.enum(["stage1", "stage2", "stage3", "stage4", "validator", "simulator"]),
    issue: z.string().min(1),
    fix: z.string().min(1),
    retries: z.number().int().min(0)
  })
  .strict();

export const RepairLogSchema = z
  .object({
    entries: z.array(RepairEntrySchema),
    totalRetries: z.number().int().min(0),
    clarificationRequired: z.array(z.string().min(1)).default([])
  })
  .strict();

export const SimulationReportSchema = z
  .object({
    passed: z.boolean(),
    issues: z.array(z.string().min(1))
  })
  .strict();

export const FailureTypeSchema = z.enum([
  "validation",
  "hallucination",
  "mismatch",
  "ambiguity"
]);

export type RepairEntry = z.infer<typeof RepairEntrySchema>;
export type RepairLog = z.infer<typeof RepairLogSchema>;
export type SimulationReport = z.infer<typeof SimulationReportSchema>;
export type FailureType = z.infer<typeof FailureTypeSchema>;

export const RepairLogContract = `{
  "entries": [{ "stage": "stage1|stage2|stage3|stage4|validator|simulator", "issue": string, "fix": string, "retries": number }],
  "totalRetries": number,
  "clarificationRequired": string[]
}`;
