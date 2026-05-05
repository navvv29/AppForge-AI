import "dotenv/config";
import { generateAppConfiguration } from "./pipeline/generator.js";

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const runApi = args.includes("--api");
  if (runApi) {
    await import("./api/index.js");
    return;
  }

  const mode = args.includes("--fast") ? "fast" : "quality";
  const prompt = args.filter((arg) => !arg.startsWith("--")).join(" ").trim();
  if (!prompt) {
    console.log('Usage: npm run dev -- "Build a CRM with login and payments" [--fast]');
    console.log("Or run API server: npm run api");
    return;
  }

  const result = await generateAppConfiguration(prompt, { mode });
  if (result.failed) {
    console.error(
      JSON.stringify(
        {
          failed: true,
          failureType: result.failureType,
          message: result.message,
          repairLog: result.repairLog
        },
        null,
        2
      )
    );
    process.exit(1);
  }

  console.log(
    JSON.stringify(
      {
        fullAppSchema: result.fullAppSchema,
        repairLog: result.repairLog,
        simulationReport: result.simulationReport,
        metrics: result.metrics
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
