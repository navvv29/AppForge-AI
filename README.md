# AppForge AI

> A multi-stage AI app generation compiler that converts natural language into strict, validated, executable application configurations.

**Live URL:** [https://appforge-ai-hvco.onrender.com](https://appforge-ai-hvco.onrender.com)  
**Repository:** [https://github.com/navvv29/AppForge-AI](https://github.com/navvv29/AppForge-AI)

---

## Architecture

AppForge AI is an engineered system — not a prompt wrapper. It operates like a compiler with discrete stages, strict schema contracts, and automatic repair.

```
Natural Language → Stage 1 (Intent) → Stage 2 (Architecture) → Stage 3 (Schema) → Stage 4 (Refinement) → Simulation → FullAppSchema
```

### Pipeline Stages

| Stage | Purpose | Output |
|-------|---------|--------|
| **Stage 1: Intent Extraction** | Parse entities, features, roles, integrations, ambiguities | `IntentSchema` |
| **Stage 2: System Design** | Convert intent → pages, API groups, DB entities, auth model | `AppArchitectureSchema` |
| **Stage 3: Schema Generation** | Generate full UI, API, DB, Auth, Business Logic configs | `FullAppSchema` |
| **Stage 4: Refinement** | Cross-layer consistency resolution and repair | `FullAppSchema` (refined) |
| **Simulation** | Validate executability across all layers | `SimulationReport` |

### Output Schema (FullAppSchema)

- **uiConfig** — Pages, routes, layouts, components with data bindings
- **apiConfig** — Endpoints with methods, auth, request/response fields
- **dbSchema** — Tables with typed columns and relations
- **authConfig** — JWT/session/OAuth strategy, roles, route guards, permission rules
- **businessLogic** — Feature flags, access gates, computed fields

## Validation & Repair Engine

Each stage output is validated against strict Zod schemas. On failure:

1. **JSON Repair** — Strip code fences, fix smart quotes, remove trailing commas, quote unquoted keys
2. **Field Type Normalization** — Map `varchar`→`string`, `timestamp`→`datetime`, `bool`→`boolean`, etc.
3. **Constrained Retry** — Re-prompt with specific error messages (not blind retry)
4. **Cross-Layer Resolution** — Auto-create missing endpoints, tables, columns, roles, feature flags

## Failure Handling

- **Vague prompts** → Reasonable defaults with documented assumptions
- **Conflicting requirements** → Detected and logged in RepairLog with clarification requests
- **Underspecified inputs** → Inferred from keyword analysis with assumptions list

## Tech Stack

- **Runtime:** Node.js 20+ / TypeScript / Express
- **LLM Providers:** Groq (llama-3.3-70b), OpenAI (gpt-4o), Anthropic (claude-3.7-sonnet)
- **Schema Validation:** Zod 4 (strict mode)
- **Deterministic Fallback:** Full mock generation pipeline for zero-cost testing

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check |
| `GET` | `/ai-status` | Current AI provider info |
| `POST` | `/generate` | Generate app schema from prompt |
| `POST` | `/eval/single` | Fast vs quality mode comparison |

### POST /generate

```json
// Request
{ "prompt": "Build a CRM with login and payments", "mode": "fast" }

// Response
{ "fullAppSchema": {...}, "repairLog": {...}, "simulationReport": {...}, "metrics": {...} }
```

## Evaluation Framework

**20 test prompts:** 10 real products (Suite A) + 10 edge cases (Suite B)

**Suite A:** CRM, Blog, E-commerce, Project Management, Booking, HR, LMS, Support Tickets, Analytics, Multi-tenant B2B

**Suite B:** Vague ("Build me an app"), Conflicting ("Everyone is admin AND no one can delete"), Incomplete, Overloaded, Privilege conflicts, Technically impossible

**Tracked metrics:** Success rate, retries, failure types, latency, token usage, cost

## Running Locally

```bash
# Install
npm ci

# Dev mode (with hot reload)
npm run dev -- "Build a CRM with login and payments"

# API server
npm run api

# Build for production
npm run build
npm start

# Run evaluation suite
npm run eval
```

### Environment Variables

```env
LLM_PROVIDER=groq          # groq | openai | anthropic
GROQ_API_KEY=gsk_...       # Required for Groq
OPENAI_API_KEY=sk-...      # Required for OpenAI
ANTHROPIC_API_KEY=sk-ant-  # Required for Anthropic
PORT=3000                  # Server port
```

## Cost vs Quality Tradeoffs

| Mode | Provider | Model | Latency | Cost | Quality |
|------|----------|-------|---------|------|---------|
| **fast** | Groq | llama-3.1-8b-instant | ~2s | ~$0.001 | Good |
| **quality** | Groq | llama-3.3-70b-versatile | ~8s | ~$0.005 | High |
| **quality** | OpenAI | gpt-4o | ~15s | ~$0.05 | Very High |

## Project Structure

```
src/
├── api/           # Express server
├── llm/           # Multi-provider LLM client
├── pipeline/      # 4-stage generation pipeline
│   ├── stage1-intent.ts
│   ├── stage2-architect.ts
│   ├── stage3-schema.ts
│   ├── stage4-refine.ts
│   └── generator.ts
├── schemas/       # Zod schema definitions
├── validation/    # JSON repair + field normalization
├── runtime/       # Simulator, API compiler, DB migrator
└── eval/          # Evaluation framework
```
