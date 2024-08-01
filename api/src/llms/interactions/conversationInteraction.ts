import { join } from '@std/path';

import type { ConversationId, LLMSpeakWithOptions, LLMSpeakWithResponse } from '../../types.ts';
import LLMInteraction from './baseInteraction.ts';
import LLM from '../providers/baseLLM.ts';
import { LLMCallbackType } from '../../types.ts';
import type {
	LLMMessageContentPart,
	LLMMessageContentPartTextBlock,
	LLMMessageContentPartToolResultBlock,
} from '../message.ts';
import LLMMessage from '../message.ts';
import LLMTool from '../tool.ts';
import { logger } from 'shared/logger.ts';
import { readFileContent } from 'shared/dataDir.ts';
import { GitUtils } from 'shared/git.ts';

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

class LLMConversationInteraction extends LLMInteraction {
	private _statementCount: number = 0;
	private _files: Map<string, FileMetadata> = new Map();
	private systemPromptFiles: string[] = [];
	public title: string = '';
	private currentCommit: string | null = null;

	constructor(llm: LLM, conversationId?: ConversationId) {
		super(llm, conversationId);
	}

	public async prepareSytemPrompt(system: string): Promise<string> {
		const projectInfo = await this.llm.invoke(LLMCallbackType.PROJECT_INFO);
		system = this.appendProjectInfoToSystem(system, projectInfo);
		system = await this.appendFilesToSystem(system);
		system = await this.appendGitCommitToSystem(system);
		return new Promise((resolve) => resolve(system));
	}
	public async prepareMessages(messages: LLMMessage[]): Promise<LLMMessage[]> {
		return await this.hydrateMessages(messages);
	}
	public async prepareTools(tools: LLMTool[]): Promise<LLMTool[]> {
		return new Promise((resolve) => resolve(tools));
	}

	private async getCurrentGitCommit(): Promise<string | null> {
		const projectRoot = await this.llm.invoke(LLMCallbackType.PROJECT_ROOT);
		return GitUtils.getCurrentCommit(projectRoot);
	}

	private async appendGitCommitToSystem(system: string): Promise<string> {
		this.currentCommit = await this.getCurrentGitCommit();
		if (this.currentCommit) {
			system += `\n\n<git-commit>${this.currentCommit}</git-commit>`;
		}
		return system;
	}

	protected async createFileXmlString(filePath: string): Promise<string | null> {
		try {
			logger.info('createFileXmlString - filePath', filePath);
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

	public async readProjectFileContent(filePath: string): Promise<string> {
		const projectRoot = await this.llm.invoke(LLMCallbackType.PROJECT_ROOT);
		const fullFilePath = join(projectRoot, filePath);
		logger.info(`Reading contents of File ${fullFilePath}`);
		const content = await readFileContent(fullFilePath);
		if (content === null) {
			throw new Error(`File not found: ${fullFilePath}`);
		}
		return content;
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

	protected async hydrateMessages(messages: LLMMessage[]): Promise<LLMMessage[]> {
		const hydratedFiles = new Map<string, number>();

		const processContentPart = async <T extends LLMMessageContentPart>(
			contentPart: T,
			messageId: string,
		): Promise<T> => {
			if (contentPart.type === 'text' && contentPart.text.startsWith('File added:')) {
				const filePath = contentPart.text.split(': ')[1].trim();
				const currentTurn = messages.length - messages.findIndex((m) => m.id === messageId);
				const lastHydratedTurn = hydratedFiles.get(filePath) || 0;

				if (currentTurn > lastHydratedTurn) {
					logger.info(
						`Hydrating message for file: ${filePath} - Current Turn: ${currentTurn}, Last Hydrated Turn: ${lastHydratedTurn}`,
					);
					const fileXml = await this.createFileXmlString(filePath);
					if (fileXml) {
						hydratedFiles.set(filePath, currentTurn);
						return { ...contentPart, text: fileXml } as T;
					}
				} else {
					logger.info(
						`Skipping hydration for file: ${filePath} - Current Turn: ${currentTurn}, Last Hydrated Turn: ${lastHydratedTurn}`,
					);
					return {
						...contentPart,
						text: `Note: File ${filePath} content is up-to-date as of turn ${lastHydratedTurn}.`,
					} as T;
				}
				//} else {
				//	logger.debug(`Skipping content part: ${contentPart.type}`);
			}
			if (contentPart.type === 'tool_result' && Array.isArray(contentPart.content)) {
				const updatedContent = await Promise.all(
					contentPart.content.map((part) => processContentPart(part, messageId)),
				);
				return { ...contentPart, content: updatedContent } as T;
			}
			return contentPart;
		};

		const processMessage = async (message: LLMMessage): Promise<LLMMessage> => {
			if (!message || typeof message !== 'object') {
				logger.error(`Invalid message encountered: ${JSON.stringify(message)}`);
				return message;
			}
			if (message.role === 'user') {
				const updatedContent = await Promise.all(
					message.content.map((part) => processContentPart(part, message.id || '')),
				);
				return { ...message, content: updatedContent };
			}
			return message;
		};

		const reversedMessages = [...messages].reverse();
		const processedMessages = await Promise.all(reversedMessages.map(processMessage));
		return processedMessages.reverse();
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

		this.conversationLogger?.logToolResult('add_file', `File added: ${filePath}`);
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

		this.conversationLogger?.logToolResult('add_files', `Files added to the conversation: ${filesSummary}`);
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
		this.conversationLogger?.logToolResult('add_system_file', `File added to system prompt: ${filePath}`);
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
			this.conversationLogger?.logToolResult('remove_file', `File removed: ${filePath}`);
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

	/*
	private logConversation(): void {
		// TODO: Implement this method when LLMConversationInteractionProject is available
		this.llm.invoke(LLMCallbackType.PROJECT_INFO).then(
			(projectInfo) =>
				this.conversationLogger?.logToolResult(
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
						model: this.model,
						maxTokens: this._maxTokens,
						temperature: this._temperature,
						timestamp: new Date(),
					}),
				),
		);
	}
	 */

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

	public get statementCount(): number {
		return this._statementCount;
	}

	public async converse(
		prompt: string,
		speakOptions?: LLMSpeakWithOptions,
	): Promise<LLMSpeakWithResponse> {
		if (!speakOptions) {
			speakOptions = {} as LLMSpeakWithOptions;
		}

		if (this._statementCount === 0) {
			// This is the first statement in the conversation
			this.currentCommit = await this.getCurrentGitCommit();
			if (this.currentCommit) {
				prompt = `Current Git commit: ${this.currentCommit}\n\n${prompt}`;
			}
		}
		this._turnCount++;
		this.addMessageForUserRole({ type: 'text', text: prompt });
		this.conversationLogger?.logUserMessage(prompt);

		const response = await this.llm.speakWithRetry(this, speakOptions);

		const contentPart: LLMMessageContentPart = response.messageResponse
			.answerContent[0] as LLMMessageContentPartTextBlock;
		const msg = contentPart.text;

		this.conversationLogger.logAssistantMessage(msg);
		this._statementCount++;

		return response;
	}
}

export default LLMConversationInteraction;
