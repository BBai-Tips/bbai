import type { LLMSpeakWithOptions, LLMSpeakWithResponse, LLMTokenUsage } from '../../types.ts';
import LLM from '../providers/baseLLM.ts';
import { ConversationId, LLMCallbackType } from '../../types.ts';
import type {
	LLMMessageContentPart,
	LLMMessageContentParts,
	LLMMessageContentPartTextBlock,
	LLMMessageContentPartToolResultBlock,
} from '../message.ts';
import LLMMessage from '../message.ts';
import LLMTool from '../tool.ts';
import { ConversationLogger } from '../../utils/conversationLogger.utils.ts';
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

	public async init(): Promise<void> {
		try {
			const projectRoot = await this.llm.invoke(LLMCallbackType.PROJECT_ROOT);
			this.conversationLogger = new ConversationLogger(projectRoot, this.id);
			await this.conversationLogger.initialize();
		} catch (error) {
			console.error('Failed to initialize LLMConversationInteraction:', error);
			throw error;
		}
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

	public addMessageForUserRole(contentPart: LLMMessageContentPart): string {
		const lastMessage = this.getLastMessage();
		//logger.debug('lastMessage for user', lastMessage);
		if (lastMessage && lastMessage.role === 'user') {
			// Append contentPart to the content array of the last user message
			logger.debug('Adding content to existing user message', JSON.stringify(contentPart, null, 2));
			lastMessage.content.push(contentPart);
			this.conversationLogger?.logUserMessage(JSON.stringify(contentPart));
			return lastMessage.id ?? '';
		} else {
			// Add a new user message
			logger.debug('Adding content to new user message', JSON.stringify(contentPart, null, 2));
			const newMessage = new LLMMessage('user', [contentPart]);
			this.conversationLogger?.logUserMessage(JSON.stringify(contentPart));
			this.addMessage(newMessage);
			return newMessage.id ?? '';
		}
	}

	public addMessageForAssistantRole(contentPart: LLMMessageContentPart): string {
		const lastMessage = this.getLastMessage();
		//logger.debug('lastMessage for assistant', lastMessage);
		if (lastMessage && lastMessage.role === 'assistant') {
			logger.error('Why are we adding another assistant message - SOMETHING IS WRONG!');
			// Append contentPart to the content array of the last assistant message
			logger.debug('Adding content to existing assistant message', JSON.stringify(contentPart, null, 2));
			lastMessage.content.push(contentPart);
			this.conversationLogger?.logAssistantMessage(JSON.stringify(contentPart));
			return lastMessage.id ?? '';
		} else {
			// Add a new user message
			logger.debug('Adding content to new assistant message', JSON.stringify(contentPart, null, 2));
			const newMessage = new LLMMessage('assistant', [contentPart]);
			this.conversationLogger?.logAssistantMessage(JSON.stringify(contentPart));
			this.addMessage(newMessage);
			return newMessage.id ?? '';
		}
	}

	public addMessageForToolResult(
		toolUseId: string,
		content: string,
		isError: boolean = false,
	): string {
		const toolResult = {
			type: 'tool_result',
			tool_use_id: toolUseId,
			content: [
				{
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

		return this.addMessageForUserRole(toolResult);
	}

	public addMessage(message: Omit<LLMMessage, 'timestamp'>): void {
		const completeMessage: LLMMessage = {
			...message,
			timestamp: new Date().toISOString(),
		};
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
		this.conversationLogger.logToolResult('add_tool', `Tool added: ${tool.name}`);
	}

	addTools(tools: LLMTool[]): void {
		tools.forEach((tool: LLMTool) => {
			this.tools.set(tool.name, tool);
		});
	}

	getTool(name: string): LLMTool | undefined {
		return this.tools.get(name);
	}

	allTools(): Map<string, LLMTool> {
		return this.tools;
	}
	getTools(): LLMTool[] {
		return Array.from(this.tools.values());
	}
	listTools(): string[] {
		return Array.from(this.tools.keys());
	}

	clearTools(): void {
		this.tools.clear();
		this.conversationLogger?.logToolResult('clear_tools', 'All tools cleared');
	}

	async speakWithLLM(
		prompt: string,
		speakOptions?: LLMSpeakWithOptions,
	): Promise<LLMSpeakWithResponse> {
		if (!speakOptions) {
			speakOptions = {} as LLMSpeakWithOptions;
		}

		this._turnCount++;
		this.addMessageForUserRole({ type: 'text', text: prompt });
		this.conversationLogger?.logUserMessage(prompt);

		const response = await this.llm.speakWithRetry(this, speakOptions);

		const contentPart: LLMMessageContentPart = response.messageResponse
			.answerContent[0] as LLMMessageContentPartTextBlock;
		const msg = contentPart.text;

		this.conversationLogger.logAssistantMessage(msg);

		return response;
	}
}

export default LLMInteraction;
