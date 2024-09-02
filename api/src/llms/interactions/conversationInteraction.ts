import { join } from '@std/path';

import type { LLMSpeakWithOptions, LLMSpeakWithResponse } from 'api/types.ts';
import { ConversationId, ConversationMetrics, ConversationTokenUsage, TokenUsage } from 'shared/types.ts';
import LLMInteraction from './baseInteraction.ts';
import LLM from '../providers/baseLLM.ts';
import { LLMCallbackType } from 'api/types.ts';
import type { LLMMessageContentPart, LLMMessageContentPartTextBlock } from 'api/llms/llmMessage.ts';
import LLMMessage from 'api/llms/llmMessage.ts';
import LLMTool from 'api/llms/llmTool.ts';
import { logger } from 'shared/logger.ts';
//import { readFileContent } from 'shared/dataDir.ts';
import { ResourceManager } from '../resourceManager.ts';
//import { GitUtils } from 'shared/git.ts';

export interface FileMetadata {
	path: string;
	size: number;
	lastModified: Date;
	inSystemPrompt: boolean;
	messageId?: string;
	toolUseId?: string;
	lastCommit?: string;
	error?: string | null;
}
export interface ProjectInfo {
	type: 'empty' | 'ctags' | 'file-listing';
	content: string;
	tier: number | null;
}

class LLMConversationInteraction extends LLMInteraction {
	private _files: Map<string, FileMetadata> = new Map();
	private resourceManager: ResourceManager;
	private systemPromptFiles: string[] = [];
	//private currentCommit: string | null = null;

	constructor(llm: LLM, conversationId?: ConversationId) {
		super(llm, conversationId);
		this.resourceManager = new ResourceManager();
	}

	// these methods are really just convenience aliases for tokenUsageInteraction
	public get tokenUsageConversation(): ConversationTokenUsage {
		return this._tokenUsageInteraction;
	}
	public set tokenUsageConversation(tokenUsage: ConversationTokenUsage) {
		this._tokenUsageInteraction = tokenUsage;
	}

	public async prepareSytemPrompt(baseSystem: string): Promise<string> {
		//logger.info('ConversationInteraction: Preparing system prompt', baseSystem);
		if (!this.conversationPersistence) {
			throw new Error('ConversationPersistence not initialized');
		}
		// First, try to get the system prompt from storage
		let preparedSystemPrompt = await this.conversationPersistence.getPreparedSystemPrompt();

		if (!preparedSystemPrompt) {
			// If not found in storage, generate a new system prompt
			const projectInfo = await this.llm.invoke(LLMCallbackType.PROJECT_INFO);
			preparedSystemPrompt = this.appendProjectInfoToSystem(baseSystem, projectInfo);

			// We're not currently adding files to system prompt, only in messages
			//preparedSystemPrompt = await this.appendFilesToSystem(preparedSystemPrompt);

			// Save the generated system prompt
			await this.conversationPersistence.savePreparedSystemPrompt(preparedSystemPrompt);
			//logger.info('ConversationInteraction: Created system prompt', preparedSystemPrompt);
		}

		//logger.info('ConversationInteraction: Using prepared system prompt', preparedSystem);
		return preparedSystemPrompt;
	}

	public async prepareTools(tools: Map<string, LLMTool>): Promise<LLMTool[]> {
		if (!this.conversationPersistence) {
			throw new Error('ConversationInteraction: ConversationPersistence not initialized');
		}

		// First, try to get the prepared tools from storage
		let preparedTools = await this.conversationPersistence.getPreparedTools();

		if (!preparedTools) {
			// If not found in storage, prepare the tools

			preparedTools = Array.from(tools.values()).map((tool) => ({
				name: tool.name,
				description: tool.description,
				input_schema: tool.input_schema,
			} as LLMTool));

			// Save the prepared tools
			await this.conversationPersistence.savePreparedTools(preparedTools || []);
		}
		//logger.info('ConversationInteraction: preparedTools', preparedTools);

		return preparedTools || [];
	}

	public async prepareMessages(messages: LLMMessage[]): Promise<LLMMessage[]> {
		return await this.hydrateMessages(messages);
	}

	//private async getCurrentGitCommit(): Promise<string | null> {
	//	const projectRoot = await this.llm.invoke(LLMCallbackType.PROJECT_ROOT);
	//	return GitUtils.getCurrentCommit(projectRoot);
	//}

	//private async appendGitCommitToSystem(system: string): Promise<string> {
	//	this.currentCommit = await this.getCurrentGitCommit();
	//	if (this.currentCommit) {
	//		system += `\n\n<git-commit>${this.currentCommit}</git-commit>`;
	//	}
	//	return system;
	//}

	protected async createFileXmlString(filePath: string): Promise<string | null> {
		try {
			logger.info('ConversationInteraction: createFileXmlString - filePath', filePath);
			const content = await this.readProjectFileContent(filePath);
			const metadata = {
				size: new TextEncoder().encode(content).length,
				lastModified: new Date(),
			};
			return `<file path="${filePath}" size="${metadata.size}" last_modified="${metadata.lastModified.toISOString()}">\n${content}\n</file>`;
		} catch (error) {
			logger.error(`ConversationInteraction: Error creating XML string for ${filePath}: ${error.message}`);
			//throw createError(ErrorType.FileHandling, `Failed to create xmlString for ${filePath}`, {
			//	filePath,
			//	operation: 'write',
			//} as FileHandlingErrorOptions);
		}
		return null;
	}

	public async readProjectFileContent(filePath: string): Promise<string> {
		const projectRoot = await this.llm.invoke(LLMCallbackType.PROJECT_ROOT);
		const fullFilePath = join(projectRoot, filePath);
		logger.info(`ConversationInteraction: Reading contents of File ${fullFilePath}`);
		try {
			return await this.resourceManager.loadResource({ type: 'file', location: fullFilePath });
		} catch (error) {
			throw new Error(`Failed to read file: ${fullFilePath}`);
		}
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

	protected async appendFilesToSystem(system: string): Promise<string> {
		for (const filePath of this.getSystemPromptFiles()) {
			const fileXml = await this.createFileXmlString(filePath);
			if (fileXml) {
				system += `\n\n${fileXml}`;
			}
		}
		return system;
	}

	async hydrateMessages(messages: LLMMessage[]): Promise<LLMMessage[]> {
		const hydratedFiles = new Map<string, number>();

		const processContentPart = async <T extends LLMMessageContentPart>(
			contentPart: T,
			messageId: string,
			turnIndex: number,
		): Promise<T> => {
			if (contentPart.type === 'text' && contentPart.text.startsWith('File added:')) {
				const filePath = contentPart.text.split(': ')[1].trim();

				if (!hydratedFiles.has(filePath)) {
					logger.info(
						`ConversationInteraction: Hydrating message for file: ${filePath} - Turn: ${turnIndex}`,
					);
					const fileXml = await this.createFileXmlString(filePath);
					if (fileXml) {
						hydratedFiles.set(filePath, turnIndex);
						return { ...contentPart, text: fileXml } as T;
					}
				} else {
					const lastHydratedTurn = hydratedFiles.get(filePath)!;
					logger.info(
						`ConversationInteraction: Skipping hydration for file: ${filePath} - Current Turn: ${turnIndex}, Last Hydrated Turn: ${lastHydratedTurn}`,
					);
					return {
						...contentPart,
						text: `Note: File ${filePath} content is up-to-date as of turn ${lastHydratedTurn}.`,
					} as T;
				}
			}
			if (contentPart.type === 'tool_result' && Array.isArray(contentPart.content)) {
				const updatedContent = await Promise.all(
					contentPart.content.map((part) => processContentPart(part, messageId, turnIndex)),
				);
				return { ...contentPart, content: updatedContent } as T;
			}
			return contentPart;
		};

		const processMessage = async (message: LLMMessage, index: number): Promise<LLMMessage> => {
			if (!message || typeof message !== 'object') {
				logger.error(`ConversationInteraction: Invalid message encountered: ${JSON.stringify(message)}`);
				return message;
			}
			if (message.role === 'user') {
				const updatedContent = [];
				for (const part of message.content) {
					const processedPart = await processContentPart(part, message.id || '', index);
					updatedContent.push(processedPart);
				}
				const updatedMessage = new LLMMessage(
					message.role,
					updatedContent,
					message.tool_call_id,
					message.providerResponse,
					message.id,
				);
				return updatedMessage;
			}
			return message;
		};

		const reversedMessages = [...messages].reverse();
		const processedMessages = [];
		for (let i = 0; i < reversedMessages.length; i++) {
			const processedMessage = await processMessage(reversedMessages[i], i);
			processedMessages.push(processedMessage);
		}
		return processedMessages.reverse();
	}

	addFileForMessage(
		filePath: string,
		metadata: Omit<FileMetadata, 'path' | 'inSystemPrompt'>,
		messageId: string,
		toolUseId?: string,
	): { filePath: string; fileMetadata: FileMetadata } {
		const fileMetadata: FileMetadata = {
			...metadata,
			messageId,
			path: filePath,
			inSystemPrompt: false,
			toolUseId,
		};

		if (!fileMetadata.error) {
			this._files.set(filePath, fileMetadata);
		}
		return { filePath, fileMetadata };
	}

	addFilesForMessage(
		filesToAdd: Array<{ fileName: string; metadata: Omit<FileMetadata, 'path' | 'inSystemPrompt'> }>,
		messageId: string,
		toolUseId?: string,
	): Array<{ filePath: string; fileMetadata: FileMetadata }> {
		const conversationFiles = [];

		for (const fileToAdd of filesToAdd) {
			const filePath = fileToAdd.fileName;
			const fileMetadata: FileMetadata = {
				...fileToAdd.metadata,
				messageId,
				path: filePath,
				inSystemPrompt: false,
				toolUseId,
			};
			conversationFiles.push({
				filePath,
				fileMetadata,
			});
		}

		for (const fileToAdd of conversationFiles) {
			if (!fileToAdd.fileMetadata.error) {
				this._files.set(fileToAdd.filePath, fileToAdd.fileMetadata);
			}
		}
		return conversationFiles;
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

	// Getters and setters
	get conversationId(): ConversationId {
		return this.id;
	}

	set conversationId(value: ConversationId) {
		this.id = value;
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

	// converse is called for first turn in a statement; subsequent turns call speakWithLLM
	public async converse(
		prompt: string,
		speakOptions?: LLMSpeakWithOptions,
	): Promise<LLMSpeakWithResponse> {
		// Statement count is now incremented at the beginning of the method
		if (!speakOptions) {
			speakOptions = {} as LLMSpeakWithOptions;
		}

		if (this._statementCount === 0) {
			// This is the first statement in the conversation
			/*
			this.currentCommit = await this.getCurrentGitCommit();
			if (this.currentCommit) {
				prompt = `Current Git commit: ${this.currentCommit}\n\n${prompt}`;
			}
			 */
		}
		this._statementTurnCount++;

		//logger.debug(`ConversationInteraction: converse - calling addMessageForUserRole for turn ${this._statementTurnCount}` );
		this.addMessageForUserRole({ type: 'text', text: prompt });
		this.conversationLogger?.logUserMessage(prompt, this.getConversationStats());

		logger.debug(`ConversationInteraction: converse - calling llm.speakWithRetry`);
		const response = await this.llm.speakWithRetry(this, speakOptions);

		// Update totals once per turn
		//this.updateTotals(response.messageResponse.usage, 1); // Assuming 1 provider request per converse call
		this.updateTotals(response.messageResponse.usage); // Assuming 1 provider request per converse call

		const contentPart: LLMMessageContentPart = response.messageResponse
			.answerContent[0] as LLMMessageContentPartTextBlock;

		const msg = contentPart.text;
		const conversationStats: ConversationMetrics = this.getConversationStats();
		const tokenUsageMessage: TokenUsage = response.messageResponse.usage;

		this.conversationLogger.logAssistantMessage(
			msg,
			conversationStats,
			tokenUsageMessage,
			this._tokenUsageStatement,
			this._tokenUsageInteraction,
		);
		this._statementCount++;

		return response;
	}
}

export default LLMConversationInteraction;
