import * as diff from 'diff';

import InteractionManager from '../llms/interactions/interactionManager.ts';
import ProjectEditor from '../editor/projectEditor.ts';
import LLM from '../llms/providers/baseLLM.ts';
import LLMFactory from '../llms/llmProvider.ts';
import LLMMessage, { LLMAnswerToolUse } from 'api/llms/llmMessage.ts';
import LLMTool from '../llms/llmTool.ts';
//import LLMToolManager, { LLMToolManagerToolSetType } from '../llms/llmToolManager.ts';
import LLMToolManager from '../llms/llmToolManager.ts';
import LLMConversationInteraction from '../llms/interactions/conversationInteraction.ts';
import LLMChatInteraction from '../llms/interactions/chatInteraction.ts';
import AgentController from './agentController.ts';
import PromptManager from '../prompts/promptManager.ts';
import EventManager, { EventPayloadMap } from 'shared/eventManager.ts';
import ConversationPersistence from '../storage/conversationPersistence.ts';
import { ErrorHandlingConfig, Task } from 'api/types/llms.ts';
import {
	ConversationEntry,
	ConversationId,
	ConversationMetrics,
	ConversationResponse,
	ConversationStart,
	ConversationTokenUsage,
	TokenUsage,
} from 'shared/types.ts';
import { logger } from 'shared/logger.ts';
import { readProjectFileContent } from '../utils/fileHandling.utils.ts';
import type { LLMSpeakWithOptions, LLMSpeakWithResponse } from '../types.ts';
import type { ConversationLoggerEntryType } from 'shared/conversationLogger.ts';
import { generateConversationTitle } from '../utils/conversation.utils.ts';
import { generateConversationId } from 'shared/conversationManagement.ts';
//import { runFormatCommand } from '../utils/project.utils.ts';
import { stageAndCommitAfterPatching } from '../utils/git.utils.ts';
import { config } from 'shared/configManager.ts';

class OrchestratorController {
	private interactionStats: Map<ConversationId, ConversationMetrics> = new Map();
	private interactionTokenUsage: Map<ConversationId, ConversationTokenUsage> = new Map();
	private isCancelled: boolean = false;
	public interactionManager: InteractionManager;
	public primaryInteractionId: ConversationId | null = null;
	private agentControllers: Map<string, AgentController> = new Map();
	public promptManager!: PromptManager;
	public toolManager: LLMToolManager;
	public llmProvider: LLM;
	public eventManager!: EventManager;
	private projectEditorRef!: WeakRef<ProjectEditor>;
	//private _providerRequestCount: number = 0;
	// counts across all interactions
	// count of turns for most recent statement in most recent interaction
	private _turnCount: number = 0;
	// count of turns for all statements across all interactions
	private _totalTurnCount: number = 0;
	// count of statements across all interactions
	private _statementCount: number = 0;
	// usage across all interactions
	protected _tokenUsageTotals: ConversationTokenUsage = {
		totalTokensTotal: 0,
		inputTokensTotal: 0,
		outputTokensTotal: 0,
	};

	constructor(projectEditor: ProjectEditor) {
		this.projectEditorRef = new WeakRef(projectEditor);
		this.interactionManager = new InteractionManager();
		this.llmProvider = LLMFactory.getProvider(this.getInteractionCallbacks());
		this.toolManager = new LLMToolManager('coding'); // Assuming 'coding' is the default toolset
	}

	async init(): Promise<OrchestratorController> {
		this.eventManager = EventManager.getInstance();
		this.promptManager = await new PromptManager().init(this.projectEditor.projectRoot);

		return this;
	}

	get projectEditor(): ProjectEditor {
		const projectEditor = this.projectEditorRef.deref();
		if (!projectEditor) throw new Error('No projectEditor to deref from projectEditorRef');
		return projectEditor;
	}

	get primaryInteraction(): LLMConversationInteraction {
		if (!this.primaryInteractionId) throw new Error('No primaryInteractionId set in orchestrator');
		const primaryInteraction = this.interactionManager.getInteraction(this.primaryInteractionId);
		if (!primaryInteraction) throw new Error('No primaryInteraction to get from interactionManager');
		return primaryInteraction as LLMConversationInteraction;
	}
	get turnCount(): number {
		return this._turnCount;
	}
	get totalTurnCount(): number {
		return this._totalTurnCount;
	}
	get statementCount(): number {
		return this._statementCount;
	}

	public get inputTokensTotal(): number {
		return this._tokenUsageTotals.inputTokensTotal;
	}

	public outputTokensTotal(): number {
		return this._tokenUsageTotals.outputTokensTotal;
	}

	public get totalTokensTotal(): number {
		return this._tokenUsageTotals.totalTokensTotal;
	}

	public getAllStats(): { [key: string]: ConversationMetrics } {
		const allStats: { [key: string]: ConversationMetrics } = {};
		for (const [id, stats] of this.interactionStats) {
			allStats[id] = stats;
		}
		return allStats;
	}
	public getAllTokenUsage(): { [key: string]: ConversationTokenUsage } {
		const allTokenUsage: { [key: string]: ConversationTokenUsage } = {};
		for (const [id, usage] of this.interactionTokenUsage) {
			allTokenUsage[id] = usage;
		}
		return allTokenUsage;
	}

	public get tokenUsageTotals(): ConversationTokenUsage {
		return this._tokenUsageTotals;
	}

	/*
	updateUsageTotals(tokenUsage: TokenUsage): void {
		this._tokenUsageTotals.totalTokensTotal += tokenUsage.totalTokens;
		this._tokenUsageTotals.inputTokensTotal += tokenUsage.inputTokens;
		this._tokenUsageTotals.outputTokensTotal += tokenUsage.outputTokens;
	}
 */

	private updateStats(conversationId: ConversationId, interactionStats: ConversationMetrics): void {
		this.interactionStats.set(conversationId, interactionStats);
		this.updateTotalStats();
	}

	private updateTotalStats(): void {
		//this._providerRequestCount = 0;
		this._turnCount = 0;
		this._totalTurnCount = 0;
		this._statementCount = 0;
		//this._tokenUsageTotals = { totalTokensTotal: 0, inputTokensTotal: 0, outputTokensTotal: 0 };

		for (const stats of this.interactionStats.values()) {
			//this._providerRequestCount += stats.providerRequestCount;
			this._turnCount += stats.turnCount;
			this._totalTurnCount += stats.totalTurnCount;
			this._statementCount += stats.statementCount;
		}
		//for (const usage of this.interactionTokenUsage.values()) {
		//	this._tokenUsageTotals.totalTokensTotal += usage.totalTokensTotal;
		//	this._tokenUsageTotals.inputTokensTotal += usage.inputTokensTotal;
		//	this._tokenUsageTotals.outputTokensTotal += usage.outputTokensTotal;
		//}
	}

	async initializePrimaryInteraction(conversationId: ConversationId): Promise<LLMConversationInteraction> {
		let interaction = await this.loadInteraction(conversationId);
		if (!interaction) {
			interaction = await this.createInteraction(conversationId);
		}
		this.primaryInteractionId = conversationId;
		this.addToolsToInteraction(interaction);
		return interaction;
	}

	private async loadInteraction(conversationId: ConversationId): Promise<LLMConversationInteraction | null> {
		logger.info(`Attempting to load existing conversation: ${conversationId}`);
		try {
			const persistence = await new ConversationPersistence(conversationId, this.projectEditor).init();

			const conversation = await persistence.loadConversation(this.llmProvider);
			if (!conversation) {
				logger.warn(`No conversation found for ID: ${conversationId}`);
				return null;
			}
			logger.info(`Loaded existing conversation: ${conversationId}`);

			//const metadata = await persistence.getMetadata();

			//this._providerRequestCount = conversation.providerRequestCount;
			this._turnCount = conversation.conversationStats.turnCount;
			this._totalTurnCount = conversation.conversationStats.totalTurnCount;
			this._statementCount = conversation.conversationStats.statementCount;
			this._tokenUsageTotals = conversation.tokenUsageConversation;

			this.interactionManager.addInteraction(conversation);

			return conversation;
		} catch (error) {
			logger.warn(`Failed to load conversation ${conversationId}: ${error.message}`);
			logger.error(`Error details:`, error);
			logger.debug(`Stack trace:`, error.stack);
			return null;
		}
	}

	async createInteraction(conversationId: ConversationId): Promise<LLMConversationInteraction> {
		const interaction = await this.interactionManager.createInteraction(
			'conversation',
			conversationId,
			this.llmProvider,
		);
		const systemPrompt = await this.promptManager.getPrompt('system', {
			userDefinedContent: 'You are an AI assistant helping with code and project management.',
		});
		interaction.baseSystem = systemPrompt;
		return interaction as LLMConversationInteraction;
	}

	async createAgentInteraction(parentId: ConversationId, title: string): Promise<LLMConversationInteraction> {
		const interactionId = generateConversationId();
		const agentInteraction = await this.interactionManager.createInteraction(
			'conversation',
			interactionId,
			this.llmProvider,
			parentId,
		) as LLMConversationInteraction;
		agentInteraction.title = title;
		return agentInteraction;
	}
	async createChatInteraction(parentId: ConversationId, title: string): Promise<LLMChatInteraction> {
		const interactionId = generateConversationId();
		const chatInteraction = await this.interactionManager.createInteraction(
			'chat',
			interactionId,
			this.llmProvider,
			parentId,
		) as LLMChatInteraction;
		chatInteraction.title = title;
		return chatInteraction;
	}

	async saveInitialConversationWithResponse(
		interaction: LLMConversationInteraction,
		currentResponse: LLMSpeakWithResponse,
	): Promise<void> {
		try {
			const persistence = await new ConversationPersistence(interaction.id, this.projectEditor).init();
			await persistence.saveConversation(interaction);

			// Save system prompt and project info if running in local development
			if (config.api?.environment === 'localdev') {
				await persistence.saveSystemPrompt(currentResponse.messageMeta.system);
				await persistence.saveProjectInfo(this.projectEditor.projectInfo);
			}

			logger.info(`Saved conversation: ${interaction.id}`);
		} catch (error) {
			logger.error(`Error persisting the conversation:`, error);
			throw error;
		}
	}

	async saveConversationAfterStatement(
		interaction: LLMConversationInteraction,
		currentResponse: LLMSpeakWithResponse,
	): Promise<void> {
		try {
			const persistence = await new ConversationPersistence(interaction.id, this.projectEditor).init();

			// Include the latest stats and usage in the saved conversation
			//interaction.conversationStats = this.interactionStats.get(interaction.id),
			//interaction.tokenUsageInteraction = this.interactionTokenUsage.get(interaction.id),

			await persistence.saveConversation(interaction);

			// Save system prompt and project info if running in local development
			if (config.api?.environment === 'localdev') {
				await persistence.saveSystemPrompt(currentResponse.messageMeta.system);
				await persistence.saveProjectInfo(this.projectEditor.projectInfo);
			}
		} catch (error) {
			logger.error(`Error persisting the conversation:`, error);
			throw error;
		}
	}

	createAgentController(): AgentController {
		if (!this.primaryInteractionId || !this.interactionManager.hasInteraction(this.primaryInteractionId)) {
			throw new Error('Primary interaction not initialized or not found');
		}
		const agentController = new AgentController(
			this.interactionManager,
			this.llmProvider,
			this.primaryInteractionId,
		);
		const agentInteractionId = agentController.getId();
		this.agentControllers.set(agentInteractionId, agentController);
		return agentController;
	}

	async manageAgentTasks(
		tasks: Task[],
		_sync: boolean = false,
		errorConfig: ErrorHandlingConfig = { strategy: 'fail_fast' },
	): Promise<void> {
		if (!this.primaryInteractionId || !this.interactionManager.hasInteraction(this.primaryInteractionId)) {
			throw new Error('Primary interaction not initialized or not found');
		}

		const results = await Promise.all(tasks.map(async (task) => {
			if (!this.primaryInteractionId) throw new Error('Primary interaction not initialized or not found');

			const agentInteraction = await this.createAgentInteraction(this.primaryInteractionId, task.title);
			if (!agentInteraction) {
				throw new Error(`Failed to create agent interaction for task: ${task.title}`);
			}

			try {
				//////     start an agent and run handleStatement
				/*
				const result = await this.delegateTasksTool.execute({
					tasks: [task],
					sync: true,
					errorConfig,
					parentInteractionId: agentInteractionId,
				});
				this.interactionManager.setInteractionResult(agentInteractionId, result);
				 */

				return { taskTitle: task.title, result: '', error: null };
			} catch (error) {
				logger.error(`Error executing task: ${task.title}`, error);
				return { taskTitle: task.title, result: null, error };
			}
		}));

		const errors = results.filter((r) => r.error);
		if (errors.length > 0) {
			if (errorConfig.strategy === 'fail_fast') {
				throw new Error(`Failed to execute tasks: ${errors.map((e) => e.taskTitle).join(', ')}`);
			} else if (
				errorConfig.strategy === 'continue_on_error' &&
				errors.length > (errorConfig.continueOnErrorThreshold || 0)
			) {
				throw new Error(`Too many tasks failed: ${errors.length} out of ${tasks.length}`);
			}
		}

		logger.info('Delegated tasks completed', { results });
	}

	private getInteractionCallbacks(): any { // Replace 'any' with appropriate type
		return {
			PROJECT_ROOT: () => this.projectEditor.projectRoot,
			PROJECT_INFO: () => this.projectEditor.projectInfo,
			PROJECT_FILE_CONTENT: async (filePath: string): Promise<string> =>
				await readProjectFileContent(this.projectEditor.projectRoot, filePath),
			LOG_ENTRY_HANDLER: async (
				type: ConversationLoggerEntryType,
				timestamp: string,
				content: string,
				conversationStats: ConversationMetrics,
				tokenUsageTurn: TokenUsage,
				tokenUsageStatement: TokenUsage,
				tokenUsageConversation: ConversationTokenUsage,
			): Promise<void> => {
				const conversationEntry: ConversationEntry = {
					type,
					timestamp,
					conversationId: this.primaryInteraction.id,
					conversationTitle: this.primaryInteraction.title,
					content,
					conversationStats,
					tokenUsageTurn: tokenUsageTurn,
					tokenUsageStatement: tokenUsageStatement,
					tokenUsageConversation: tokenUsageConversation,
				};
				this.eventManager.emit(
					'projectEditor:conversationEntry',
					conversationEntry as EventPayloadMap['projectEditor']['projectEditor:conversationEntry'],
				);
			},
			PREPARE_SYSTEM_PROMPT: async (system: string, interactionId: string): Promise<string> => {
				const interaction = this.interactionManager.getInteraction(interactionId);
				return interaction ? await interaction.prepareSytemPrompt(system) : system;
			},
			PREPARE_MESSAGES: async (messages: LLMMessage[], interactionId: string): Promise<LLMMessage[]> => {
				const interaction = this.interactionManager.getInteraction(interactionId);
				return interaction ? await interaction.prepareMessages(messages) : messages;
			},
			PREPARE_TOOLS: async (tools: LLMTool[], interactionId: string): Promise<LLMTool[]> => {
				const interaction = this.interactionManager.getInteraction(interactionId);
				return interaction ? await interaction.prepareTools(tools) : tools;
			},
		};
	}

	/*
	async getInteractionResult(interactionId: ConversationId): Promise<any> {
		const interaction = this.interactionManager.getInteractionStrict(interactionId);
		return interaction.getResult();
	}
 */

	async cleanupAgentInteractions(parentId: ConversationId): Promise<void> {
		const descendants = this.interactionManager.getAllDescendantInteractions(parentId);
		for (const descendant of descendants) {
			this.interactionManager.removeInteraction(descendant.id);
		}
	}

	private async generateConversationTitle(statement: string, interactionId: string): Promise<string> {
		const chatInteraction = await this.createChatInteraction(interactionId, 'Create title for conversation');
		return generateConversationTitle(chatInteraction, statement);
	}

	private addToolsToInteraction(interaction: LLMConversationInteraction): void {
		const tools = this.toolManager.getAllTools();
		interaction.addTools(tools);
	}

	private async handleToolUse(
		interaction: LLMConversationInteraction,
		toolUse: LLMAnswerToolUse,
		_response: unknown,
	): Promise<string> {
		interaction.conversationLogger?.logToolUse(
			toolUse.toolName,
			toolUse.toolInput,
			interaction.conversationStats,
			interaction.tokenUsageTurn,
			interaction.tokenUsageStatement,
			interaction.tokenUsageInteraction,
		);
		const { messageId: _messageId, toolResponse, bbaiResponse, isError } = await this.toolManager.handleToolUse(
			interaction,
			toolUse,
			this.projectEditor,
		);
		if (isError) {
			interaction.conversationLogger?.logError(`Tool Result (${toolUse.toolName}): ${toolResponse}`);
		}
		interaction.conversationLogger?.logToolResult(
			toolUse.toolName,
			`BBai was ${isError ? 'unsuccessful' : 'successful'} with tool run: \n${bbaiResponse}`,
			//interaction.conversationStats,
			//interaction.tokenUsageStatement, // token usage is recorded with the tool use
		);

		return toolResponse;
	}

	async handleStatement(statement: string, conversationId: ConversationId): Promise<ConversationResponse> {
		this.isCancelled = false;
		const interaction = this.interactionManager.getInteraction(conversationId) as LLMConversationInteraction;
		if (!interaction) {
			throw new Error(`No interaction found for ID: ${conversationId}`);
		}
		if (!statement) {
			this.eventManager.emit(
				'projectEditor:conversationError',
				{
					conversationId: interaction.id,
					conversationTitle: interaction.title || '',
					conversationStats: {
						statementCount: this.statementCount,
						turnCount: this.turnCount,
						totalTurnCount: this.totalTurnCount,
					},
					error: 'Missing statement',
					code: 'EMPTY_PROMPT' as const,
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

		if (!interaction.title) {
			interaction.title = await this.generateConversationTitle(statement, interaction.id);
		}
		await this.projectEditor.updateProjectInfo();

		this._turnCount = 0;
		this._totalTurnCount++;
		this._statementCount++;

		const conversationReady: ConversationStart & { conversationStats: ConversationMetrics } = {
			conversationId: interaction.id,
			conversationTitle: interaction.title,
			timestamp: new Date().toISOString(),
			conversationStats: {
				statementCount: this.statementCount,
				turnCount: this.turnCount,
				totalTurnCount: this.totalTurnCount,
			},
			//tokenUsageStatement: {inputTokens:0,outputTokens:0,totalTokens:0},
			tokenUsageConversation: this.tokenUsageTotals,
		};
		this.eventManager.emit(
			'projectEditor:conversationReady',
			conversationReady as EventPayloadMap['projectEditor']['projectEditor:conversationReady'],
		);

		const speakOptions: LLMSpeakWithOptions = {
			//temperature: 0.7,
			//maxTokens: 1000,
		};

		let currentResponse: LLMSpeakWithResponse | null = null;
		const maxTurns = 25; // Maximum number of turns for the run loop

		try {
			logger.info(
				`Calling conversation.converse for turn ${this.turnCount} with statement: "${
					statement.substring(0, 50)
				}..."`,
			);

			currentResponse = await interaction.converse(statement, speakOptions);
			logger.info('Received response from LLM');
			//logger.debug('LLM Response:', currentResponse);

			// Update orchestrator's stats
			this.updateStats(interaction.id, interaction.getAllStats());
		} catch (error) {
			logger.error(`Error in LLM communication:`, error);
			throw error;
		}

		// Save the conversation immediately after the first response
		logger.info(
			`Saving conversation at beginning of statement: ${interaction.id}[${this.statementCount}][${this.turnCount}]`,
		);
		await this.saveInitialConversationWithResponse(interaction, currentResponse);

		while (this.turnCount < maxTurns && !this.isCancelled) {
			try {
				// Handle tool calls and collect toolResponse
				let toolFeedback = '';
				if (currentResponse.messageResponse.toolsUsed && currentResponse.messageResponse.toolsUsed.length > 0) {
					for (const toolUse of currentResponse.messageResponse.toolsUsed) {
						//logger.info('Handling tool', toolUse);
						try {
							const toolResponse = await this.handleToolUse(
								interaction,
								toolUse,
								currentResponse.messageResponse,
							);
							toolFeedback += toolResponse + '\n';
						} catch (error) {
							logger.warn(`Error handling tool ${toolUse.toolName}: ${error.message}`);
							toolFeedback += `Error with ${toolUse.toolName}: ${error.message}\n`;
						}
					}
				}

				// If there's tool toolResponse, send it back to the LLM
				if (toolFeedback) {
					try {
						await this.projectEditor.updateProjectInfo();

						statement =
							`Tool use feedback:\n${toolFeedback}\nPlease acknowledge this feedback and continue the conversation.`;

						this._turnCount++;
						this._totalTurnCount++;

						currentResponse = await interaction.speakWithLLM(statement, speakOptions);

						/*
						// Emit conversation entry event with updated stats
						this.eventManager.emit(
							'projectEditor:conversationEntry',
							{
								type: 'human',
								timestamp: new Date().toISOString(),
								content: statement,
								...getConversationStats(),
							} as EventPayloadMap['projectEditor']['projectEditor:conversationEntry']
						);
						 */
						//logger.info('tool response', currentResponse);
					} catch (error) {
						logger.error(`Error in LLM communication: ${error.message}`);
						throw error; // This error is likely fatal, so we'll throw it to be caught by the outer try-catch
					}
				} else {
					// No more tool toolResponse, exit the loop
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

		//if (this.formatCommand) await runFormatCommand(this.projectRoot, this.formatCommand);

		if (this.isCancelled) {
			logger.warn('Operation was cancelled.');
		} else if (this.turnCount >= maxTurns) {
			logger.warn(`Reached maximum number of turns (${maxTurns}) in conversation.`);
		}

		// Final save of the entire conversation at the end of the loop
		logger.info(
			`Saving conversation at end of statement: ${interaction.id}[${this.statementCount}][${this.turnCount}]`,
		);
		await this.saveConversationAfterStatement(interaction, currentResponse);
		logger.info(
			`Final save of conversation: ${interaction.id}[${this.statementCount}][${this.turnCount}]`,
		);
		logger.info(
			`Final save of conversation: ${interaction.id}[${this.statementCount}][${this.turnCount}]`,
		);

		/*
		const getConversationStats = (interaction: LLMConversationInteraction) => ({
			conversationId: interaction.id || '',
			conversationTitle: interaction.title || '',
			conversationStats: {
				statementCount: this.statementCount,
				turnCount: this.turnCount,
				totalTurnCount: this.totalTurnCount,
			},
			tokenUsageConversation : currentResponse.messageResponse.usage || this.tokenUsageTotals,
		});
 */

		const statementAnswer: ConversationResponse = {
			response: currentResponse.messageResponse,
			messageMeta: currentResponse.messageMeta,
			conversationId: interaction.id,
			conversationTitle: interaction.title,
			conversationStats: {
				statementCount: this.statementCount,
				turnCount: this.turnCount,
				totalTurnCount: this.totalTurnCount,
			},
			tokenUsageStatement: currentResponse.messageResponse.usage || {
				inputTokens: 0,
				outputTokens: 0,
				totalTokens: 0,
			},
			tokenUsageConversation: this.tokenUsageTotals,
		};

		this.eventManager.emit(
			'projectEditor:conversationAnswer',
			statementAnswer as EventPayloadMap['projectEditor']['projectEditor:conversationAnswer'],
		);

		return statementAnswer;
	}

	async cancelCurrentOperation(conversationId: ConversationId): Promise<void> {
		logger.info(`Cancelling operation for conversation: ${conversationId}`);
		this.isCancelled = true;
		// TODO: Implement cancellation of current LLM call if possible
		// This might involve using AbortController or similar mechanism
		// depending on how the LLM provider's API is implemented
	}

	public async stageAndCommitAfterPatching(interaction: LLMConversationInteraction): Promise<void> {
		//if (!interaction) {
		//	throw new Error(`No interaction found for ID: ${interaction.id}`);
		//}
		const projectEditor = this.projectEditor;
		await stageAndCommitAfterPatching(
			interaction,
			projectEditor.projectRoot,
			projectEditor.patchedFiles,
			projectEditor.patchContents,
			projectEditor,
		);
		projectEditor.patchedFiles.clear();
		projectEditor.patchContents.clear();
	}

	async revertLastPatch(): Promise<void> {
		const primaryInteraction = this.primaryInteraction;
		if (!primaryInteraction) {
			throw new Error('No active conversation. Cannot revert patch.');
		}

		const persistence = await new ConversationPersistence(primaryInteraction.id, this.projectEditor).init();
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

export default OrchestratorController;
