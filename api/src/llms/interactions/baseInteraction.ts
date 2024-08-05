import type { LLMSpeakWithOptions, LLMSpeakWithResponse, LLMTokenUsage } from '../../types.ts';
import LLM from '../providers/baseLLM.ts';
import { LLMCallbackType } from 'api/types.ts';
import { ConversationId, ConversationMetrics, TokenUsage } from 'shared/types.ts';
import type {
	LLMMessageContentPart,
	LLMMessageContentPartImageBlock,
	LLMMessageContentParts,
	LLMMessageContentPartTextBlock,
	LLMMessageContentPartToolResultBlock,
	LLMMessageProviderResponse,
} from '../llmMessage.ts';
import LLMMessage from 'api/llms/llmMessage.ts';
import LLMTool from '../llmTool.ts';
import { ConversationLogger, ConversationLoggerEntryType } from 'shared/conversationLogger.ts';
import { crypto } from '@std/crypto';
import { logger } from 'shared/logger.ts';

class LLMInteraction {
	public id: string;
	protected _turnCount: number = 0;
	protected llm: LLM;
	protected messages: LLMMessage[] = [];
	protected tools: Map<string, LLMTool> = new Map();
	protected _baseSystem: string = '';
	public conversationLogger!: ConversationLogger;

	private _model: string = '';

	protected _maxTokens: number = 8192;
	protected _temperature: number = 0.2;
	protected _totalTokenUsage: LLMTokenUsage = { totalTokens: 0, inputTokens: 0, outputTokens: 0 };
	protected _totalProviderRequests: number = 0;
	protected _currentPrompt: string = '';

	constructor(llm: LLM, conversationId?: ConversationId) {
		this.id = conversationId ?? LLMInteraction.generateShortId();
		this.llm = llm;
	}

	public async init(): Promise<LLMInteraction> {
		try {
			const projectRoot = await this.llm.invoke(LLMCallbackType.PROJECT_ROOT);
			const logEntryHandler = async (
				type: ConversationLoggerEntryType,
				timestamp: string,
				content: string,
				conversationStats: ConversationMetrics,
				tokenUsage: TokenUsage,
			) => {
				await this.llm.invoke(
					LLMCallbackType.LOG_ENTRY_HANDLER,
					type,
					timestamp,
					content,
					conversationStats,
					tokenUsage,
				);
			};
			this.conversationLogger = await new ConversationLogger(projectRoot, this.id, logEntryHandler).init();
		} catch (error) {
			logger.error('Failed to initialize LLMConversationInteraction:', error);
			throw error;
		}
		return this;
	}

	public prepareSytemPrompt(_system: string): Promise<string> {
		throw new Error("Method 'prepareSytemPrompt' must be implemented.");
	}
	public prepareMessages(_messages: LLMMessage[]): Promise<LLMMessage[]> {
		throw new Error("Method 'prepareMessages' must be implemented.");
	}
	public prepareTools(_tools: LLMTool[]): Promise<LLMTool[]> {
		throw new Error("Method 'prepareTools' must be implemented.");
	}

	protected static generateShortId(): string {
		const uuid = crypto.randomUUID();
		return uuid.replace(/-/g, '').substring(0, 8);
	}

	public addMessageForUserRole(content: LLMMessageContentPart | LLMMessageContentParts): string {
		const lastMessage = this.getLastMessage();
		//logger.debug('lastMessage for user', lastMessage);
		//this.conversationLogger?.logUserMessage(content);
		if (lastMessage && lastMessage.role === 'user') {
			// Append content to the content array of the last user message
			//logger.debug('Adding content to existing user message', JSON.stringify(content, null, 2));
			if (Array.isArray(content)) {
				lastMessage.content.push(...content);
			} else {
				lastMessage.content.push(content);
			}
			return lastMessage.id ?? '';
		} else {
			// Add a new user message
			//logger.debug('Adding content to new user message', JSON.stringify(content, null, 2));
			const newMessage = new LLMMessage('user', Array.isArray(content) ? content : [content]);
			this.addMessage(newMessage);
			return newMessage.id ?? '';
		}
	}

	public addMessageForAssistantRole(
		content: LLMMessageContentPart | LLMMessageContentParts,
		tool_call_id?: string,
		providerResponse?: LLMMessageProviderResponse,
	): string {
		const lastMessage = this.getLastMessage();
		//logger.debug('lastMessage for assistant', lastMessage);
		//this.conversationLogger?.logAssistantMessage(content);
		if (lastMessage && lastMessage.role === 'assistant') {
			logger.error('Why are we adding another assistant message - SOMETHING IS WRONG!');
			// Append content to the content array of the last assistant message
			//logger.debug('Adding content to existing assistant message', JSON.stringify(content, null, 2));
			if (Array.isArray(content)) {
				lastMessage.content.push(...content);
			} else {
				lastMessage.content.push(content);
			}
			return lastMessage.id ?? '';
		} else {
			// Add a new assistant message
			//logger.debug('Adding content to new assistant message', JSON.stringify(content, null, 2));
			const newMessage = new LLMMessage(
				'assistant',
				Array.isArray(content) ? content : [content],
				tool_call_id,
				providerResponse,
			);
			this.addMessage(newMessage);
			return newMessage.id ?? '';
		}
	}

	public addMessageForToolResult(
		toolUseId: string,
		content: string | LLMMessageContentPart | LLMMessageContentParts,
		isError: boolean = false,
	): string {
		const toolResult = {
			type: 'tool_result',
			tool_use_id: toolUseId,
			content: Array.isArray(content) ? content : [
				typeof content !== 'string' ? content : {
					'type': 'text',
					'text': content,
				} as LLMMessageContentPartTextBlock,
			],
			is_error: isError,
		} as LLMMessageContentPartToolResultBlock;

		if (isError) {
			this.conversationLogger?.logError(`Tool Result (${toolUseId}): ${content}`);
		} else {
			this.conversationLogger?.logToolResult(toolUseId, content);
		}

		const lastMessage = this.getLastMessage();
		if (lastMessage && lastMessage.role === 'user') {
			// Check if there's an existing tool result with the same toolUseId
			const existingToolResultIndex = lastMessage.content.findIndex(
				(part): part is LLMMessageContentPartToolResultBlock =>
					part.type === 'tool_result' && part.tool_use_id === toolUseId,
			);

			if (existingToolResultIndex !== -1) {
				// Update existing tool result
				const existingToolResult = lastMessage
					.content[existingToolResultIndex] as LLMMessageContentPartToolResultBlock;
				if (existingToolResult.content && Array.isArray(existingToolResult.content)) {
					existingToolResult.content.push(
						...(Array.isArray(toolResult.content)
							? toolResult.content as (LLMMessageContentPartTextBlock | LLMMessageContentPartImageBlock)[]
							: toolResult.content && 'type' in toolResult.content &&
									((toolResult.content as LLMMessageContentPart).type === 'text' ||
										(toolResult.content as LLMMessageContentPart).type === 'image')
							? [toolResult.content as LLMMessageContentPartTextBlock | LLMMessageContentPartImageBlock]
							: []),
					);
				} else {
					existingToolResult.content = Array.isArray(toolResult.content)
						? toolResult.content as (LLMMessageContentPartTextBlock | LLMMessageContentPartImageBlock)[]
						: toolResult.content && 'type' in toolResult.content &&
								((toolResult.content as LLMMessageContentPart).type === 'text' ||
									(toolResult.content as LLMMessageContentPart).type === 'image')
						? [toolResult.content as LLMMessageContentPartTextBlock | LLMMessageContentPartImageBlock]
						: [];
				}
				existingToolResult.is_error = existingToolResult.is_error || isError;
				logger.debug('Updating existing tool result', JSON.stringify(toolResult, null, 2));
				return lastMessage.id ?? '';
			} else {
				// Add new tool result to existing user message
				logger.debug('Adding new tool result to existing user message', JSON.stringify(toolResult, null, 2));
				lastMessage.content.push(toolResult);
				return lastMessage.id ?? '';
			}
		} else {
			// Add a new user message with the tool result
			logger.debug('Adding new user message with tool result', JSON.stringify(toolResult, null, 2));
			const newMessage = new LLMMessage('user', [toolResult]);
			this.addMessage(newMessage);
			return newMessage.id ?? '';
		}
	}

	public addMessage(message: Omit<LLMMessage, 'timestamp'> | LLMMessage): void {
		let completeMessage: LLMMessage;
		if (message instanceof LLMMessage) {
			completeMessage = message;
			completeMessage.setTimestamp();
		} else {
			completeMessage = new LLMMessage(
				message.role,
				message.content,
				message.tool_call_id,
				message.providerResponse,
				message.id,
			);
		}
		this.messages.push(completeMessage);
	}

	public getMessages(): LLMMessage[] {
		return this.messages;
	}

	public getLastMessage(): LLMMessage {
		return this.messages.slice(-1)[0];
	}

	public getId(): string {
		return this.id;
	}

	public getLastMessageContent(): LLMMessageContentParts | undefined {
		const lastMessage = this.getLastMessage();
		return lastMessage?.content;
	}

	public clearMessages(): void {
		this.messages = [];
	}

	get llmProviderName(): string {
		return this.llm.llmProviderName;
	}

	get currentPrompt(): string {
		return this._currentPrompt;
	}

	set currentPrompt(value: string) {
		this._currentPrompt = value;
	}

	get baseSystem(): string {
		return this._baseSystem;
	}

	set baseSystem(value: string) {
		this._baseSystem = value;
	}

	get model(): string {
		return this._model;
	}

	set model(value: string) {
		this._model = value;
	}

	get maxTokens(): number {
		return this._maxTokens;
	}

	set maxTokens(value: number) {
		this._maxTokens = value;
	}

	get temperature(): number {
		return this._temperature;
	}

	set temperature(value: number) {
		this._temperature = value;
	}

	get turnCount(): number {
		return this._turnCount;
	}

	get totalTokenUsage(): LLMTokenUsage {
		return this._totalTokenUsage;
	}

	get totalProviderRequests(): number {
		return this._totalProviderRequests;
	}

	updateTotals(tokenUsage: LLMTokenUsage, providerRequests: number): void {
		this._totalTokenUsage.totalTokens += tokenUsage.totalTokens;
		this._totalTokenUsage.inputTokens += tokenUsage.inputTokens;
		this._totalTokenUsage.outputTokens += tokenUsage.outputTokens;
		this._totalProviderRequests += providerRequests;
	}

	addTool(tool: LLMTool): void {
		this.tools.set(tool.name, tool);
		//this.conversationLogger.logToolResult('add_tool', `Tool added: ${tool.name}`);
	}

	addTools(tools: LLMTool[]): void {
		tools.forEach((tool: LLMTool) => {
			this.addTool(tool);
		});
	}

	getTool(name: string): LLMTool | undefined {
		return this.tools.get(name);
	}

	allTools(): Map<string, LLMTool> {
		return this.tools;
	}

	getAllTools(): LLMTool[] {
		return Array.from(this.tools.values());
	}
	listTools(): string[] {
		return Array.from(this.tools.keys());
	}

	clearTools(): void {
		this.tools.clear();
		//this.conversationLogger.logToolResult('clear_tools', 'All tools cleared');
	}

	async speakWithLLM(
		prompt: string,
		speakOptions?: LLMSpeakWithOptions,
	): Promise<LLMSpeakWithResponse> {
		if (!speakOptions) {
			speakOptions = {} as LLMSpeakWithOptions;
		}

		this._turnCount++;
		//logger.debug(`speakWithLLM - calling addMessageForUserRole for turn ${this._turnCount}` );
		this.addMessageForUserRole({ type: 'text', text: prompt });
		//this.conversationLogger.logUserMessage(prompt);

		const response = await this.llm.speakWithRetry(this, speakOptions);

		const contentPart: LLMMessageContentPart = response.messageResponse
			.answerContent[0] as LLMMessageContentPartTextBlock;

		const msg = contentPart.text;
		const conversationStats: ConversationMetrics = {
			statementCount: 0, //this.statementCount,
			turnCount: 0, //this.turnCount,
			totalTurnCount: 0, //this.totalTurnCount,
		};
		const tokenUsage: TokenUsage = response.messageResponse.usage;

		this.conversationLogger.logAssistantMessage(msg, conversationStats, tokenUsage);

		return response;
	}
}

export default LLMInteraction;
