import { ensureDir, exists } from '@std/fs';
import { join } from '@std/path';
import LLMConversationInteraction from '../llms/interactions/conversationInteraction.ts';
import LLM from '../llms/providers/baseLLM.ts';
import { ConversationId } from 'shared/types.ts';
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
	private conversationMappingPath!: string;
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
		const bbaiDir = await this.projectEditor.getBbaiDir();
		const conversationDir = join(bbaiDir, 'cache', 'conversations');
		this.conversationDir = join(conversationDir, this.conversationId);
		await ensureDir(this.conversationDir);

		this.metadataPath = join(this.conversationDir, 'metadata.json');
		this.messagesPath = join(this.conversationDir, 'messages.jsonl');
		this.patchLogPath = join(this.conversationDir, 'patches.jsonl');
		this.conversationMappingPath = join(this.conversationDir, 'conversation_mapping.json');
		this.filesDir = join(this.conversationDir, 'files');
		await ensureDir(this.filesDir);
		return this;
	}

	static async listConversations(_options: {
		page: number;
		pageSize: number;
		startDate?: Date;
		endDate?: Date;
		llmProviderName?: string;
	}): Promise<any[]> {
		// TODO: Implement actual conversation listing logic
		// This is a placeholder implementation
		return [];
	}

	async saveConversation(conversation: LLMConversationInteraction): Promise<void> {
		try {
			await this.ensureInitialized();
			await this.updateConversationMapping(conversation.id, conversation.title);

			const metadata = {
				id: conversation.id,
				title: conversation.title,
				llmProviderName: conversation.llmProviderName,
				system: conversation.baseSystem,
				model: conversation.model,
				maxTokens: conversation.maxTokens,
				temperature: conversation.temperature,
				turnCount: conversation.turnCount,
				totalTokenUsage: conversation.totalTokenUsage,
				tools: conversation.getAllTools(),
				//tools: this.projectEditor.toolManager.getAllTools(),
				// following attributes are for reference only; they are not set when conversation is loaded
				projectInfoType: this.projectEditor.projectInfo.type,
				projectInfoTier: this.projectEditor.projectInfo.tier,
				projectInfoContent: '',
			};

			if (config.api?.environment === 'localdev') {
				metadata.projectInfoContent = this.projectEditor.projectInfo.content;
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
			const metadata = JSON.parse(metadataContent);
			const conversation = new LLMConversationInteraction(llm, this.conversationId);
			await conversation.init();

			conversation.id = metadata.id;
			conversation.title = metadata.title;
			conversation.baseSystem = metadata.system;
			conversation.model = metadata.model;
			conversation.maxTokens = metadata.maxTokens;
			conversation.temperature = metadata.temperature;
			conversation.updateTotals(metadata.totalTokenUsage, metadata.turnCount);
			conversation.addTools(metadata.tools);

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

	private async updateConversationMapping(id: string, title: string): Promise<void> {
		let mapping: {
			idToTitle: Record<string, string>;
			titleToId: Record<string, string>;
		} = {
			idToTitle: {},
			titleToId: {},
		};

		if (await exists(this.conversationMappingPath)) {
			const content = await Deno.readTextFile(this.conversationMappingPath);
			mapping = JSON.parse(content);
		}

		// Update both mappings
		mapping.idToTitle[id] = title;
		mapping.titleToId[title] = id;

		await Deno.writeTextFile(
			this.conversationMappingPath,
			JSON.stringify(mapping, null, 2),
		);

		logger.info(
			`Updated conversation mapping for conversation: ${id} with title: ${title}`,
		);
	}

	async getConversationIdByTitle(title: string): Promise<string | null> {
		if (await exists(this.conversationMappingPath)) {
			const content = await Deno.readTextFile(this.conversationMappingPath);
			const mapping = JSON.parse(content);
			return mapping.titleToId[title] || null;
		}
		return null;
	}

	async getConversationTitleById(id: string): Promise<string | null> {
		if (await exists(this.conversationMappingPath)) {
			const content = await Deno.readTextFile(this.conversationMappingPath);
			const mapping = JSON.parse(content);
			return mapping.idToTitle[id] || null;
		}
		return null;
	}

	async getAllConversations(): Promise<{ id: string; title: string }[]> {
		if (await exists(this.conversationMappingPath)) {
			const content = await Deno.readTextFile(this.conversationMappingPath);
			const mapping = JSON.parse(content) as {
				idToTitle: Record<string, string>;
				titleToId: Record<string, string>;
			};
			return Object.entries(mapping.idToTitle).map(([id, title]) => ({ id, title }));
		}
		return [];
	}

	async saveMetadata(metadata: { statementCount: number; totalTurnCount: number }): Promise<void> {
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
