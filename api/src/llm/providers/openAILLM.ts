import OpenAI from 'openai';
import { LLMProvider, OpenAIModel } from 'shared/types.ts';
import LLM from './baseLLM.ts';
import LLMConversation from '../conversation.ts';
import LLMMessage from '../message.ts';
import LLMTool from '../tool.ts';
import { createError } from '../../utils/error.utils.ts';
import { ErrorType, LLMErrorOptions } from '../../errors/error.ts';
import { logger } from 'shared/logger.ts';
import { config } from '../../config/config.ts';
import type { LLMProviderMessageRequest, LLMProviderMessageResponse, LLMSpeakWithOptions } from 'shared/types.ts';

class OpenAILLM extends LLM {
	private openai: OpenAI;

	constructor() {
		super();
		this.providerName = LLMProvider.OPENAI;
		const apiKey = config.OPENAI_API_KEY;
		if (!apiKey) {
			throw new Error('OpenAI API key is not set');
		}
		this.openai = new OpenAI({ apiKey });
	}

	private asProviderMessageType(messages: LLMMessage[]): OpenAI.Chat.ChatCompletionMessageParam[] {
		return messages.map((message) => {
			if (message.role === 'system' || message.role === 'user') {
				return {
					role: message.role,
					content: message.content.map(part => part.type === 'text' ? part.text : '').join(''),
				};
			} else if (message.role === 'assistant') {
				if (message.content[0].type === 'tool_use') {
					return {
						role: message.role,
						content: null,
						tool_calls: [{
							id: message.content[0].id,
							type: 'function',
							function: {
								name: message.content[0].name,
								arguments: JSON.stringify(message.content[0].input),
							},
						}],
					};
				} else {
					return {
						role: message.role,
						content: message.content.map(part => part.type === 'text' ? part.text : '').join(''),
					};
				}
			} else if (message.role === 'tool') {
				return {
					role: message.role,
					tool_call_id: message.tool_call_id,
					content: message.content.map(part => part.type === 'text' ? part.text : '').join(''),
				};
			}
			return {
				role: message.role,
				content: message.content.map(part => part.type === 'text' ? part.text : '').join(''),
			};
		});
	}

	private asProviderToolType(tools: LLMTool[]): OpenAI.Chat.ChatCompletionTool[] {
		return tools.map((tool) => ({
			type: 'function',
			function: {
				name: tool.name,
				description: tool.description,
				parameters: tool.input_schema,
			},
		}));
	}

	private asApiMessageContentPartsType(choices: OpenAI.Chat.ChatCompletion.Choice[]): LLMMessageContentParts {
		const contentParts: LLMMessageContentParts = [];
		const choice = choices[0];
		const message = choice.message;
		if (message.content) {
			contentParts.push({
				type: 'text',
				text: message.content,
			});
		}
		if (message.tool_calls) {
			contentParts.push({
				type: 'tool_calls',
				tool_calls: message.tool_calls.map(tool_call => ({
					id: tool_call.id,
					type: tool_call.type,
					function: {
						name: tool_call.function.name,
						arguments: tool_call.function.arguments,
					},
				})),
			});
		}
		return contentParts;
	}

	public prepareMessageParams(
		conversation: LLMConversation,
		speakOptions?: LLMSpeakWithOptions,
	): OpenAI.Chat.ChatCompletionCreateParams {
		const messages = this.asProviderMessageType(speakOptions?.messages || conversation.getMessages());
		const tools = this.asProviderToolType(speakOptions?.tools || conversation.getTools());
		const system = speakOptions?.system || conversation.system;
		const model = speakOptions?.model || conversation.model || OpenAIModel.GPT_4;
		const maxTokens = speakOptions?.maxTokens || conversation.maxTokens;
		const temperature = speakOptions?.temperature || conversation.temperature;
		const systemMessage: OpenAI.Chat.ChatCompletionSystemMessageParam = { role: 'system', content: system };

		return {
			messages: [systemMessage, ...messages],
			tools,
			model,
			max_tokens: maxTokens,
			temperature,
			stream: false,
		};
	}

	public async speakWith(
		messageParams: LLMProviderMessageRequest,
	): Promise<LLMProviderMessageResponse> {
		try {
			logger.debug('llms-openai-speakWith-messageParams', JSON.stringify(messageParams, null, 2));

			const { data: openaiMessageStream, response: openaiResponse } = await this.openai.chat.completions.create(
				messageParams as OpenAI.Chat.ChatCompletionCreateParams,
			).withResponse();

			const openaiMessage = openaiMessageStream as OpenAI.Chat.ChatCompletion;
			logger.debug('llms-openai-openaiMessage', JSON.stringify(openaiMessage, null, 2));

			const headers = openaiResponse?.headers;

			const messageResponse: LLMProviderMessageResponse = {
				id: openaiMessage.id,
				type: openaiMessage.object === 'chat.completion' ? 'message' : 'error',
				role: openaiMessage.choices[0].message.role,
				model: openaiMessage.model,
				fromCache: false,
				answerContent: this.asApiMessageContentPartsType(openaiMessage.choices),
				isTool: openaiMessage.choices[0].finish_reason === 'tool_calls',
				messageStop: {
					stopReason: openaiMessage.choices[0].finish_reason,
					stopSequence: null,
				},
				usage: {
					inputTokens: openaiMessage.usage?.prompt_tokens ?? 0,
					outputTokens: openaiMessage.usage?.completion_tokens ?? 0,
					totalTokens: openaiMessage.usage?.total_tokens ?? 0,
				},
				rateLimit: {
					requestsRemaining: Number(headers.get('x-ratelimit-remaining-requests')),
					requestsLimit: Number(headers.get('x-ratelimit-limit-requests')),
					requestsResetDate: new Date(Date.now() + Number(headers.get('x-ratelimit-reset-requests'))),
					tokensRemaining: Number(headers.get('x-ratelimit-remaining-tokens')),
					tokensLimit: Number(headers.get('x-ratelimit-limit-tokens')),
					tokensResetDate: new Date(Date.now() + Number(headers.get('x-ratelimit-reset-tokens'))),
				},
				providerMessageResponseMeta: {
					status: openaiResponse.status,
					statusText: openaiResponse.statusText,
				},
			};

			return messageResponse;
		} catch (err) {
			logger.error('Error calling OpenAI API', err);
			throw createError(
				ErrorType.LLM,
				'Could not get response from OpenAI API.',
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
			const prevMessage = conversation.getLastMessage();
			if (prevMessage && prevMessage.providerResponse && prevMessage.providerResponse.isTool) {
				conversation.addMessage({
					role: 'tool',
					tool_call_id: prevMessage.providerResponse.toolsUsed![0].toolUseId,
					content: [
						{
							'type': 'text',
							'text':
								"The previous tool input was invalid. Please provide a valid input according to the tool's schema",
						},
					],
				});
			} else {
				logger.warn(
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
				case 'length':
					logger.warn(`provider[${this.providerName}] Response reached the maximum token limit`);
					break;
				case 'stop':
					logger.warn(`provider[${this.providerName}] Response reached its natural end`);
					break;
				case 'content_filter':
					logger.warn(
						`provider[${this.providerName}] Response content was omitted due to a flag from provider content filters`,
					);
					break;
				case 'tool_calls':
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

export default OpenAILLM;
