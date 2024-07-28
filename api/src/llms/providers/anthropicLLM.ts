import Anthropic from 'anthropic';
import type { ClientOptions } from 'anthropic';

import { AnthropicModel, LLMCallbackType, LLMProvider } from '../../types.ts';
import LLM from './baseLLM.ts';
import LLMInteraction from '../interactions/baseInteraction.ts';
import LLMMessage, { LLMMessageContentParts } from '../message.ts';
import type { LLMMessageContentPartTextBlock, LLMMessageContentPartToolResultBlock } from '../message.ts';
import LLMTool from '../tool.ts';
import { createError } from '../../utils/error.utils.ts';
import { ErrorType, LLMErrorOptions } from '../../errors/error.ts';
import { logger } from 'shared/logger.ts';
import { config } from 'shared/configManager.ts';
import type {
	LLMCallbacks,
	LLMProviderMessageRequest,
	LLMProviderMessageResponse,
	LLMSpeakWithOptions,
	LLMSpeakWithResponse,
} from '../../types.ts';

class AnthropicLLM extends LLM {
	private anthropic!: Anthropic;

	constructor(callbacks: LLMCallbacks) {
		super(callbacks);
		this.llmProviderName = LLMProvider.ANTHROPIC;

		this.initializeAnthropicClient();
	}

	private initializeAnthropicClient() {
		const clientOptions: ClientOptions = {
			apiKey: config.api?.anthropicApiKey,
		};
		this.anthropic = new Anthropic(clientOptions);
	}

	private asProviderMessageType(messages: LLMMessage[]): Anthropic.MessageParam[] {
		return messages.map((message) => ({
			role: message.role,
			content: message.content,
		} as Anthropic.MessageParam));
	}

	private asProviderToolType(tools: Map<string, LLMTool>): Anthropic.Tool[] {
		return Array.from(tools.values()).map((tool) => ({
			name: tool.name,
			description: tool.description,
			input_schema: tool.input_schema,
		} as Anthropic.Tool));
	}

	async prepareMessageParams(
		interaction: LLMInteraction,
		speakOptions?: LLMSpeakWithOptions,
	): Promise<Anthropic.MessageCreateParams> {
		const system = await this.invoke(
			LLMCallbackType.PREPARE_SYSTEM_PROMPT,
			speakOptions?.system || interaction.baseSystem,
		);

		const messages = this.asProviderMessageType(
			await this.invoke(LLMCallbackType.PREPARE_MESSAGES, speakOptions?.messages || interaction.getMessages()),
		);

		const tools = this.asProviderToolType(
			await this.invoke(LLMCallbackType.PREPARE_TOOLS, speakOptions?.tools || interaction.allTools()),
		);

		const model: string = speakOptions?.model || interaction.model || AnthropicModel.CLAUDE_3_5_SONNET;
		const maxTokens: number = speakOptions?.maxTokens || interaction.maxTokens;
		const temperature: number = speakOptions?.temperature || interaction.temperature;

		const messageParams: Anthropic.MessageCreateParams = {
			messages,
			tools,
			system,
			model,
			max_tokens: maxTokens,
			temperature,
			stream: false,
		};

		return messageParams;
	}

	/**
	 * Run Anthropic service
	 * @param interaction LLMInteraction
	 * @param speakOptions LLMSpeakWithOptions
	 * @returns Promise<LLMProviderMessageResponse> The response from Anthropic or an error
	 */
	public async speakWith(
		messageParams: LLMProviderMessageRequest,
	): Promise<LLMSpeakWithResponse> {
		try {
			//logger.info('llms-anthropic-speakWith-messageParams', messageParams);

			const { data: anthropicMessageStream, response: anthropicResponse } = await this.anthropic.messages.create(
				messageParams as Anthropic.MessageCreateParams,
				{
					headers: { 'anthropic-beta': 'max-tokens-3-5-sonnet-2024-07-15' },
				},
			).withResponse();

			const anthropicMessage = anthropicMessageStream as Anthropic.Message;
			//logger.info('llms-anthropic-anthropicMessage', anthropicMessage);

			const headers = anthropicResponse?.headers;

			const requestsRemaining = Number(headers.get('anthropic-ratelimit-requests-remaining'));
			const requestsLimit = Number(headers.get('anthropic-ratelimit-requests-limit'));
			const requestsResetDate = new Date(headers.get('anthropic-ratelimit-requests-reset') || '');

			const tokensRemaining = Number(headers.get('anthropic-ratelimit-tokens-remaining'));
			const tokensLimit = Number(headers.get('anthropic-ratelimit-tokens-limit'));
			const tokensResetDate = new Date(headers.get('anthropic-ratelimit-tokens-reset') || '');

			const messageResponse: LLMProviderMessageResponse = {
				id: anthropicMessage.id,
				type: anthropicMessage.type,
				role: anthropicMessage.role,
				model: anthropicMessage.model,
				//system: messageParams.system,
				fromCache: false,
				timestamp: new Date().toISOString(),
				answerContent: anthropicMessage.content as LLMMessageContentParts,
				isTool: anthropicMessage.stop_reason === 'tool_use',
				messageStop: {
					stopReason: anthropicMessage.stop_reason,
					stopSequence: anthropicMessage.stop_sequence,
				},
				usage: {
					inputTokens: anthropicMessage.usage.input_tokens,
					outputTokens: anthropicMessage.usage.output_tokens,
					totalTokens: (anthropicMessage.usage.input_tokens + anthropicMessage.usage.output_tokens),
				},
				rateLimit: {
					requestsRemaining,
					requestsLimit,
					requestsResetDate,
					tokensRemaining,
					tokensLimit,
					tokensResetDate,
				},
				providerMessageResponseMeta: {
					status: anthropicResponse.status,
					statusText: anthropicResponse.statusText,
				},
			};
			//logger.debug("llms-anthropic-messageResponse", messageResponse);

			return { messageResponse, messageMeta: { system: messageParams.system } };
		} catch (err) {
			logger.error('Error calling Anthropic API', err);
			throw createError(
				ErrorType.LLM,
				'Could not get response from Anthropic API.',
				{
					model: messageParams.model,
					provider: this.llmProviderName,
				} as LLMErrorOptions,
			);
		}
	}

	protected modifySpeakWithInteractionOptions(
		interaction: LLMInteraction,
		speakOptions: LLMSpeakWithOptions,
		validationFailedReason: string,
	): void {
		// // [TODO] impelement keep speaking
		// // check stop reason, if it was max_tokens, then keep speaking
		// this.checkStopReason(prevMessage.providerResponse);

		if (validationFailedReason.startsWith('Tool input validation failed')) {
			// Prompt the model to provide a valid tool input
			const prevMessage = interaction.getLastMessage();
			if (prevMessage && prevMessage.providerResponse && prevMessage.providerResponse.isTool) {
				interaction.addMessage({
					role: 'user',
					//[TODO] we're assuming a single tool is provided, and we're assuming only a single tool is used by LLM
					content: [
						{
							type: 'tool_result',
							is_error: true,
							tool_use_id: prevMessage.providerResponse.toolsUsed![0].toolUseId,
							content: [
								{
									'type': 'text',
									'text':
										"The previous tool input was invalid. Please provide a valid input according to the tool's schema",
								} as LLMMessageContentPartTextBlock,
							],
						} as LLMMessageContentPartToolResultBlock,
					],
				});
			} else {
				logger.warn(
					`provider[${this.llmProviderName}] modifySpeakWithInteractionOptions - Tool input validation failed, but no tool response found`,
				);
			}
		} else if (validationFailedReason === 'Tool exceeded max tokens') {
			// Prompt the model to provide a smaller tool input
			interaction.addMessageForUserRole({
				'type': 'text',
				'text':
					'The previous tool input was too large. Please provide a smaller answer, and I will keep asking for more until I have all of it',
			} as LLMMessageContentPartTextBlock);
		} else if (validationFailedReason === 'Empty answer') {
			// Increase temperature or adjust other parameters to encourage more diverse responses
			speakOptions.temperature = speakOptions.temperature ? Math.min(speakOptions.temperature + 0.1, 1) : 0.5;
		}
	}

	protected checkStopReason(llmProviderMessageResponse: LLMProviderMessageResponse): void {
		// Check if the response has a stop reason
		if (llmProviderMessageResponse.messageStop.stopReason) {
			// Perform special handling based on the stop reason
			switch (llmProviderMessageResponse.messageStop.stopReason) {
				case 'max_tokens':
					logger.warn(`provider[${this.llmProviderName}] Response reached the maximum token limit`);

					break;
				case 'end_turn':
					logger.warn(`provider[${this.llmProviderName}] Response reached the end turn`);
					break;
				case 'stop_sequence':
					logger.warn(`provider[${this.llmProviderName}] Response reached its natural end`);
					break;
				case 'tool_use':
					logger.warn(`provider[${this.llmProviderName}] Response is using a tool`);
					break;
				default:
					logger.info(
						`provider[${this.llmProviderName}] Response stopped due to: ${llmProviderMessageResponse.messageStop.stopReason}`,
					);
			}
		}
	}
}

export default AnthropicLLM;
