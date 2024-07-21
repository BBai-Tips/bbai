import type {
	ConversationId,
	LLMProviderMessageRequest,
	LLMProviderMessageResponse,
	LLMSpeakWithOptions,
	LLMTokenUsage,
} from '../types.ts';
import LLMMessage, { LLMMessageContentParts } from './message.ts';
import type { LLMMessageProviderResponse } from './message.ts';
import LLMTool from './tool.ts';
import LLM from './providers/baseLLM.ts';
import { ConversationPersistence } from '../utils/conversationPersistence.utils.ts';
import { logger } from 'shared/logger.ts';

import { ulid } from '@std/ulid';

class LLMConversation {
	public id: string;
	private llm: LLM;
	private _conversationId: ConversationId = '';
	private _turnCount: number = 0;
	private messages: LLMMessage[] = [];
	private tools: LLMTool[] = [];

	private persistence: ConversationPersistence;

	protected _system: string = '';
	protected _model: string = '';
	protected _maxTokens: number = 4000;
	protected _temperature: number = 0.2;
	private _totalTokenUsage: LLMTokenUsage = { totalTokens: 0, inputTokens: 0, outputTokens: 0 };
	private _totalProviderRequests: number = 0;
	private _currentPrompt: string = '';

	constructor(llm: LLM) {
		this.id = ulid();
		this.llm = llm;
		this.persistence = new ConversationPersistence(this.id);
	}

	async save(): Promise<void> {
		try {
			await this.persistence.saveConversation(this);
		} catch (error) {
			logger.error(`Failed to save conversation: ${error.message}`);
			throw new Error('Failed to save conversation. The application will now exit.');
		}
	}

	static async resume(id: string, llm: LLM): Promise<LLMConversation> {
		const persistence = new ConversationPersistence(id);
		const conversation = await persistence.loadConversation(llm);
		return conversation;
	}

	private async logConversation(): Promise<void> {
		// TODO: Implement this method when LLMConversationRepository is available
		console.log('Logging conversation:', {
			id: this.id,
			providerName: this.llm.providerName,
			turnCount: this._turnCount,
			messages: this.messages,
			tools: this.tools,
			tokenUsage: this.totalTokenUsage,
			system: this._system,
			model: this._model,
			maxTokens: this._maxTokens,
			temperature: this._temperature,
			timestamp: new Date(),
		});
	}

	// Getters and setters
	get conversationId(): ConversationId {
		return this._conversationId;
	}

	set conversationId(value: ConversationId) {
		this._conversationId = value;
	}

	get providerName(): string {
		return this.llm.providerName;
	}

	get currentPrompt(): string {
		return this._currentPrompt;
	}

	set currentPrompt(value: string) {
		this._currentPrompt = value;
	}

	get system(): string {
		return this._system;
	}

	set system(value: string) {
		this._system = value;
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

	addMessage(message: LLMMessage): void {
		this.messages.push(message);
	}

	getMessages(): LLMMessage[] {
		return this.messages;
	}

	getLastMessage(): LLMMessage {
		return this.messages.slice(-1)[0];
	}

	getLastMessageProviderResponse(): LLMMessageProviderResponse | undefined {
		const lastMessage = this.getLastMessage();
		return lastMessage?.providerResponse;
	}

	getLastMessageContent(): LLMMessageContentParts | undefined {
		const lastMessage = this.getLastMessage();
		return lastMessage?.content; // as LLMMessageContentParts | undefined;
	}

	clearMessages(): void {
		this.messages = [];
	}

	addTool(tool: LLMTool): void {
		this.tools.push(tool);
	}

	addTools(tools: LLMTool[]): void {
		tools.forEach((tool: LLMTool) => {
			this.tools.push(tool);
		});
	}

	getTools(): LLMTool[] {
		return this.tools;
	}

	clearTools(): void {
		this.tools = [];
	}

	async speakWithLLM(
		prompt: string,
		speakOptions?: LLMSpeakWithOptions,
	): Promise<LLMProviderMessageResponse> {
		if (!speakOptions) {
			speakOptions = {} as LLMSpeakWithOptions;
		}

		this._turnCount++;
		this.addMessage(
			{ role: 'user', content: [{ type: 'text', text: prompt }] as LLMMessageContentParts } as LLMMessage,
		);

		const llmProviderMessageResponse = await this.llm.speakWithRetry(this, speakOptions);

		await this.save();

		return llmProviderMessageResponse;
	}
}

export default LLMConversation;
