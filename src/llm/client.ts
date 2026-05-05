import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

export type RunMode = "fast" | "quality";
export type StageName = "stage1" | "stage2" | "stage3" | "stage4";
export type Provider = "openai" | "anthropic" | "mock";

export interface LLMUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  latencyMs: number;
  costUsd: number;
}

export interface LLMCallResult {
  text: string;
  usage: LLMUsage;
  provider: Provider;
  model: string;
}

type ModelProfile = {
  model: string;
  maxOutputTokens: number;
  inputRatePerMillion: number;
  outputRatePerMillion: number;
};

const OPENAI_PROFILES: Record<RunMode, ModelProfile> = {
  fast: {
    model: "gpt-4o-mini",
    maxOutputTokens: 2500,
    inputRatePerMillion: 0.15,
    outputRatePerMillion: 0.6
  },
  quality: {
    model: "gpt-4o",
    maxOutputTokens: 6000,
    inputRatePerMillion: 2.5,
    outputRatePerMillion: 10
  }
};

const ANTHROPIC_PROFILES: Record<RunMode, ModelProfile> = {
  fast: {
    model: "claude-3-5-haiku-latest",
    maxOutputTokens: 2500,
    inputRatePerMillion: 0.8,
    outputRatePerMillion: 4
  },
  quality: {
    model: "claude-3-7-sonnet-latest",
    maxOutputTokens: 6000,
    inputRatePerMillion: 3,
    outputRatePerMillion: 15
  }
};

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

function estimateCost(inputTokens: number, outputTokens: number, profile: ModelProfile): number {
  const inputCost = (inputTokens / 1_000_000) * profile.inputRatePerMillion;
  const outputCost = (outputTokens / 1_000_000) * profile.outputRatePerMillion;
  return Number((inputCost + outputCost).toFixed(6));
}

export function estimateModeCost(mode: RunMode, inputTokens: number, outputTokens: number): number {
  const profile = OPENAI_PROFILES[mode];
  return estimateCost(inputTokens, outputTokens, profile);
}

export class LLMClient {
  readonly provider: Provider;
  private readonly openai?: OpenAI;
  private readonly anthropic?: Anthropic;

  constructor() {
    const configuredProvider = process.env.LLM_PROVIDER?.toLowerCase();
    if (configuredProvider === "anthropic" && process.env.ANTHROPIC_API_KEY) {
      this.provider = "anthropic";
    } else if (configuredProvider === "openai" && process.env.OPENAI_API_KEY) {
      this.provider = "openai";
    } else if (process.env.OPENAI_API_KEY) {
      this.provider = "openai";
    } else if (process.env.ANTHROPIC_API_KEY) {
      this.provider = "anthropic";
    } else {
      this.provider = "mock";
    }

    if (this.provider === "openai") {
      this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    }
    if (this.provider === "anthropic") {
      this.anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    }
  }

  isMock(): boolean {
    return this.provider === "mock";
  }

  async generateJson(systemPrompt: string, userPrompt: string, mode: RunMode): Promise<LLMCallResult> {
    if (this.provider === "openai") {
      return this.generateWithOpenAI(systemPrompt, userPrompt, mode);
    }
    if (this.provider === "anthropic") {
      return this.generateWithAnthropic(systemPrompt, userPrompt, mode);
    }
    return this.generateMock(systemPrompt, userPrompt);
  }

  private async generateWithOpenAI(systemPrompt: string, userPrompt: string, mode: RunMode): Promise<LLMCallResult> {
    const profile = OPENAI_PROFILES[mode];
    const started = Date.now();

    const response = await this.openai!.responses.create({
      model: profile.model,
      temperature: 0,
      max_output_tokens: profile.maxOutputTokens,
      input: [
        {
          role: "system",
          content: [{ type: "input_text", text: systemPrompt }]
        },
        {
          role: "user",
          content: [{ type: "input_text", text: userPrompt }]
        }
      ]
    });

    const text = (response as { output_text?: string }).output_text ?? "";
    const usage = (response as { usage?: Record<string, number> }).usage;
    const inputTokens = usage?.input_tokens ?? usage?.prompt_tokens ?? estimateTokens(systemPrompt + userPrompt);
    const outputTokens = usage?.output_tokens ?? usage?.completion_tokens ?? estimateTokens(text);
    const latencyMs = Date.now() - started;
    const costUsd = estimateCost(inputTokens, outputTokens, profile);

    return {
      text,
      provider: "openai",
      model: profile.model,
      usage: {
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        latencyMs,
        costUsd
      }
    };
  }

  private async generateWithAnthropic(systemPrompt: string, userPrompt: string, mode: RunMode): Promise<LLMCallResult> {
    const profile = ANTHROPIC_PROFILES[mode];
    const started = Date.now();

    const response = await this.anthropic!.messages.create({
      model: profile.model,
      temperature: 0,
      max_tokens: profile.maxOutputTokens,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }]
    });

    const text = response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n");
    const inputTokens = response.usage?.input_tokens ?? estimateTokens(systemPrompt + userPrompt);
    const outputTokens = response.usage?.output_tokens ?? estimateTokens(text);
    const latencyMs = Date.now() - started;
    const costUsd = estimateCost(inputTokens, outputTokens, profile);

    return {
      text,
      provider: "anthropic",
      model: profile.model,
      usage: {
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        latencyMs,
        costUsd
      }
    };
  }

  private generateMock(systemPrompt: string, userPrompt: string): LLMCallResult {
    const inputTokens = estimateTokens(systemPrompt + userPrompt);
    return {
      text: "{}",
      provider: "mock",
      model: "deterministic-mock",
      usage: {
        inputTokens,
        outputTokens: 0,
        totalTokens: inputTokens,
        latencyMs: 0,
        costUsd: 0
      }
    };
  }
}
