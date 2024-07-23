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
import type { LLMMessageContentPart, LLMMessageContentParts } from '../message.ts';
import LLMTool from '../tool.ts';
import type { LLMToolInputSchema } from '../tool.ts';
import LLMConversation from '../conversation.ts';
import { logger } from 'shared/logger.ts';
import { config } from 'shared/configManager.ts';
import { ErrorType, LLMErrorOptions } from '../../errors/error.ts';
import { createError } from '../../utils/error.utils.ts';
//import { metricsService } from '../../services/metrics.service.ts';
import kv from '../../utils/kv.utils.ts';
import { tokenUsageManager } from '../../utils/tokenUsage.utils.ts';
import { ProjectEditor } from '../../editor/projectEditor.ts';
import { ConversationPersistence } from '../../utils/conversationPersistence.utils.ts';
import { readFileContent } from 'shared/dataDir.ts';

const ajv = new Ajv();

class LLM {
	public providerName: LLMProviderEnum = LLMProviderEnum.ANTHROPIC;
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

	protected modifySpeakWithConversationOptions(
		conversation: LLMConversation,
		speakOptions: LLMSpeakWithOptions,
		validationFailedReason: string,
	): void {
		// Default implementation, can be overridden by subclasses
	}

	createConversation(): LLMConversation {
		return new LLMConversation(this);
	}

	async loadConversation(conversationId: string): Promise<LLMConversation> {
		const persistence = new ConversationPersistence(conversationId, this.projectEditor);
		await persistence.init();
		const conversation = await LLMConversation.resume(conversationId, this);
		return conversation;
	}

	protected async readProjectFileContent(filePath: string): Promise<string> {
		const fullFilePath = join(await this.projectEditor.getProjectRoot(), filePath);
		const content = await readFileContent(fullFilePath);
		if (content === null) {
			throw new Error(`File not found: ${fullFilePath}`);
		}
		return content;
	}

	protected async createFileXmlString(filePath: string): Promise<string | null> {
		try {
			logger.info('createFileXmlString - filePath', filePath);
			const fullFilePath = join(await this.projectEditor.getProjectRoot(), filePath);
			logger.info('createFileXmlString - fullFilePath', fullFilePath);
			const content = await this.readProjectFileContent(filePath);
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

	protected async appendCtagsToSystem(system: string, ctagsContent: string | null): Promise<string> {
		if (ctagsContent) {
			system += `\n\n<ctags>\n${ctagsContent}\n</ctags>`;
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
		const processContentPart = async (contentPart: LLMMessageContentPart): Promise<LLMMessageContentPart> => {
			if (contentPart.type === 'text' && contentPart.text.startsWith('File added:')) {
				const filePath = contentPart.text.split(': ')[1].trim();
				const fileXml = await this.createFileXmlString(filePath);
				return fileXml ? { type: 'text', text: fileXml } : contentPart;
			}
			if (contentPart.type === 'tool_result' && Array.isArray(contentPart.content)) {
				const updatedContent = await Promise.all(contentPart.content.map(processContentPart));
				return { ...contentPart, content: updatedContent as (LLMMessageContentPartTextBlock | LLMMessageContentPartImageBlock | LLMMessageContentPartToolUseBlock | LLMMessageContentPartToolResultBlock)[] };
			}
			return contentPart;
		};

		const processMessage = async (message: LLMMessage): Promise<LLMMessage> => {
			if (message.role === 'user') {
				const updatedContent = await Promise.all(message.content.map(processContentPart));
				return { ...message, content: updatedContent };
			}
			return message;
		};

		return Promise.all(messages.map(processMessage));
	}

	protected createRequestCacheKey(
		messageParams: LLMProviderMessageRequest,
	): string[] {
		const cacheKey = ['messageRequest', this.providerName, JSON.stringify(messageParams)];
		logger.info(`provider[${this.providerName}] using cache key: ${cacheKey}`);
		return cacheKey;
	}

	public async speakWithPlus(
		conversation: LLMConversation,
		speakOptions?: LLMSpeakWithOptions,
	): Promise<LLMProviderMessageResponse> {
		const start = Date.now();

		const llmProviderMessageRequest = await this.prepareMessageParams(
			conversation,
			speakOptions,
		) as LLMProviderMessageRequest;

		let llmProviderMessageResponse: LLMProviderMessageResponse | undefined;
		let llmProviderMessageRequestId: string;

		const cacheKey = !config.api?.ignoreLLMRequestCache
			? this.createRequestCacheKey(llmProviderMessageRequest)
			: [];
		if (!config.api?.ignoreLLMRequestCache) {
			const cachedResponse = await kv.get<LLMProviderMessageResponse>(cacheKey);

			if (cachedResponse && cachedResponse.value) {
				logger.info(`provider[${this.providerName}] speakWithPlus: Using cached response`);
				llmProviderMessageResponse = cachedResponse.value;
				llmProviderMessageResponse.fromCache = true;
				//await metricsService.recordCacheMetrics({ operation: 'hit' });
			} else {
				//await metricsService.recordCacheMetrics({ operation: 'miss' });
			}
		}

		if (!llmProviderMessageResponse) {
			llmProviderMessageResponse = await this.speakWith(llmProviderMessageRequest);

			//const latency = Date.now() - start;
			//await metricsService.recordLLMMetrics({
			//	provider: this.providerName,
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
				llmProviderMessageResponse.answer = answerPart?.text;
			}

			llmProviderMessageResponse.fromCache = false;

			if (!config.api?.ignoreLLMRequestCache) {
				await kv.set(cacheKey, llmProviderMessageResponse, { expireIn: this.requestCacheExpiry });
				//await metricsService.recordCacheMetrics({ operation: 'set' });
			}
		}

		// Remove these lines as they are not needed
		// const { max_tokens: maxTokens, ...llmProviderMessageRequestDesnaked } = llmProviderMessageRequest;
		// llmProviderMessageRequestId = await conversation.llmProviderMessageRequestRepository
		// 	.createLLMProviderMessageRequest({
		// 		...llmProviderMessageRequestDesnaked,
		// 		maxTokens,
		// 		prompt: conversation.currentPrompt,
		// 		conversationId: conversation.repoRecId,
		// 		conversationTurnCount: conversation.turnCount,
		// 	});

		// const { id: _id, ...llmProviderMessageResponseWithoutId } = llmProviderMessageResponse;
		// await conversation.llmProviderMessageResponseRepository.createLLMProviderMessageResponse({
		// 	...llmProviderMessageResponseWithoutId,
		// 	conversationId: conversation.repoRecId,
		// 	conversationTurnCount: conversation.turnCount,
		// 	providerRequestId: llmProviderMessageRequestId,
		// 	apiResponseId: llmProviderMessageResponse.id,
		// });

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
		let totalTokenUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
		let totalProviderRequests = 0;

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
					await conversation.save(); // Persist the conversation after successful response
					return llmProviderMessageResponse;
				}

				this.modifySpeakWithConversationOptions(conversation, retrySpeakOptions, validationFailedReason);

				failReason = `validation: ${validationFailedReason}`;
			} catch (error) {
				logger.error(
					`provider[${this.providerName}] speakWithRetry: Error calling speakWithPlus`,
					error,
				);
				failReason = `caught error: ${error}`;
			}
			logger.warn(
				`provider[${this.providerName}] Request to ${this.providerName} failed. Retrying (${retries}/${maxRetries}) - ${failReason}`,
			);

			await new Promise((resolve) => setTimeout(resolve, 1000));
		}

		conversation.updateTotals(totalTokenUsage, totalProviderRequests);
		await conversation.save(); // Persist the conversation even if all retries failed
		logger.error(
			`provider[${this.providerName}] Max retries reached. Request to ${this.providerName} failed.`,
		);
		throw createError(
			ErrorType.LLM,
			'Request failed after multiple retries.',
			{
				model: conversation.model,
				provider: this.providerName,
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
				if (tool) {
					const inputSchema: LLMToolInputSchema = tool.input_schema;
					const validate = ajv.compile(inputSchema);
					const valid = validate(toolUse.toolInput);
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

			if (index === llmProviderMessageResponse.answerContent.length - 1 && answerPart.type === 'text') {
				llmProviderMessageResponse.toolsUsed![llmProviderMessageResponse.toolsUsed!.length - 1].toolThinking +=
					answerPart.text;
			}
		});
	}

	private async updateTokenUsage(usage: LLMTokenUsage): Promise<void> {
		const currentUsage = await tokenUsageManager.getTokenUsage(this.providerName);
		if (currentUsage) {
			const updatedUsage = {
				...currentUsage,
				requestsRemaining: currentUsage.requestsRemaining - 1,
				tokensRemaining: currentUsage.tokensRemaining - usage.totalTokens,
			};
			await tokenUsageManager.updateTokenUsage(this.providerName, updatedUsage);
		}
	}
}

export default LLM;
