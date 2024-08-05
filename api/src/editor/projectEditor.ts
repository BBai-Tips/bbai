import { join } from '@std/path';
import * as diff from 'diff';

import {
	FILE_LISTING_TIERS,
	generateFileListing,
	isPathWithinProject,
	readProjectFileContent,
} from '../utils/fileHandling.utils.ts';
import { LLMFactory } from '../llms/llmProvider.ts';
import LLMConversationInteraction, { FileMetadata, ProjectInfo } from '../llms/interactions/conversationInteraction.ts';
import LLMChatInteraction from '../llms/interactions/chatInteraction.ts';
import LLM from '../llms/providers/baseLLM.ts';
import { logger } from 'shared/logger.ts';
import { config } from 'shared/configManager.ts';
import { PromptManager } from '../prompts/promptManager.ts';
import {
	LLMCallbacks,
	LLMProviderMessageMeta,
	LLMProviderMessageResponse,
	LLMSpeakWithOptions,
	LLMSpeakWithResponse,
} from 'api/types.ts';
import {
	ConversationEntry,
	ConversationId,
	ConversationMetrics,
	ConversationResponse,
	ConversationStart,
	TokenUsage,
} from 'shared/types.ts';
import LLMMessage, { LLMAnswerToolUse } from 'api/llms/llmMessage.ts';
import LLMTool from '../llms/llmTool.ts';
import LLMToolManager, { LLMToolManagerToolSetType } from '../llms/llmToolManager.ts';
import { ConversationPersistence } from '../utils/conversationPersistence.utils.ts';
import type { ConversationLoggerEntryType } from 'shared/conversationLogger.ts';
import {
	getBbaiCacheDir,
	getBbaiDir,
	getProjectRoot,
	readFromBbaiDir,
	removeFromBbaiDir,
	writeToBbaiDir,
} from 'shared/dataDir.ts';
import { generateConversationTitle } from '../utils/conversation.utils.ts';
import { runFormatCommand } from '../utils/project.utils.ts';
import { stageAndCommitAfterPatching } from '../utils/git.utils.ts';
import EventManager, { EventPayloadMap } from 'shared/eventManager.ts';

class ProjectEditor {
	private conversationId: ConversationId; // only used for conversation init - use this.conversation.id after that
	public conversation!: LLMConversationInteraction;
	public chat: LLMChatInteraction | null = null;
	public promptManager!: PromptManager;
	public toolManager!: LLMToolManager;
	public eventManager!: EventManager;
	private llmProvider!: LLM;
	private llmProviderFast!: LLM;
	public startDir: string;
	public projectRoot: string;
	public statementCount: number = 0;
	public turnCount: number = 0;
	private totalTurnCount: number = 0;
	public toolSet: LLMToolManagerToolSetType = 'coding';
	public patchedFiles: Set<string> = new Set();
	public patchContents: Map<string, string> = new Map();
	private formatCommand: string = 'deno task format'; // Default format command
	private _projectInfo: ProjectInfo = {
		type: 'empty',
		content: '',
		tier: null,
	};
	private interactionCallbacks: LLMCallbacks = {
		PROJECT_ROOT: () => this.projectRoot,
		PROJECT_INFO: () => this.projectInfo,
		PROJECT_FILE_CONTENT: async (filePath: string): Promise<string> =>
			await readProjectFileContent(this.projectRoot, filePath),
		LOG_ENTRY_HANDLER: async (
			type: ConversationLoggerEntryType,
			timestamp: string,
			content: string,
			conversationStats: ConversationMetrics,
			tokenUsage: TokenUsage,
		): Promise<void> => {
			const conversationEntry: ConversationEntry = {
				type,
				timestamp,
				conversationId: this.conversation.id,
				conversationTitle: this.conversation.title,
				content,
				conversationStats,
				tokenUsage,
			};
			this.eventManager.emit(
				'projectEditor:conversationEntry',
				conversationEntry as EventPayloadMap['projectEditor']['projectEditor:conversationEntry'],
			);
		},
		PREPARE_SYSTEM_PROMPT: async (system: string): Promise<string> =>
			this.conversation
				? await this.conversation.prepareSytemPrompt(system)
				: (new Promise((resolve) => resolve(system))),
		PREPARE_MESSAGES: async (messages: LLMMessage[]): Promise<LLMMessage[]> =>
			this.conversation
				? await this.conversation.prepareMessages(messages)
				: (new Promise((resolve) => resolve(messages))),
		PREPARE_TOOLS: async (tools: LLMTool[]): Promise<LLMTool[]> =>
			this.conversation
				? await this.conversation.prepareTools(tools)
				: (new Promise((resolve) => resolve(tools))),
	};
	private interactionCallbacksFast: LLMCallbacks = {
		PROJECT_ROOT: () => this.projectRoot,
		PROJECT_INFO: () => this.projectInfo,
		PROJECT_FILE_CONTENT: (_filePath: string) => '',
		LOG_ENTRY_HANDLER: async (
			type: ConversationLoggerEntryType,
			timestamp: string,
			content: string,
			conversationStats: ConversationMetrics,
			tokenUsage: TokenUsage,
		): Promise<void> => {
			const conversationEntry: ConversationEntry = {
				type,
				timestamp,
				conversationId: this.conversation.id,
				conversationTitle: this.conversation.title,
				content,
				conversationStats,
				tokenUsage,
			};
			this.eventManager.emit(
				'projectEditor:conversationEntry',
				conversationEntry as EventPayloadMap['projectEditor']['projectEditor:conversationEntry'],
			);
		},
		PREPARE_SYSTEM_PROMPT: async (system: string): Promise<string> =>
			this.chat ? await this.chat.prepareSytemPrompt(system) : (new Promise((resolve) => resolve(system))),
		PREPARE_MESSAGES: async (messages: LLMMessage[]): Promise<LLMMessage[]> =>
			this.chat ? await this.chat.prepareMessages(messages) : (new Promise((resolve) => resolve(messages))),
		PREPARE_TOOLS: async (tools: LLMTool[]): Promise<LLMTool[]> =>
			this.chat ? await this.chat.prepareTools(tools) : (new Promise((resolve) => resolve(tools))),
	};

	constructor(conversationId: ConversationId, startDir: string) {
		if (!conversationId) {
			throw new Error('ConversationId is required');
		}
		this.projectRoot = '.'; // init() will overwrite this
		this.conversationId = conversationId;
		this.startDir = startDir;
	}

	public async init(): Promise<ProjectEditor> {
		try {
			this.projectRoot = await this.getProjectRoot();
			//this.bbaiDir = await this.getBbaiDir();
			this.llmProvider = LLMFactory.getProvider(this.interactionCallbacks);
			this.llmProviderFast = LLMFactory.getProvider(this.interactionCallbacksFast);
			this.promptManager = await new PromptManager().init(this);
			this.toolManager = new LLMToolManager(this.toolSet);
			this.eventManager = EventManager.getInstance();
			await this.initConversation(this.conversationId);
		} catch (error) {
			logger.error('Failed to initialize LLMProvider:', error);
			throw error;
		}
		return this;
	}

	public async getProjectRoot(): Promise<string> {
		return await getProjectRoot(this.startDir);
	}

	public async getBbaiDir(): Promise<string> {
		return await getBbaiDir(this.startDir);
	}

	public async getBbaiCacheDir(): Promise<string> {
		return await getBbaiCacheDir(this.startDir);
	}

	public async writeToBbaiDir(filename: string, content: string): Promise<void> {
		return await writeToBbaiDir(this.startDir, filename, content);
	}

	public async readFromBbaiDir(filename: string): Promise<string | null> {
		return await readFromBbaiDir(this.startDir, filename);
	}

	public async removeFromBbaiDir(filename: string): Promise<void> {
		return await removeFromBbaiDir(this.startDir, filename);
	}

	get projectInfo(): ProjectInfo {
		return this._projectInfo;
	}

	set projectInfo(projectInfo: ProjectInfo) {
		this._projectInfo = projectInfo;
	}

	protected async updateProjectInfo(): Promise<void> {
		const projectInfo: ProjectInfo = { type: 'empty', content: '', tier: null };

		/*
		await generateCtags(this.bbaiDir, this.projectRoot);
		const ctagsContent = await readCtagsFile(this.bbaiDir);
		if (ctagsContent) {
			projectInfo.type = 'ctags';
			projectInfo.content = ctagsContent;
			projectInfo.tier = 0; // Assuming ctags is always tier 0
		}
		 */

		if (projectInfo.type === 'empty') {
			const projectRoot = await this.getProjectRoot();
			const fileListingContent = await generateFileListing(projectRoot);

			if (fileListingContent) {
				projectInfo.type = 'file-listing';
				projectInfo.content = fileListingContent;
				// Determine which tier was used for file listing
				const tier = FILE_LISTING_TIERS.findIndex((t: { depth: number; includeMetadata: boolean }) =>
					t.depth === Infinity && t.includeMetadata === true
				);
				projectInfo.tier = tier !== -1 ? tier : null;
			}
		}

		this.projectInfo = projectInfo;
	}

	private addToolsToConversation(conversation: LLMConversationInteraction): void {
		const tools = this.toolManager.getAllTools();
		conversation.addTools(tools);
	}

	/*
	private determineStorageLocation(_filePath: string, content: string, source: 'tool' | 'user'): 'system' | 'message' {
		if (source === 'tool') {
			return 'message';
		}
		const fileSize = new TextEncoder().encode(content).length;
		const fileCount = this.conversation?.listFiles().length || 0;

		if (fileCount < 10 && fileSize < 50 * 1024) {
			return 'system';
		} else {
			return 'message';
		}
	}
	 */

	private async initConversation(conversationId: ConversationId): Promise<void> {
		logger.info(`Initializing a conversation with ID: ${conversationId}`);

		let conversation = await this.loadConversation(conversationId);
		if (!conversation) {
			conversation = await this.startConversation(conversationId);
		}

		logger.info(`Adding tools to conversation: ${conversation.id}`);
		this.addToolsToConversation(conversation);

		this.conversation = conversation;
	}

	async startConversation(conversationId: ConversationId): Promise<LLMConversationInteraction> {
		let conversation: LLMConversationInteraction | null;

		try {
			const systemPrompt = await this.promptManager.getPrompt('system', {
				userDefinedContent: 'You are an AI assistant helping with code and project management.',
			});

			conversation = await this.createConversation(conversationId);
			conversation.baseSystem = systemPrompt;
			logger.info(`Started new conversation: ${conversation.id}`);

			this.statementCount = 0;
			this.totalTurnCount = 0;
		} catch (error) {
			logger.error(`Error creating new conversation:`, error);
			throw error;
		}
		return conversation;
	}
	async loadConversation(conversationId: ConversationId): Promise<LLMConversationInteraction | null> {
		logger.info(`Attempting to load existing conversation: ${conversationId}`);
		let conversation: LLMConversationInteraction | null = null;
		try {
			const persistence = new ConversationPersistence(conversationId, this);
			await persistence.init();

			conversation = await persistence.loadConversation(this.llmProvider);
			if (!conversation) {
				logger.warn(`No conversation found for ID: ${conversationId}`);
				return null;
			}
			logger.info(`Loaded existing conversation: ${conversationId}`);

			const metadata = await persistence.getMetadata();

			this.statementCount = metadata.statementCount || 0;
			this.totalTurnCount = metadata.totalTurnCount || 0;
		} catch (error) {
			logger.warn(`Failed to load conversation ${conversationId}: ${error.message}`);
			logger.error(`Error details:`, error);
			logger.debug(`Stack trace:`, error.stack);
			return null;
		}
		return conversation;
	}

	async saveInitialConversationWithResponse(currentResponse: LLMSpeakWithResponse): Promise<void> {
		try {
			const persistence = new ConversationPersistence(this.conversation.id, this);
			await persistence.saveConversation(this.conversation);
			await persistence.saveMetadata({
				statementCount: this.statementCount,
				totalTurnCount: this.totalTurnCount,
			});

			// Save system prompt and project info if running in local development
			if (config.api?.environment === 'localdev') {
				await persistence.saveSystemPrompt(currentResponse.messageMeta.system);
				await persistence.saveProjectInfo(this.projectInfo);
			}

			logger.info(`Saved conversation: ${this.conversation.id}`);
		} catch (error) {
			logger.error(`Error persisting the conversation:`, error);
			throw error;
		}
	}

	async saveConversationAfterStatement(): Promise<void> {
		try {
			const persistence = new ConversationPersistence(this.conversation.id, this);
			await persistence.saveConversation(this.conversation);
			await persistence.saveMetadata({
				statementCount: this.statementCount,
				totalTurnCount: this.totalTurnCount,
			});
		} catch (error) {
			logger.error(`Error persisting the conversation:`, error);
			throw error;
		}
	}

	async createConversation(conversationId: ConversationId): Promise<LLMConversationInteraction> {
		const conversation = new LLMConversationInteraction(this.llmProvider, conversationId);
		await conversation.init();
		return conversation;
	}
	async createChat(): Promise<LLMChatInteraction> {
		const chat = new LLMChatInteraction(this.llmProviderFast, this.conversation?.id);
		await chat.init();
		return chat;
	}

	private async generateConversationTitle(statement: string): Promise<string> {
		return generateConversationTitle(await this.createChat(), statement);
	}

	async handleStatement(
		statement: string,
	): Promise<{
		response: LLMProviderMessageResponse;
		messageMeta: LLMProviderMessageMeta;
		conversationId: ConversationId;
		conversationTitle: string;
		conversationStats: ConversationMetrics;
		tokenUsage: TokenUsage;
	}> {
		if (!statement) {
			this.eventManager.emit(
				'projectEditor:conversationError',
				{
					conversationId: this.conversation.id,
					conversationTitle: this.conversation.title || '',
					statementCount: this.statementCount,
					error: 'Missing statement',
					code: 'EMPTY_PROMPT',
				} as EventPayloadMap['projectEditor']['projectEditor:conversationError'],
			);
			throw new Error('Missing statement');
		}
		/*
		logger.info(
			`Starting handleStatement. Prompt: "${
				statement.substring(0, 50)
			}...", ConversationId: ${this.conversation.id}`,
		);
		 */

		if (!this.conversation.title) {
			this.conversation.title = await this.generateConversationTitle(statement);
		}
		await this.updateProjectInfo();

		this.statementCount++;

		const conversationReady: ConversationStart = {
			conversationId: this.conversation.id,
			conversationTitle: this.conversation.title,
			statementCount: this.statementCount,
		};
		this.eventManager.emit(
			'projectEditor:conversationReady',
			conversationReady as EventPayloadMap['projectEditor']['projectEditor:conversationReady'],
		);

		const speakOptions: LLMSpeakWithOptions = {
			//temperature: 0.7,
			//maxTokens: 1000,
		};

		const maxTurns = 25; // Maximum number of turns for the run loop
		this.turnCount = 0;
		let currentResponse: LLMSpeakWithResponse | null = null;

		try {
			logger.info(
				`Calling conversation.converse for turn ${this.turnCount} with statement: "${
					statement.substring(0, 50)
				}..."`,
			);

			currentResponse = await this.conversation.converse(statement, speakOptions);
			logger.info('Received response from LLM');
			//logger.debug('LLM Response:', currentResponse);

			this.totalTurnCount++;
			this.turnCount++;
		} catch (error) {
			logger.error(`Error in LLM communication:`, error);
			throw error;
		}

		// Save the conversation immediately after the first response
		logger.info(
			`Saving conversation at beginning of statement: ${this.conversation.id}[${this.statementCount}][${this.turnCount}]`,
		);
		await this.saveInitialConversationWithResponse(currentResponse);

		while (this.turnCount < maxTurns) {
			try {
				// Handle tool calls and collect feedback
				let toolFeedback = '';
				if (currentResponse.messageResponse.toolsUsed && currentResponse.messageResponse.toolsUsed.length > 0) {
					for (const toolUse of currentResponse.messageResponse.toolsUsed) {
						//logger.info('Handling tool', toolUse);
						try {
							const feedback = await this.handleToolUse(toolUse, currentResponse.messageResponse);
							toolFeedback += feedback + '\n';
						} catch (error) {
							logger.warn(`Error handling tool ${toolUse.toolName}: ${error.message}`);
							toolFeedback += `Error with ${toolUse.toolName}: ${error.message}\n`;
						}
					}
				}

				// If there's tool feedback, send it back to the LLM
				if (toolFeedback) {
					try {
						await this.updateProjectInfo();

						statement =
							`Tool use feedback:\n${toolFeedback}\nPlease acknowledge this feedback and continue the conversation.`;

						this.turnCount++;
						this.totalTurnCount++;

						currentResponse = await this.conversation.speakWithLLM(statement, speakOptions);
						//logger.info('tool response', currentResponse);
					} catch (error) {
						logger.error(`Error in LLM communication: ${error.message}`);
						throw error; // This error is likely fatal, so we'll throw it to be caught by the outer try-catch
					}
				} else {
					// No more tool feedback, exit the loop
					break;
				}
			} catch (error) {
				logger.error(`Error in conversation turn ${this.turnCount}: ${error.message}`);
				if (this.turnCount === maxTurns - 1) {
					throw error; // If it's the last turn, throw the error to be caught by the outer try-catch
				}
				// For non-fatal errors, log and continue to the next turn
				currentResponse = {
					messageResponse: {
						answerContent: [{
							type: 'text',
							text: `Error occurred: ${error.message}. Continuing conversation.`,
						}],
					},
					messageMeta: {},
				} as LLMSpeakWithResponse;
			}
		}

		if (this.formatCommand) await runFormatCommand(this.projectRoot, this.formatCommand);

		if (this.turnCount >= maxTurns) {
			logger.warn(`Reached maximum number of turns (${maxTurns}) in conversation.`);
		}

		// Final save of the entire conversation at the end of the loop
		logger.info(
			`Saving conversation at end of statement: ${this.conversation.id}[${this.statementCount}][${this.turnCount}]`,
		);
		await this.saveConversationAfterStatement();
		logger.info(`Final save of conversation: ${this.conversation.id}[${this.statementCount}][${this.turnCount}]`);

		const statementAnswer = {
			response: currentResponse.messageResponse,
			messageMeta: currentResponse.messageMeta,
			conversationId: this.conversation.id || '',
			conversationTitle: this.conversation.title || '',
			conversationStats: {
				statementCount: this.statementCount,
				turnCount: this.turnCount,
				totalTurnCount: this.totalTurnCount,
			},
			tokenUsage: currentResponse.messageResponse.usage,
		} as ConversationResponse;

		this.eventManager.emit(
			'projectEditor:conversationAnswer',
			statementAnswer as EventPayloadMap['projectEditor']['projectEditor:conversationAnswer'],
		);

		return statementAnswer;
	}

	private async handleToolUse(
		toolUse: LLMAnswerToolUse,
		_response: unknown,
	): Promise<string> {
		const { messageId: _messageId, feedback, isError } = await this.toolManager.handleToolUse(toolUse, this);
		//logger.debug(`handleToolUse for ${toolUse.toolName}` - got feedback from toolManager: ${feedback}`);
		this.conversation?.conversationLogger?.logToolResult(
			toolUse.toolName,
			`BBai was ${isError ? 'unsuccessful' : 'successful'} with tool run: \n${feedback}`,
		);
		return feedback;
	}

	// prepareFilesForConversation is called by request_files tool and by add_file handler for user requests
	async prepareFilesForConversation(
		fileNames: string[],
	): Promise<Array<{ fileName: string; metadata: Omit<FileMetadata, 'path' | 'inSystemPrompt'> }>> {
		if (!this.conversation) {
			throw new Error('Conversation not started. Call startConversation first.');
		}

		const filesAdded: Array<{ fileName: string; metadata: Omit<FileMetadata, 'path' | 'inSystemPrompt'> }> = [];

		for (const fileName of fileNames) {
			try {
				if (!isPathWithinProject(this.projectRoot, fileName)) {
					throw new Error(`Access denied: ${fileName} is outside the project directory`);
				}

				const fullFilePath = join(this.projectRoot, fileName);
				const content = await Deno.readTextFile(fullFilePath);
				const metadata: Omit<FileMetadata, 'path' | 'inSystemPrompt'> = {
					size: new TextEncoder().encode(content).length,
					lastModified: new Date(),
					error: null,
				};
				filesAdded.push({ fileName, metadata });

				logger.info(`ProjectEditor has prepared file ${fileName}`);
			} catch (error) {
				logger.error(`Error adding file ${fileName}: ${error.message}`);
				filesAdded.push({
					fileName,
					metadata: {
						size: 0,
						lastModified: new Date(),
						error: error.message,
					},
				});
			}
		}

		return filesAdded;
	}

	public async stageAndCommitAfterPatching(): Promise<void> {
		await stageAndCommitAfterPatching(
			this.projectRoot,
			this.patchedFiles,
			this.patchContents,
			this,
		);
		this.patchedFiles.clear();
		this.patchContents.clear();
	}

	async revertLastPatch(): Promise<void> {
		if (!this.conversation) {
			throw new Error('No active conversation. Cannot revert patch.');
		}

		const persistence = new ConversationPersistence(this.conversation.id, this);
		const patchLog = await persistence.getPatchLog();

		if (patchLog.length === 0) {
			throw new Error('No patches to revert.');
		}

		const lastPatch = patchLog[patchLog.length - 1];
		const { filePath, patch } = lastPatch;

		try {
			const currentContent = await Deno.readTextFile(filePath);

			// Create a reverse patch
			const patchResult = diff.applyPatch(currentContent, patch);
			if (typeof patchResult === 'boolean') {
				throw new Error('Failed to apply original patch. Cannot create reverse patch.');
			}
			const reversePatch = diff.createPatch(filePath, patchResult, currentContent);

			// Apply the reverse patch
			const revertedContent = diff.applyPatch(currentContent, reversePatch);

			if (revertedContent === false) {
				throw new Error('Failed to revert patch. The current file content may have changed.');
			}

			await Deno.writeTextFile(filePath, revertedContent);
			logger.info(`Last patch reverted for file: ${filePath}`);

			// Remove the last patch from the log
			await persistence.removeLastPatch();
		} catch (error) {
			logger.error(`Error reverting last patch: ${error.message}`);
			throw error;
		}
	}
}

export default ProjectEditor;
