import { join } from '@std/path';
import Ajv from 'ajv';

import { LLMProvider as LLMProviderEnum } from '../../types.ts';
import type {
	LLMProviderMessageRequest,
	LLMProviderMessageResponse,
	LLMSpeakWithOptions,
	LLMTokenUsage,
	LLMValidateResponseCallback,
} from '../../types.ts';
import LLMMessage from '../message.ts';
import type { LLMMessageContentPart } from '../message.ts';
//import LLMTool from '../tool.ts';
import type { LLMToolInputSchema } from '../tool.ts';
import LLMConversation from '../conversation.ts';
import type { ProjectInfo } from '../conversation.ts';
import { logger } from 'shared/logger.ts';
import { config } from 'shared/configManager.ts';
import { ErrorType, LLMErrorOptions } from '../../errors/error.ts';
import { createError } from '../../utils/error.utils.ts';
//import { metricsService } from '../../services/metrics.service.ts';
import kv from '../../utils/kv.utils.ts';
import { tokenUsageManager } from '../../utils/tokenUsage.utils.ts';
import { ProjectEditor } from '../../editor/projectEditor.ts';

const ajv = new Ajv();

class LLM {
	public llmProviderName: LLMProviderEnum = LLMProviderEnum.ANTHROPIC;
	public maxSpeakRetries: number = 3;
	public requestCacheExpiry: number = 3 * (1000 * 60 * 60 * 24); // 3 days in milliseconds
	public projectEditor: ProjectEditor;
	//protected projectRoot: string;

	constructor(projectEditor: ProjectEditor) {
		this.projectEditor = projectEditor;
	}

	async prepareMessageParams(
		conversation: LLMConversation,
		speakOptions?: LLMSpeakWithOptions,
	): Promise<object> {
		throw new Error("Method 'prepareMessageParams' must be implemented.");
	}

	async speakWith(
		messageParams: LLMProviderMessageRequest,
	): Promise<LLMProviderMessageResponse> {
		throw new Error("Method 'speakWith' must be implemented.");
	}

	protected checkStopReason(llmProviderMessageResponse: LLMProviderMessageResponse): void {
		throw new Error("Method 'checkStopReason' must be implemented.");
	}

	protected modifySpeakWithConversationOptions(
		conversation: LLMConversation,
		speakOptions: LLMSpeakWithOptions,
		validationFailedReason: string,
	): void {
		// Default implementation, can be overridden by subclasses
	}

	async createConversation(): Promise<LLMConversation> {
		const conversation = new LLMConversation(this);
		await conversation.init();
		return conversation;
	}

	/*
	// you should probably be using ProjectEditor to load conversations
	async loadConversation(conversationId: string): Promise<LLMConversation> {
		const persistence = new ConversationPersistence(conversationId, this.projectEditor);
		await persistence.init();
		const conversation = await persistence.loadConversation(this);
		return conversation;
	}
	 */

	protected async createFileXmlString(filePath: string): Promise<string | null> {
		try {
			logger.info('createFileXmlString - filePath', filePath);
			//const fullFilePath = join(this.projectEditor.projectRoot, filePath);
			//logger.info('createFileXmlString - fullFilePath', fullFilePath);
			const content = await this.projectEditor.readProjectFileContent(filePath);
			const metadata = {
				size: new TextEncoder().encode(content).length,
				lastModified: new Date(),
			};
			return `<file path="${filePath}" size="${metadata.size}" last_modified="${metadata.lastModified.toISOString()}">\n${content}\n</file>`;
		} catch (error) {
			logger.error(`Error creating XML string for ${filePath}: ${error.message}`);
			//throw createError(ErrorType.FileHandling, `Failed to create xmlString for ${filePath}`, {
			//	filePath,
			//	operation: 'write',
			//} as FileHandlingErrorOptions);
		}
		return null;
	}

	protected appendProjectInfoToSystem(
		system: string,
		projectInfo: ProjectInfo,
	): string {
		if (projectInfo.type === 'ctags') {
			system += `\n\n<project-details>\n<ctags>\n${projectInfo.content}\n</ctags>\n</project-details>`;
		} else if (projectInfo.type === 'file-listing') {
			system +=
				`\n\n<project-details>\n<file-listing>\n${projectInfo.content}\n</file-listing>\n</project-details>`;
		}
		return system;
	}

	protected async appendFilesToSystem(system: string, conversation: LLMConversation): Promise<string> {
		for (const filePath of conversation.getSystemPromptFiles()) {
			const fileXml = await this.createFileXmlString(filePath);
			if (fileXml) {
				system += `\n\n${fileXml}`;
			}
		}
		return system;
	}

	protected async hydrateMessages(conversation: LLMConversation, messages: LLMMessage[]): Promise<LLMMessage[]> {
		const processContentPart = async <T extends LLMMessageContentPart>(contentPart: T): Promise<T> => {
			if (contentPart.type === 'text' && contentPart.text.startsWith('File added:')) {
				const filePath = contentPart.text.split(': ')[1].trim();
				logger.error(`Hydrating message for file: ${filePath} - extracted from: ${contentPart.text}`);

				const fileXml = await this.createFileXmlString(filePath);
				return fileXml ? { ...contentPart, text: fileXml } as T : contentPart;
			}
			if (contentPart.type === 'tool_result' && Array.isArray(contentPart.content)) {
				const updatedContent = await Promise.all(contentPart.content.map(processContentPart));
				return { ...contentPart, content: updatedContent } as T;
			}
			return contentPart;
		};

		const processMessage = async (message: LLMMessage): Promise<LLMMessage | null> => {
			if (!message || typeof message !== 'object') {
				logger.error(`Invalid message encountered: ${JSON.stringify(message)}`);
				return null;
			}
			if (message.role === 'user') {
				const updatedContent = await Promise.all(message.content.map(processContentPart));
				return { ...message, content: updatedContent };
			}
			return message;
		};

		const processedMessages = await Promise.all(messages.map(processMessage));
		return processedMessages.filter((message): message is LLMMessage => message !== null);
	}

	protected createRequestCacheKey(
		messageParams: LLMProviderMessageRequest,
	): string[] {
		const cacheKey = ['messageRequest', this.llmProviderName, JSON.stringify(messageParams)];
		logger.info(`provider[${this.llmProviderName}] using cache key: ${cacheKey}`);
		return cacheKey;
	}

	public async speakWithPlus(
		conversation: LLMConversation,
		speakOptions?: LLMSpeakWithOptions,
	): Promise<LLMProviderMessageResponse> {
		//const start = Date.now();

		const llmProviderMessageRequest = await this.prepareMessageParams(
			conversation,
			speakOptions,
		) as LLMProviderMessageRequest;

		let llmProviderMessageResponse!: LLMProviderMessageResponse;

		const cacheKey = !config.api?.ignoreLLMRequestCache
			? this.createRequestCacheKey(llmProviderMessageRequest)
			: [];
		if (!config.api?.ignoreLLMRequestCache) {
			const cachedResponse = await kv.get<LLMProviderMessageResponse>(cacheKey);

			if (cachedResponse && cachedResponse.value) {
				logger.info(`provider[${this.llmProviderName}] speakWithPlus: Using cached response`);
				llmProviderMessageResponse = cachedResponse.value;
				llmProviderMessageResponse.fromCache = true;
				//await metricsService.recordCacheMetrics({ operation: 'hit' });
			} else {
				//await metricsService.recordCacheMetrics({ operation: 'miss' });
			}
		}

		if (!llmProviderMessageResponse) {
			const maxRetries = this.maxSpeakRetries;
			let retries = 0;
			let delay = 1000; // Start with a 1-second delay

			while (retries < maxRetries) {
				try {
					llmProviderMessageResponse = await this.speakWith(llmProviderMessageRequest);

					const status = llmProviderMessageResponse.providerMessageResponseMeta.status;

					if (status >= 200 && status < 300) {
						break; // Successful response, break out of the retry loop
					} else if (status === 429) {
						// Rate limit exceeded
						const rateLimit = llmProviderMessageResponse.rateLimit.requestsResetDate.getTime() - Date.now();
						const waitTime = Math.max(rateLimit, delay);
						logger.warn(`Rate limit exceeded. Waiting for ${waitTime}ms before retrying.`);
						await new Promise((resolve) => setTimeout(resolve, waitTime));
					} else if (status >= 500) {
						// Server error, use exponential backoff
						logger.warn(`Server error (${status}). Retrying in ${delay}ms.`);
						await new Promise((resolve) => setTimeout(resolve, delay));
						delay *= 2; // Double the delay for next time
					} else {
						// For other errors, throw and don't retry
						throw createError(
							ErrorType.LLM,
							`Error calling LLM service: ${llmProviderMessageResponse.providerMessageResponseMeta.statusText}`,
							{
								model: conversation.model,
								provider: this.llmProviderName,
								args: { status },
								conversationId: conversation.id,
							} as LLMErrorOptions,
						);
					}

					retries++;
				} catch (error) {
					// Handle any unexpected errors
					throw createError(
						ErrorType.LLM,
						`Unexpected error calling LLM service: ${error.message}`,
						{
							model: conversation.model,
							provider: this.llmProviderName,
							args: { reason: error },
							conversationId: conversation.id,
						} as LLMErrorOptions,
					);
				}
			}

			if (retries >= maxRetries) {
				throw createError(
					ErrorType.LLM,
					'Max retries reached when calling LLM service.',
					{
						model: conversation.model,
						provider: this.llmProviderName,
						args: { retries: maxRetries },
						conversationId: conversation.id,
					} as LLMErrorOptions,
				);
			}

			//const latency = Date.now() - start;
			//await metricsService.recordLLMMetrics({
			//	provider: this.llmProviderName,
			//	latency,
			//	tokenUsage: llmProviderMessageResponse.usage.totalTokens,
			//	error: llmProviderMessageResponse.type === 'error' ? 'LLM request failed' : undefined,
			//});

			await this.updateTokenUsage(llmProviderMessageResponse.usage);

			if (llmProviderMessageResponse.isTool) {
				llmProviderMessageResponse.toolsUsed = llmProviderMessageResponse.toolsUsed || [];
				this.extractToolUse(llmProviderMessageResponse);
			} else {
				const answerPart = llmProviderMessageResponse.answerContent[0] as LLMMessageContentPart;
				if ('text' in answerPart) {
					llmProviderMessageResponse.answer = answerPart.text;
				}
			}

			// Create and save the assistant's message
			const assistantMessage = new LLMMessage(
				'assistant',
				llmProviderMessageResponse.answerContent,
				undefined,
				llmProviderMessageResponse,
			);
			conversation.addMessage(assistantMessage);

			llmProviderMessageResponse.fromCache = false;

			if (!config.api?.ignoreLLMRequestCache) {
				await kv.set(cacheKey, llmProviderMessageResponse, { expireIn: this.requestCacheExpiry });
				//await metricsService.recordCacheMetrics({ operation: 'set' });
			}
		}

		return llmProviderMessageResponse;
	}

	public async speakWithRetry(
		conversation: LLMConversation,
		speakOptions?: LLMSpeakWithOptions,
	): Promise<LLMProviderMessageResponse> {
		const maxRetries = this.maxSpeakRetries;
		const retrySpeakOptions = { ...speakOptions };
		let retries = 0;
		let failReason = '';
		let totalProviderRequests = 0;
		const totalTokenUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };

		while (retries < maxRetries) {
			retries++;
			totalProviderRequests++;
			try {
				const llmProviderMessageResponse = await this.speakWithPlus(conversation, retrySpeakOptions);

				totalTokenUsage.inputTokens += llmProviderMessageResponse.usage.inputTokens;
				totalTokenUsage.outputTokens += llmProviderMessageResponse.usage.outputTokens;
				totalTokenUsage.totalTokens += llmProviderMessageResponse.usage.totalTokens;

				const validationFailedReason = this.validateResponse(
					llmProviderMessageResponse,
					conversation,
					retrySpeakOptions.validateResponseCallback,
				);

				if (validationFailedReason === null) {
					conversation.updateTotals(totalTokenUsage, totalProviderRequests);
					//await conversation.save(); // Persist the conversation after successful response
					return llmProviderMessageResponse;
				}

				this.modifySpeakWithConversationOptions(conversation, retrySpeakOptions, validationFailedReason);

				failReason = `validation: ${validationFailedReason}`;
			} catch (error) {
				logger.error(
					`provider[${this.llmProviderName}] speakWithRetry: Error calling speakWithPlus`,
					error,
				);
				failReason = `caught error: ${error}`;
			}
			logger.warn(
				`provider[${this.llmProviderName}] Request to ${this.llmProviderName} failed. Retrying (${retries}/${maxRetries}) - ${failReason}`,
			);

			await new Promise((resolve) => setTimeout(resolve, 1000));
		}

		conversation.updateTotals(totalTokenUsage, totalProviderRequests);
		//await conversation.save(); // Persist the conversation even if all retries failed
		logger.error(
			`provider[${this.llmProviderName}] Max retries reached. Request to ${this.llmProviderName} failed.`,
		);
		throw createError(
			ErrorType.LLM,
			'Request failed after multiple retries.',
			{
				model: conversation.model,
				provider: this.llmProviderName,
				args: { reason: failReason, retries: { max: maxRetries, current: retries } },
				conversationId: conversation.id,
			} as LLMErrorOptions,
		);
	}

	protected validateResponse(
		llmProviderMessageResponse: LLMProviderMessageResponse,
		conversation: LLMConversation,
		validateCallback?: LLMValidateResponseCallback,
	): string | null {
		if (
			llmProviderMessageResponse.isTool &&
			llmProviderMessageResponse.toolsUsed &&
			llmProviderMessageResponse.toolsUsed.length > 0
		) {
			for (const toolUse of llmProviderMessageResponse.toolsUsed) {
				const tool = conversation.getTool(toolUse.toolName ?? '');
				//logger.error(`Validating Tool: ${toolUse.toolName}`);
				if (tool) {
					if (llmProviderMessageResponse.messageStop.stopReason === 'max_tokens') {
						logger.error(`Tool input exceeded max tokens`);
						return `Tool exceeded max tokens`;
					}

					const inputSchema: LLMToolInputSchema = tool.input_schema;
					const validate = ajv.compile(inputSchema);
					const valid = validate(toolUse.toolInput);
					//logger.error(`Tool is valid: ${toolUse.toolName}`);
					if (!valid) {
						logger.error(`Tool input validation failed: ${ajv.errorsText(validate.errors)}`);
						return `Tool input validation failed: ${ajv.errorsText(validate.errors)}`;
					}
				} else {
					logger.error(`Tool not found: ${toolUse.toolName}`);
					return `Tool not found: ${toolUse.toolName}`;
				}
			}
		}

		if (validateCallback) {
			const validationFailed = validateCallback(llmProviderMessageResponse, conversation);
			if (validationFailed) {
				logger.error(`Callback validation failed: ${validationFailed}`);
				return validationFailed;
			}
		}

		return null;
	}

	protected extractToolUse(llmProviderMessageResponse: LLMProviderMessageResponse): void {
		let currentToolThinking = '';

		llmProviderMessageResponse.answerContent.forEach((answerPart: LLMMessageContentPart, index: number) => {
			if (answerPart.type === 'text') {
				currentToolThinking += answerPart.text;
			} else if (answerPart.type === 'tool_use') {
				llmProviderMessageResponse.toolsUsed!.push({
					toolInput: answerPart.input,
					toolUseId: answerPart.id,
					toolName: answerPart.name,
					toolThinking: currentToolThinking,
				});
				currentToolThinking = '';
			}

			// if the last/final content part is type text, then add to toolThinking of last tool in toolsUsed
			if (index === llmProviderMessageResponse.answerContent.length - 1 && answerPart.type === 'text') {
				llmProviderMessageResponse.toolsUsed![llmProviderMessageResponse.toolsUsed!.length - 1].toolThinking +=
					answerPart.text;
			}
		});
	}

	private async updateTokenUsage(usage: LLMTokenUsage): Promise<void> {
		const currentUsage = await tokenUsageManager.getTokenUsage(this.llmProviderName);
		if (currentUsage) {
			const updatedUsage = {
				...currentUsage,
				requestsRemaining: currentUsage.requestsRemaining - 1,
				tokensRemaining: currentUsage.tokensRemaining - usage.totalTokens,
			};
			await tokenUsageManager.updateTokenUsage(this.llmProviderName, updatedUsage);
		}
	}
}

export default LLM;
