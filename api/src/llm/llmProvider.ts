import { LLMResponse } from "../../shared/types.ts";
import { logger } from "../utils/logger.ts";

export interface LLMProvider {
  generateResponse(prompt: string): Promise<LLMResponse>;
}

class ClaudeProvider implements LLMProvider {
  async generateResponse(prompt: string): Promise<LLMResponse> {
    // TODO: Implement actual Claude API call
    logger.info("Generating response using Claude");
    return {
      text: `Mock response for: ${prompt}`,
      tokenUsage: prompt.split(" ").length, // Mock token usage
    };
  }
}

class OpenAIProvider implements LLMProvider {
  async generateResponse(prompt: string): Promise<LLMResponse> {
    // TODO: Implement actual OpenAI API call
    logger.info("Generating response using OpenAI");
    return {
      text: `Mock response for: ${prompt}`,
      tokenUsage: prompt.split(" ").length, // Mock token usage
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
