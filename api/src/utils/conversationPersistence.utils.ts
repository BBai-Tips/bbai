import { ensureDir, exists } from '@std/fs';
import { join } from '@std/path';
import { getProjectRoot } from 'shared/dataDir.ts';
import LLMConversationInteraction from '../llms/interactions/conversationInteraction.ts';
import LLM from '../llms/providers/baseLLM.ts';
import {
	ConversationDetailedMetadata,
	ConversationId,
	ConversationMetadata,
	ConversationMetrics,
	ConversationTokenUsage,
	TokenUsage,
} from 'shared/types.ts';

import { logger } from 'shared/logger.ts';
import { config } from 'shared/configManager.ts';
import { createError, ErrorType } from './error.utils.ts';
import { FileHandlingErrorOptions } from '../errors/error.ts';
import ProjectEditor from '../editor/projectEditor.ts';
import { ProjectInfo } from '../llms/interactions/conversationInteraction.ts';
import { stripIndents } from 'common-tags';

export class ConversationPersistence {
	private conversationDir!: string;
	private metadataPath!: string;
	private messagesPath!: string;
	private patchLogPath!: string;
	private conversationsMetadataPath!: string;
	private filesDir!: string;
	private initialized: boolean = false;

	constructor(private conversationId: ConversationId, private projectEditor: ProjectEditor) {
		//this.ensureInitialized();
	}

	private async ensureInitialized(): Promise<void> {
		if (!this.initialized) {
			await this.init();
			this.initialized = true;
		}
	}

	async init(): Promise<ConversationPersistence> {
		const bbaiDataDir = await this.projectEditor.getBbaiDataDir();
		const conversationsDir = join(bbaiDataDir, 'conversations');
		this.conversationsMetadataPath = join(bbaiDataDir, 'conversations.json');

		this.conversationDir = join(conversationsDir, this.conversationId);
		await ensureDir(this.conversationDir);

		this.metadataPath = join(this.conversationDir, 'metadata.json');
		this.messagesPath = join(this.conversationDir, 'messages.jsonl');
		this.patchLogPath = join(this.conversationDir, 'patches.jsonl');
		this.filesDir = join(this.conversationDir, 'files');
		await ensureDir(this.filesDir);
		return this;
	}

	static async listConversations(options: {
		page: number;
		pageSize: number;
		startDate?: Date;
		endDate?: Date;
		llmProviderName?: string;
		startDir: string;
	}): Promise<ConversationMetadata[]> {
		const projectRoot = await getProjectRoot(options.startDir);
		const bbaiDataDir = join(projectRoot, '.bbai', 'data');
		const conversationsDir = join(bbaiDataDir, 'conversations');
		const conversationsMetadataPath = join(bbaiDataDir, 'conversations.json');

		if (!await exists(conversationsMetadataPath)) {
			await Deno.writeTextFile(conversationsMetadataPath, JSON.stringify([]));
			return [];
		}

		const content = await Deno.readTextFile(conversationsMetadataPath);
		let conversations: ConversationMetadata[] = JSON.parse(content);

		// Apply filters
		if (options.startDate) {
			conversations = conversations.filter((conv) => new Date(conv.createdAt) >= options.startDate!);
		}
		if (options.endDate) {
			conversations = conversations.filter((conv) => new Date(conv.createdAt) <= options.endDate!);
		}
		if (options.llmProviderName) {
			conversations = conversations.filter((conv) => conv.llmProviderName === options.llmProviderName);
		}

		// Apply pagination
		const startIndex = (options.page - 1) * options.pageSize;
		conversations = conversations.slice(startIndex, startIndex + options.pageSize);

		return conversations;
	}

	async saveConversation(conversation: LLMConversationInteraction): Promise<void> {
		try {
			await this.ensureInitialized();

			logger.info(`Preparing to save metadata at project level for conversation: ${conversation.id}`);

			const metadata: ConversationMetadata = {
				id: conversation.id,
				title: conversation.title,
				llmProviderName: conversation.llmProviderName,
				model: conversation.model,
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			};

			await this.updateConversationsMetadata(metadata);

			logger.info(`Saved metadata to project level for conversation: ${conversation.id}`);

			const detailedMetadata: ConversationDetailedMetadata = {
				...metadata,
				system: conversation.baseSystem,
				temperature: conversation.temperature,
				maxTokens: conversation.maxTokens,

				conversationStats: {
					statementCount: conversation.statementCount,
					turnCount: conversation.turnCount,
					totalTurnCount: conversation.getTotalTurnCount(),
				},
				tokenUsage: {
					inputTokensTotal: conversation.getInputTokensTotal(),
					outputTokensTotal: conversation.getOutputTokensTotal(),
					totalTokensTotal: conversation.getTotalTokensTotal(),
				},

				tools: conversation.getAllTools().map((tool) => ({ name: tool.name, description: tool.description })),

				// following attributes are for reference only; they are not set when conversation is loaded
				projectInfoType: this.projectEditor.projectInfo.type,
				projectInfoTier: this.projectEditor.projectInfo.tier ?? undefined,
				projectInfoContent: this.projectEditor.projectInfo.content,
			};

			logger.info(`Preparing to save metadata for conversation: ${conversation.id}`);

			await Deno.writeTextFile(
				join(this.conversationDir, 'metadata.json'),
				JSON.stringify(detailedMetadata, null, 2),
			);
			logger.info(`Read metadata for conversation: ${conversation.id}`);

			// projectInfoContent is only included for 'localdev' environment
			if (config.api?.environment === 'localdev') {
				(metadata as any).projectInfoContent = this.projectEditor.projectInfo.content;
			}

			await Deno.writeTextFile(this.metadataPath, JSON.stringify(metadata, null, 2));
			logger.info(`Saved metadata for conversation: ${conversation.id}`);

			// Save messages
			const statementCount = conversation.statementCount || 0; // Assuming this property exists
			const messages = conversation.getMessages();
			const messagesContent = messages.map((m) => {
				if (m && typeof m === 'object') {
					return JSON.stringify({
						statementCount,
						turnCount: conversation.turnCount,
						role: m.role,
						content: m.content,
						id: m.id,
						providerResponse: m.providerResponse,
						timestamp: m.timestamp, // Assuming this property exists
					});
				} else {
					logger.warn(`Invalid message encountered: ${JSON.stringify(m)}`);
					return null;
				}
			}).filter(Boolean).join('\n') + '\n';
			await Deno.writeTextFile(this.messagesPath, messagesContent);
			logger.info(`Saved messages for conversation: ${conversation.id}`);

			// Save files
			const files = conversation.getFiles();
			for (const [filePath, fileData] of files.entries()) {
				const fileStoragePath = join(this.filesDir, filePath);
				await ensureDir(join(fileStoragePath, '..'));
				await Deno.writeTextFile(`${fileStoragePath}.meta`, JSON.stringify(fileData));
			}
			logger.info(`Saved files for conversation: ${conversation.id}`);
		} catch (error) {
			logger.error(`Error saving conversation: ${error.message}`);
			this.handleSaveError(error, this.metadataPath);
		}
	}

	async loadConversation(llm: LLM): Promise<LLMConversationInteraction | null> {
		try {
			await this.ensureInitialized();

			if (!await exists(this.metadataPath)) {
				//logger.warn(`Conversation metadata file not found: ${this.metadataPath}`);
				return null;
			}

			const metadataContent = await Deno.readTextFile(this.metadataPath);
			const metadata: ConversationDetailedMetadata = JSON.parse(metadataContent);
			const conversation = new LLMConversationInteraction(llm, this.conversationId);
			await conversation.init();

			conversation.id = metadata.id;
			conversation.title = metadata.title;
			conversation.baseSystem = metadata.system;
			conversation.model = metadata.model;
			conversation.maxTokens = metadata.maxTokens;
			conversation.temperature = metadata.temperature;
			conversation.updateTotals({
				inputTokens: metadata.tokenUsage.inputTokensTotal,
				outputTokens: metadata.tokenUsage.outputTokensTotal,
				totalTokens: metadata.tokenUsage.totalTokensTotal,
			}, metadata.conversationStats.turnCount);
			//conversation.addTools((metadata.tools || []).map(tool => ({ ...tool, input_schema: {}, validateInput: () => true, runTool: async () => ({ result: '' }) })));

			if (await exists(this.messagesPath)) {
				const messagesContent = await Deno.readTextFile(this.messagesPath);
				const messageLines = messagesContent.trim().split('\n');

				for (const line of messageLines) {
					try {
						const messageData = JSON.parse(line);
						conversation.addMessage(messageData);
					} catch (error) {
						logger.error(`Error parsing message: ${error.message}`);
						// Continue to the next message if there's an error
					}
				}
			}

			// Load files
			if (await exists(this.filesDir)) {
				for await (const entry of Deno.readDir(this.filesDir)) {
					if (entry.isFile && entry.name.endsWith('.meta')) {
						const filePath = join(this.filesDir, entry.name.replace('.meta', ''));
						const metadataContent = await Deno.readTextFile(join(this.filesDir, entry.name));
						const fileMetadata = JSON.parse(metadataContent);

						if (fileMetadata.inSystemPrompt) {
							conversation.addFileForSystemPrompt(filePath, fileMetadata);
						}
						logger.info(`Loaded file: ${filePath}`);
					}
				}
			}

			return conversation;
		} catch (error) {
			logger.error(`Error saving conversation: ${error.message}`);
			throw createError(
				ErrorType.FileHandling,
				`File or directory not found when loading conversation: ${this.metadataPath}`,
				{
					filePath: this.metadataPath,
					operation: 'read',
				} as FileHandlingErrorOptions,
			);
		}
	}

	private async updateConversationsMetadata(conversation: ConversationMetadata): Promise<void> {
		let conversations: ConversationMetadata[] = [];

		if (await exists(this.conversationsMetadataPath)) {
			const content = await Deno.readTextFile(this.conversationsMetadataPath);
			conversations = JSON.parse(content);
		}

		const index = conversations.findIndex((conv) => conv.id === conversation.id);
		if (index !== -1) {
			conversations[index] = conversation;
		} else {
			conversations.push(conversation);
		}

		await Deno.writeTextFile(
			this.conversationsMetadataPath,
			JSON.stringify(conversations, null, 2),
		);

		logger.info(
			`Updated conversations metadata for conversation: ${conversation.id}`,
		);
	}

	async getConversationIdByTitle(title: string): Promise<string | null> {
		if (await exists(this.conversationsMetadataPath)) {
			const content = await Deno.readTextFile(this.conversationsMetadataPath);
			const conversations: ConversationMetadata[] = JSON.parse(content);
			const conversation = conversations.find((conv) => conv.title === title);
			return conversation ? conversation.id : null;
		}
		return null;
	}

	async getConversationTitleById(id: string): Promise<string | null> {
		if (await exists(this.conversationsMetadataPath)) {
			const content = await Deno.readTextFile(this.conversationsMetadataPath);
			const conversations: ConversationMetadata[] = JSON.parse(content);
			const conversation = conversations.find((conv) => conv.id === id);
			return conversation ? conversation.title : null;
		}
		return null;
	}

	async getAllConversations(): Promise<{ id: string; title: string }[]> {
		if (await exists(this.conversationsMetadataPath)) {
			const content = await Deno.readTextFile(this.conversationsMetadataPath);
			const conversations: ConversationMetadata[] = JSON.parse(content);
			return conversations.map(({ id, title }) => ({ id, title }));
		}
		return [];
	}

	async saveMetadata(metadata: Partial<ConversationDetailedMetadata>): Promise<void> {
		await this.ensureInitialized();
		const existingMetadata = await this.getMetadata();
		const updatedMetadata = { ...existingMetadata, ...metadata };
		await Deno.writeTextFile(this.metadataPath, JSON.stringify(updatedMetadata, null, 2));
		logger.info(`Metadata saved for conversation: ${this.conversationId}`);
	}

	async getMetadata(): Promise<any> {
		await this.ensureInitialized();
		if (await exists(this.metadataPath)) {
			const metadataContent = await Deno.readTextFile(this.metadataPath);
			return JSON.parse(metadataContent);
		}
		return {};
	}

	async saveSystemPrompt(systemPrompt: string): Promise<void> {
		await this.ensureInitialized();
		const systemPromptPath = join(this.conversationDir, 'system_prompt.txt');
		await Deno.writeTextFile(systemPromptPath, systemPrompt);
		logger.info(`System prompt saved for conversation: ${this.conversationId}`);
	}

	async saveProjectInfo(projectInfo: ProjectInfo): Promise<void> {
		await this.ensureInitialized();
		const projectInfoPath = join(this.conversationDir, 'project_info.md');
		const content = stripIndents`---
			type: ${projectInfo.type}
			tier: ${projectInfo.tier ?? 'null'}
			---
			${projectInfo.content}
		`;
		await Deno.writeTextFile(projectInfoPath, content);
		logger.info(`Project info saved for conversation: ${this.conversationId}`);
	}

	// Remove the saveConversationMessage method as it's no longer needed

	private handleSaveError(error: unknown, filePath: string): never {
		if (error instanceof Deno.errors.PermissionDenied) {
			throw createError(
				ErrorType.FileHandling,
				`Permission denied when saving conversation: ${filePath}`,
				{
					filePath,
					operation: 'write',
				} as FileHandlingErrorOptions,
			);
		} else if (error instanceof Deno.errors.NotFound) {
			throw createError(
				ErrorType.FileHandling,
				`File or directory not found when saving conversation: ${filePath}`,
				{
					filePath,
					operation: 'write',
				} as FileHandlingErrorOptions,
			);
		} else {
			logger.error(`Error saving conversation: ${(error as Error).message}`);
			throw createError(ErrorType.FileHandling, `Failed to save conversation: ${filePath}`, {
				filePath,
				operation: 'write',
			} as FileHandlingErrorOptions);
		}
	}

	async logPatch(filePath: string, patch: string): Promise<void> {
		await this.ensureInitialized();

		const patchEntry = JSON.stringify({
			timestamp: new Date().toISOString(),
			filePath,
			patch,
		}) + '\n';
		logger.info(`Writing patch file: ${this.patchLogPath}`);

		await Deno.writeTextFile(this.patchLogPath, patchEntry, { append: true });
	}

	async getPatchLog(): Promise<Array<{ timestamp: string; filePath: string; patch: string }>> {
		await this.ensureInitialized();

		if (!await exists(this.patchLogPath)) {
			return [];
		}

		const content = await Deno.readTextFile(this.patchLogPath);
		const lines = content.trim().split('\n');

		return lines.map((line) => JSON.parse(line));
	}

	async removeLastPatch(): Promise<void> {
		await this.ensureInitialized();

		if (!await exists(this.patchLogPath)) {
			return;
		}

		const content = await Deno.readTextFile(this.patchLogPath);
		const lines = content.trim().split('\n');

		if (lines.length > 0) {
			lines.pop(); // Remove the last line
			await Deno.writeTextFile(this.patchLogPath, lines.join('\n') + '\n');
		}
	}
}
