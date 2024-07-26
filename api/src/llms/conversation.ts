import type { ConversationId, LLMProviderMessageResponse, LLMSpeakWithOptions, LLMTokenUsage } from '../types.ts';
import { AnthropicModel, LLMCallbackType } from '../types.ts';
import type {
	LLMMessageContentPart,
	LLMMessageContentParts,
	LLMMessageContentPartTextBlock,
	LLMMessageContentPartToolResultBlock,
} from './message.ts';
import LLMMessage from './message.ts';
import type { LLMMessageProviderResponse } from './message.ts';
import LLMTool from './tool.ts';
import LLM from './providers/baseLLM.ts';
import { ChatLogger } from '../utils/chatLogger.utils.ts';
import { logger } from 'shared/logger.ts';

import { crypto } from '@std/crypto';

export interface FileMetadata {
	path: string;
	size: number;
	lastModified: Date;
	inSystemPrompt: boolean;
	messageId?: string;
	toolUseId?: string;
	error?: string | null;
}
export interface ProjectInfo {
	type: 'empty' | 'ctags' | 'file-listing';
	content: string;
	tier: number | null;
}

class LLMConversation {
	public id: string;
	public llm: LLM;
	private _conversationId: ConversationId = '';
	private _turnCount: number = 0;
	private _statementCount: number = 0;
	private messages: LLMMessage[] = [];
	private tools: Map<string, LLMTool> = new Map();
	private _files: Map<string, FileMetadata> = new Map();
	private systemPromptFiles: string[] = [];
	private chatLogger!: ChatLogger;

	//private _system: string = '';

	protected _baseSystem: string = '';
	protected _model: string = AnthropicModel.CLAUDE_3_5_SONNET;
	protected _maxTokens: number = 8192;
	protected _temperature: number = 0.2;
	private _totalTokenUsage: LLMTokenUsage = { totalTokens: 0, inputTokens: 0, outputTokens: 0 };
	private _totalProviderRequests: number = 0;
	private _currentPrompt: string = '';

	constructor(llm: LLM) {
		this.id = LLMConversation.generateShortId();
		this.llm = llm;
	}

	public async init(): Promise<void> {
		try {
			const projectRoot = await this.llm.invoke(LLMCallbackType.PROJECT_ROOT);
			this.chatLogger = new ChatLogger(projectRoot, this.id);
			await this.chatLogger.initialize();
		} catch (error) {
			console.error('Failed to initialize LLMConversation:', error);
			throw error;
		}
	}

	private static generateShortId(): string {
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
			this.chatLogger.logUserMessage(JSON.stringify(contentPart));
			return lastMessage.id ?? '';
		} else {
			// Add a new user message
			logger.debug('Adding content to new user message', JSON.stringify(contentPart, null, 2));
			const newMessage = new LLMMessage('user', [contentPart]);
			this.chatLogger.logUserMessage(JSON.stringify(contentPart));
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
			this.chatLogger.logAssistantMessage(JSON.stringify(contentPart));
			return lastMessage.id ?? '';
		} else {
			// Add a new user message
			logger.debug('Adding content to new assistant message', JSON.stringify(contentPart, null, 2));
			const newMessage = new LLMMessage('assistant', [contentPart]);
			this.chatLogger.logAssistantMessage(JSON.stringify(contentPart));
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
			this.chatLogger.logError(`Tool Result (${toolUseId}): ${content}`);
		} else {
			this.chatLogger.logToolResult(toolUseId, content);
		}

		return this.addMessageForUserRole(toolResult);
	}

	addFileToMessages(
		filePath: string,
		metadata: Omit<FileMetadata, 'path' | 'inSystemPrompt'>,
		toolUseId: string,
	): void {
		const fileMetadata: FileMetadata = {
			...metadata,
			path: filePath,
			inSystemPrompt: false,
			toolUseId,
		};
		this._files.set(filePath, fileMetadata);

		this.chatLogger.logToolResult('add_file', `File added: ${filePath}`);
		const messageId = this.addMessageForToolResult(toolUseId, `File added: ${filePath}`);
		fileMetadata.messageId = messageId;
	}

	addFilesToMessages(
		filesToAdd: Array<{ fileName: string; metadata: Omit<FileMetadata, 'path' | 'inSystemPrompt'> }>,
		toolUseId: string,
	): void {
		const conversationFiles = [];
		const contentParts = [];
		let allFilesFailed = true;

		for (const fileToAdd of filesToAdd) {
			const filePath = fileToAdd.fileName;
			const fileMetadata: FileMetadata = {
				...fileToAdd.metadata,
				path: filePath,
				inSystemPrompt: false,
			};
			conversationFiles.push({
				filePath,
				fileMetadata,
			});

			if (fileMetadata.error) {
				contentParts.push({
					'type': 'text',
					'text': `Error adding file ${filePath}: ${fileMetadata.error}`,
				} as LLMMessageContentPartTextBlock);
			} else {
				contentParts.push({
					'type': 'text',
					'text': `File added: ${filePath}`,
				} as LLMMessageContentPartTextBlock);
				allFilesFailed = false;
			}
		}

		const filesSummary = filesToAdd.map((file) => `${file.fileName} (${file.metadata.error ? 'Error' : 'Success'})`)
			.join(', ');
		const toolResultContentPart = {
			type: 'tool_result',
			tool_use_id: toolUseId,
			content: [
				{
					type: 'text',
					text: `Files added to the conversation: ${filesSummary}`,
				} as LLMMessageContentPartTextBlock,
				...contentParts,
			],
			is_error: allFilesFailed,
		} as LLMMessageContentPartToolResultBlock;

		this.chatLogger.logToolResult('add_files', `Files added to the conversation: ${filesSummary}`);
		const messageId = this.addMessageForUserRole(toolResultContentPart);

		for (const fileToAdd of conversationFiles) {
			if (!fileToAdd.fileMetadata.error) {
				fileToAdd.fileMetadata.messageId = messageId;
				this._files.set(fileToAdd.filePath, fileToAdd.fileMetadata);
			}
		}
	}

	addFileForSystemPrompt(
		filePath: string,
		metadata: Omit<FileMetadata, 'path' | 'inSystemPrompt'>,
	): void {
		const fileMetadata: FileMetadata = {
			...metadata,
			path: filePath,
			inSystemPrompt: true,
		};
		this._files.set(filePath, fileMetadata);
		this.systemPromptFiles.push(filePath);
		this.chatLogger.logToolResult('add_system_file', `File added to system prompt: ${filePath}`);
	}

	removeFile(filePath: string): boolean {
		const fileMetadata = this._files.get(filePath);
		if (fileMetadata) {
			if (!fileMetadata.inSystemPrompt && fileMetadata.messageId) {
				this.messages = this.messages.filter((message) => message.id !== fileMetadata.messageId);
			}
			if (fileMetadata.inSystemPrompt) {
				this.systemPromptFiles = this.systemPromptFiles.filter((path) => path !== filePath);
			}
			this.chatLogger.logToolResult('remove_file', `File removed: ${filePath}`);
			return this._files.delete(filePath);
		}
		return false;
	}

	getFile(filePath: string): FileMetadata | undefined {
		return this._files.get(filePath);
	}

	getFiles(): Map<string, FileMetadata> {
		return this._files;
	}

	listFiles(): string[] {
		return Array.from(this._files.keys());
	}

	private logConversation(): void {
		// TODO: Implement this method when LLMConversationProject is available
		this.llm.invoke(LLMCallbackType.PROJECT_INFO).then(
			(projectInfo) =>
				this.chatLogger.logToolResult(
					'log_conversation',
					JSON.stringify({
						id: this.id,
						llmProviderName: this.llm.llmProviderName,
						statementCount: this._statementCount,
						turnCount: this._turnCount,
						messages: this.messages,
						projectInfo: projectInfo,
						tools: this.tools,
						tokenUsage: this.totalTokenUsage,
						system: this._baseSystem,
						model: this._model,
						maxTokens: this._maxTokens,
						temperature: this._temperature,
						timestamp: new Date(),
					}),
				),
		);
	}

	// Getters and setters
	get conversationId(): ConversationId {
		return this._conversationId;
	}

	set conversationId(value: ConversationId) {
		this._conversationId = value;
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

	getSystemPromptFiles(): string[] {
		return this.systemPromptFiles;
	}

	getLastSystemPromptFile(): string {
		return this.systemPromptFiles.slice(-1)[0];
	}

	clearSystemPromptFiles(): void {
		this.systemPromptFiles = [];
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

	get statementCount(): number {
		return this._statementCount;
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

	addMessage(message: Omit<LLMMessage, 'timestamp'>): void {
		const completeMessage: LLMMessage = {
			...message,
			timestamp: new Date().toISOString(),
		};
		this.messages.push(completeMessage);
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
		this.tools.set(tool.name, tool);
		this.chatLogger.logToolResult('add_tool', `Tool added: ${tool.name}`);
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
		this.chatLogger.logToolResult('clear_tools', 'All tools cleared');
	}

	async speakWithLLM(
		prompt: string,
		speakOptions?: LLMSpeakWithOptions,
	): Promise<LLMProviderMessageResponse> {
		if (!speakOptions) {
			speakOptions = {} as LLMSpeakWithOptions;
		}

		this._turnCount++;
		this.addMessageForUserRole({ type: 'text', text: prompt });
		this.chatLogger.logUserMessage(prompt);

		return await this.llm.speakWithRetry(this, speakOptions);
	}
}

export default LLMConversation;
