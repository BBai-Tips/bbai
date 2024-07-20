import { LLMResponse } from "../../shared/types.ts";
import { logger } from "../utils/logger.ts";
import { config } from "../config/config.ts";

interface ClaudeAPIResponse {
  completion: string;
  stop_reason: string;
  model: string;
}

interface OpenAIAPIResponse {
  choices: Array<{ text: string }>;
  usage: {
    total_tokens: number;
  };
}

export interface LLMProvider {
  generateResponse(prompt: string): Promise<LLMResponse>;
}

class ClaudeProvider implements LLMProvider {
  private apiKey: string;

  constructor() {
    this.apiKey = config.CLAUDE_API_KEY;
    if (!this.apiKey) {
      throw new Error("Claude API key is not set");
    }
  }

  async generateResponse(prompt: string): Promise<LLMResponse> {
    logger.info("Generating response using Claude");
    
    const response = await fetch("https://api.anthropic.com/v1/complete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": this.apiKey,
      },
      body: JSON.stringify({
        prompt: prompt,
        model: "claude-v1",
        max_tokens_to_sample: 1000,
      }),
    });

    if (!response.ok) {
      throw new Error(`Claude API request failed: ${response.statusText}`);
    }

    const data: ClaudeAPIResponse = await response.json();

    return {
      text: data.completion.trim(),
      tokenUsage: data.completion.split(/\s+/).length, // Approximate token count
    };
  }
}

class OpenAIProvider implements LLMProvider {
  private apiKey: string;

  constructor() {
    this.apiKey = config.OPENAI_API_KEY;
    if (!this.apiKey) {
      throw new Error("OpenAI API key is not set");
    }
  }

  async generateResponse(prompt: string): Promise<LLMResponse> {
    logger.info("Generating response using OpenAI");
    
    const response = await fetch("https://api.openai.com/v1/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: "text-davinci-002",
        prompt: prompt,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API request failed: ${response.statusText}`);
    }

    const data: OpenAIAPIResponse = await response.json();

    return {
      text: data.choices[0].text.trim(),
      tokenUsage: data.usage.total_tokens,
    };
  }
}

export class LLMFactory {
  static getProvider(providerName: string): LLMProvider {
    switch (providerName.toLowerCase()) {
      case "claude":
        return new ClaudeProvider();
      case "openai":
        return new OpenAIProvider();
      default:
        throw new Error(`Unsupported LLM provider: ${providerName}`);
    }
  }
}
