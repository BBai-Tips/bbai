import { LLMResponse, VectorEmbedding } from "../../shared/types.ts";
import { logger } from "../utils/logger.ts";
import { config } from "../config/config.ts";
import { createError } from "../utils/error.utils.ts";
import { ErrorType, LLMErrorOptions } from "../errors/error.ts";
import { LLMProvider as LLMProviderEnum, OpenAIModel, AnthropicModel } from "../types.ts";
import type { 
  LLMProviderMessageRequest, 
  LLMProviderMessageResponse, 
  LLMSpeakWithOptions,
  LLMTokenUsage,
  LLMValidateResponseCallback
} from "../types.ts";

import LLMMessage, { 
  LLMMessageContentPart, 
  LLMMessageContentParts, 
  LLMMessageProviderResponse 
} from "./message.ts";
import LLMTool, { LLMToolInputSchema } from "./tool.ts";
import LLMConversation from "./conversation.ts";

abstract class LLM {
  public providerName: LLMProviderEnum = LLMProviderEnum.ANTHROPIC;
  public maxSpeakRetries: number = 3;
  public requestCacheExpiry: number = 3 * (1000 * 60 * 60 * 24); // 3 days in milliseconds

  abstract prepareMessageParams(
    conversation: LLMConversation,
    speakOptions?: LLMSpeakWithOptions
  ): object;

  abstract speakWith(
    messageParams: LLMProviderMessageRequest
  ): Promise<LLMProviderMessageResponse>;

  createConversation(): LLMConversation {
    return new LLMConversation(this);
  }

  protected createRequestCacheKey(
    messageParams: LLMProviderMessageRequest
  ): string[] {
    // Implementation of createRequestCacheKey
    // ...
  }

  public async speakWithPlus(
    conversation: LLMConversation,
    speakOptions?: LLMSpeakWithOptions
  ): Promise<LLMProviderMessageResponse> {
    // Implementation of speakWithPlus
    // ...
  }

  public async speakWithRetry(
    conversation: LLMConversation,
    speakOptions?: LLMSpeakWithOptions
  ): Promise<LLMProviderMessageResponse> {
    // Implementation of speakWithRetry
    // ...
  }

  protected validateResponse(
    llmProviderMessageResponse: LLMProviderMessageResponse,
    conversation: LLMConversation,
    validateCallback?: LLMValidateResponseCallback
  ): string | null {
    // Implementation of validateResponse
    // ...
  }

  protected abstract modifySpeakWithConversationOptions(
    conversation: LLMConversation,
    speakOptions: LLMSpeakWithOptions,
    validationFailedReason: string
  ): void;

  protected extractToolUse(llmProviderMessageResponse: LLMProviderMessageResponse): void {
    // Implementation of extractToolUse
    // ...
  }

  private async updateTokenUsage(usage: LLMTokenUsage): Promise<void> {
    // Implementation of updateTokenUsage
    // ...
  }

  protected abstract checkStopReason(
    llmProviderMessageResponse: LLMProviderMessageResponse
  ): void;
}

class AnthropicLLM extends LLM {
  private apiKey: string;

  constructor() {
    super();
    this.providerName = LLMProviderEnum.ANTHROPIC;
    this.apiKey = config.CLAUDE_API_KEY;
    if (!this.apiKey) {
      throw new Error("Claude API key is not set");
    }
  }

  // Implement abstract methods and add Anthropic-specific logic
  // ...
}

class OpenAILLM extends LLM {
  private apiKey: string;

  constructor() {
    super();
    this.providerName = LLMProviderEnum.OPENAI;
    this.apiKey = config.OPENAI_API_KEY;
    if (!this.apiKey) {
      throw new Error("OpenAI API key is not set");
    }
  }

  // Implement abstract methods and add OpenAI-specific logic
  // ...
}

export class LLMFactory {
  static getProvider(providerName: string): LLM {
    switch (providerName.toLowerCase()) {
      case "claude":
        return new AnthropicLLM();
      case "openai":
        return new OpenAILLM();
      default:
        throw new Error(`Unsupported LLM provider: ${providerName}`);
    }
  }
}
