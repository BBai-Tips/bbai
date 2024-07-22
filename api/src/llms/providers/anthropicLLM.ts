import Anthropic from 'anthropic';
import type { ClientOptions } from 'anthropic';

import { AnthropicModel, LLMProvider } from '../../types.ts';
import LLM from './baseLLM.ts';
import LLMConversation from '../conversation.ts';
import LLMMessage, { LLMMessageContentParts } from '../message.ts';
import type {
	LLMMessageContentPart,
	LLMMessageContentPartTextBlock,
	LLMMessageContentPartToolResultBlock,
} from '../message.ts';
import LLMTool from '../tool.ts';
import { createError } from '../../utils/error.utils.ts';
import { ErrorType, LLMErrorOptions } from '../../errors/error.ts';
import { logger } from 'shared/logger.ts';
import { config } from 'shared/configManager.ts';
import type { LLMProviderMessageRequest, LLMProviderMessageResponse, LLMSpeakWithOptions } from '../../types.ts';
import { ProjectEditor } from '../../editor/projectEditor.ts';

class AnthropicLLM extends LLM {
	private anthropic!: Anthropic;

	constructor(projectEditor: ProjectEditor) {
		super(projectEditor);
		this.providerName = LLMProvider.ANTHROPIC;

		this.initializeAnthropicClient();
	}

	private async initializeAnthropicClient() {
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
		conversation: LLMConversation,
		speakOptions?: LLMSpeakWithOptions,
	): Promise<Anthropic.MessageCreateParams> {
		let system = speakOptions?.system || conversation.baseSystem;
		system = await this.appendCtagsToSystem(system, conversation.ctagsContent);
		system = await this.appendFilesToSystem(system, conversation);

		const messages = this.asProviderMessageType(
			await this.hydrateMessages(
				conversation,
				speakOptions?.messages || conversation.getMessages(),
			),
		);

		const tools = this.asProviderToolType(speakOptions?.tools || conversation.allTools());

		const model: string = speakOptions?.model || conversation.model || AnthropicModel.CLAUDE_3_5_SONNET;
		const maxTokens: number = speakOptions?.maxTokens || conversation.maxTokens;
		const temperature: number = speakOptions?.temperature || conversation.temperature;

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
	 * @param conversation LLMConversation
	 * @param speakOptions LLMSpeakWithOptions
	 * @returns Promise<LLMProviderMessageResponse> The response from Anthropic or an error
	 */
	public async speakWith(
		messageParams: LLMProviderMessageRequest,
	): Promise<LLMProviderMessageResponse> {
		try {
			//logger.info('llms-anthropic-speakWith-messageParams', messageParams);

			const { data: anthropicMessageStream, response: anthropicResponse } = await this.anthropic.messages.create(
				messageParams as Anthropic.MessageCreateParams,
			).withResponse();

			const anthropicMessage = anthropicMessageStream as Anthropic.Message;
			logger.info('llms-anthropic-anthropicMessage', anthropicMessage);

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
				fromCache: false,
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

			return messageResponse;
		} catch (err) {
			logger.error('Error calling Anthropic API', err);
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
		validationFailedReason: string,
	): void {
		if (validationFailedReason.startsWith('Tool input validation failed')) {
			// Prompt the model to provide a valid tool input
			const prevMessage = conversation.getLastMessage();
			if (prevMessage && prevMessage.providerResponse && prevMessage.providerResponse.isTool) {
				conversation.addMessage({
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
					`provider[${this.providerName}] modifySpeakWithConversationOptions - Tool input validation failed, but no tool response found`,
				);
			}
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
					logger.warn(`provider[${this.providerName}] Response reached the maximum token limit`);
					break;
				case 'end_turn':
					logger.warn(`provider[${this.providerName}] Response reached the end turn`);
					break;
				case 'stop_sequence':
					logger.warn(`provider[${this.providerName}] Response reached its natural end`);
					break;
				case 'tool_use':
					logger.warn(`provider[${this.providerName}] Response is using a tool`);
					break;
				default:
					logger.info(
						`provider[${this.providerName}] Response stopped due to: ${llmProviderMessageResponse.messageStop.stopReason}`,
					);
			}
		}
	}
}

export default AnthropicLLM;
