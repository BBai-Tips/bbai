import { LLMProvider as LLMProviderEnum } from "../../shared/types.ts";
import type { 
  LLMProviderMessageRequest, 
  LLMProviderMessageResponse, 
  LLMSpeakWithOptions,
  LLMTokenUsage,
  LLMValidateResponseCallback
} from "../../shared/types.ts";
import LLMConversation from "../conversation.ts";
import { logger } from "../../utils/logger.ts";

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

export default LLM;
