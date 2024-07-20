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
import Anthropic from "anthropic";

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
  private anthropic: Anthropic;

  constructor() {
    super();
    this.providerName = LLMProviderEnum.ANTHROPIC;
    const apiKey = config.CLAUDE_API_KEY;
    if (!apiKey) {
      throw new Error("Claude API key is not set");
    }
    this.anthropic = new Anthropic({ apiKey });
  }

  private asProviderMessageType(messages: LLMMessage[]): Anthropic.MessageParam[] {
    return messages.map((message) => ({
      role: message.role,
      content: message.content,
    }));
  }

  private asProviderToolType(tools: LLMTool[]): Anthropic.Tool[] {
    return tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.input_schema,
    }));
  }

  private asApiMessageContentPartsType(content: Anthropic.Content[]): LLMMessageContentParts {
    return content.map((part) => {
      if (typeof part === 'string') {
        return { type: 'text', text: part };
      } else if (part.type === 'image') {
        return {
          type: 'image',
          source: {
            type: 'base64',
            media_type: part.source.media_type,
            data: part.source.data,
          },
        };
      }
      return part;
    });
  }

  public prepareMessageParams(
    conversation: LLMConversation,
    speakOptions?: LLMSpeakWithOptions
  ): Anthropic.MessageCreateParams {
    const messages = this.asProviderMessageType(speakOptions?.messages || conversation.getMessages());
    const tools = this.asProviderToolType(speakOptions?.tools || conversation.getTools());
    const system = speakOptions?.system || conversation.system;
    const model = speakOptions?.model || conversation.model || AnthropicModel.CLAUDE_3_5_SONNET;
    const maxTokens = speakOptions?.maxTokens || conversation.maxTokens;
    const temperature = speakOptions?.temperature || conversation.temperature;

    return {
      messages,
      tools,
      system,
      model,
      max_tokens: maxTokens,
      temperature,
      stream: false,
    };
  }

  public async speakWith(
    messageParams: LLMProviderMessageRequest
  ): Promise<LLMProviderMessageResponse> {
    try {
      logger.dir('llms-anthropic-speakWith-messageParams', messageParams);

      const { data: anthropicMessageStream, response: anthropicResponse } = await this.anthropic.messages.create(
        messageParams as Anthropic.MessageCreateParams
      ).withResponse();

      const anthropicMessage = anthropicMessageStream as Anthropic.Message;
      logger.dir('llms-anthropic-anthropicMessage', anthropicMessage);

      const headers = anthropicResponse?.headers;

      const messageResponse: LLMProviderMessageResponse = {
        id: anthropicMessage.id,
        type: anthropicMessage.type,
        role: anthropicMessage.role,
        model: anthropicMessage.model,
        fromCache: false,
        answerContent: this.asApiMessageContentPartsType(anthropicMessage.content),
        isTool: anthropicMessage.stop_reason === 'tool_use',
        messageStop: {
          stopReason: anthropicMessage.stop_reason,
          stopSequence: anthropicMessage.stop_sequence,
        },
        usage: {
          inputTokens: anthropicMessage.usage.input_tokens,
          outputTokens: anthropicMessage.usage.output_tokens,
          totalTokens: anthropicMessage.usage.input_tokens + anthropicMessage.usage.output_tokens,
        },
        rateLimit: {
          requestsRemaining: Number(headers.get('anthropic-ratelimit-requests-remaining')),
          requestsLimit: Number(headers.get('anthropic-ratelimit-requests-limit')),
          requestsResetDate: new Date(headers.get('anthropic-ratelimit-requests-reset') || ''),
          tokensRemaining: Number(headers.get('anthropic-ratelimit-tokens-remaining')),
          tokensLimit: Number(headers.get('anthropic-ratelimit-tokens-limit')),
          tokensResetDate: new Date(headers.get('anthropic-ratelimit-tokens-reset') || ''),
        },
        providerMessageResponseMeta: {
          status: anthropicResponse.status,
          statusText: anthropicResponse.statusText,
        },
      };

      return messageResponse;
    } catch (err) {
      logger.console.critical('Error calling Anthropic API', err);
      throw createError(
        ErrorType.LLM,
        'Could not get response from Anthropic API.',
        {
          model: messageParams.model,
          provider: this.providerName,
        } as LLMErrorOptions,
      );
    }
  }

  protected modifySpeakWithConversationOptions(
    conversation: LLMConversation,
    speakOptions: LLMSpeakWithOptions,
    validationFailedReason: string
  ): void {
    if (validationFailedReason.startsWith('Tool input validation failed')) {
      const prevMessage = conversation.getLastMessage();
      if (prevMessage && prevMessage.providerResponse && prevMessage.providerResponse.isTool) {
        conversation.addMessage({
          role: 'user',
          content: [
            {
              type: 'tool_result',
              is_error: true,
              tool_use_id: prevMessage.providerResponse.toolsUsed![0].toolUseId,
              content: [
                {
                  'type': 'text',
                  'text': "The previous tool input was invalid. Please provide a valid input according to the tool's schema",
                },
              ],
            },
          ],
        });
      } else {
        logger.console.warn(
          `provider[${this.providerName}] modifySpeakWithConversationOptions - Tool input validation failed, but no tool response found`,
        );
      }
    } else if (validationFailedReason === 'Empty answer') {
      speakOptions.temperature = speakOptions.temperature ? Math.min(speakOptions.temperature + 0.1, 1) : 0.5;
    }
  }

  protected checkStopReason(llmProviderMessageResponse: LLMProviderMessageResponse): void {
    if (llmProviderMessageResponse.messageStop.stopReason) {
      switch (llmProviderMessageResponse.messageStop.stopReason) {
        case 'max_tokens':
          logger.console.warn(`provider[${this.providerName}] Response reached the maximum token limit`);
          break;
        case 'end_turn':
          logger.console.warn(`provider[${this.providerName}] Response reached the end turn`);
          break;
        case 'stop_sequence':
          logger.console.warn(`provider[${this.providerName}] Response reached its natural end`);
          break;
        case 'tool_use':
          logger.console.warn(`provider[${this.providerName}] Response is using a tool`);
          break;
        default:
          logger.console.info(
            `provider[${this.providerName}] Response stopped due to: ${llmProviderMessageResponse.messageStop.stopReason}`,
          );
      }
    }
  }
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
