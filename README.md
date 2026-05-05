# AppForge AI

AppForge AI is a multi-stage "compiler for software generation" that turns a natural language product prompt into a strict, validated, executable `FullAppSchema`.

## What it builds

- **4-stage generation pipeline** (mandatory staged architecture)
  1. `stage1-intent.ts` → `IntentSchema`
  2. `stage2-architect.ts` → `AppArchitectureSchema`
  3. `stage3-schema.ts` → `FullAppSchema`
  4. `stage4-refine.ts` → refined `FullAppSchema`
- **Validation + repair engine** after every stage
  - JSON repair (brackets/quotes/trailing commas/fences)
  - required field validation (targeted stage retry only)
  - field-type normalization to allowed enum values
  - no blind full retries
- **Consistency + execution awareness**
  - Stage 4 cross-layer repairs (UI ↔ API ↔ DB ↔ Auth)
  - Simulator (`src/runtime/simulator.ts`) produces `SimulationReport`
  - Conflict-aware handling: conflicting clauses are surfaced in `repairLog.clarificationRequired` while non-conflicting sections continue
- **Delivery surfaces**
  - API: `POST /generate`
  - frontend: `public/index.html`
  - CLI eval runner: `npm run eval`

## Contracts (strict schemas)

Defined via Zod + TypeScript in `src/schemas`:

- `IntentSchema`
- `AppArchitectureSchema`
- `FullAppSchema`
- `RepairLog`
- `SimulationReport`

All LLM stage prompts include the target schema contract and enforce JSON-only output.

## Project structure

```
src
  pipeline
    stage1-intent.ts
    stage2-architect.ts
    stage3-schema.ts
    stage4-refine.ts
    generator.ts
  validation
    validator.ts
    repair.ts
  schemas
    intent.schema.ts
    architecture.schema.ts
    app.schema.ts
    repair.schema.ts
  runtime
    simulator.ts
    api-runner.ts
    db-migrator.ts
  eval
    eval-runner.ts
    test-prompts.ts
    metrics.ts
  api
    index.ts
  index.ts
public
  index.html
```

## Modes and tradeoffs

- `fast`: lower-cost profile, single-pass refinement behavior
- `quality`: larger model profile, stricter multi-pass retries + second-pass consistency enforcement

Each run logs estimated `tokensUsed` and `costUsd`.

## Setup

1. Install dependencies
   - `npm install`
2. Configure one provider
   - OpenAI:
     - `OPENAI_API_KEY=...`
     - optional: `LLM_PROVIDER=openai`
   - Anthropic:
     - `ANTHROPIC_API_KEY=...`
     - optional: `LLM_PROVIDER=anthropic`
3. Without API keys, the system runs deterministic mock generation for local simulation.

## Run

- Start API server:
  - `npm run api`
- Open frontend:
  - `http://localhost:3000`
- CLI single prompt:
  - `npm run dev -- "Build a CRM with login, contacts, dashboard, role-based access, and premium plan with payments."`
  - add fast mode: `--fast`
- Evaluation runner:
  - `npm run eval`
  - outputs markdown tables to console and JSON metrics to `eval-output/metrics.json`

## Free live deployment

This project needs a Node server because the browser calls `POST /generate`. GitHub Pages is useful for static HTML/CSS/JS only, so deploy the repository to a free Render Web Service for a working live URL.

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "prepare free deployment"
gh repo create appforge-ai --public --source=. --remote=origin --push
```

### 2. Deploy on Render

1. Go to Render and create a new Blueprint or Web Service from the GitHub repository.
2. If using the included `render.yaml`, Render will use:
   - build command: `npm ci && npm run build`
   - start command: `npm start`
   - health check: `/health`
3. Render will publish the app at `https://appforge-ai.onrender.com` if that service name is available, or at the generated `https://<service-name>.onrender.com` URL after the first successful deploy.
4. Add `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` in Render environment variables when you want real LLM output. Without keys, the app still runs with deterministic mock generation.

## API contract

### `POST /generate`

Request:

```json
{ "prompt": "Build a CRM with login, contacts, dashboard, role-based access, and premium plan with payments.", "mode": "quality" }
```

Response:

```json
{
  "mode": "quality",
  "fullAppSchema": {},
  "repairLog": { "entries": [], "totalRetries": 0, "clarificationRequired": [] },
  "simulationReport": { "passed": true, "issues": [] },
  "metrics": { "mode": "quality", "provider": "openai", "model": "gpt-4o", "tokensUsed": 0, "latencyMs": 0, "costUsd": 0 }
}
```

If ambiguity/validation fails twice at any stage, it returns clarification-required output for that failing stage only.
