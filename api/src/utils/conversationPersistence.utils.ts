import { ensureDir, exists } from '@std/fs';
import { join } from '@std/path';
import LLMConversation from '../llms/conversation.ts';
import LLMMessage, { LLMMessageProviderResponse } from '../llms/message.ts';
import LLM from '../llms/providers/baseLLM.ts';
import { logger } from 'shared/logger.ts';
import { createError, ErrorType } from './error.utils.ts';
import { FileHandlingErrorOptions } from '../errors/error.ts';
import { ProjectEditor } from '../editor/projectEditor.ts';

export class ConversationPersistence {
	private conversationDir!: string;
	private metadataPath!: string;
	private messagesPath!: string;
	private patchLogPath!: string;
	private filesDir!: string;
	private initialized: boolean = false;

	constructor(private conversationId: string, private projectEditor: ProjectEditor) {
		this.ensureInitialized();
	}

	private async ensureInitialized(): Promise<void> {
		if (!this.initialized) {
			await this.init();
			this.initialized = true;
		}
	}

	async init(): Promise<void> {
		const bbaiDir = await this.projectEditor.getBbaiDir();
		const conversationsDir = join(bbaiDir, 'cache', 'conversations');
		this.conversationDir = join(conversationsDir, this.conversationId);
		this.metadataPath = join(this.conversationDir, 'metadata.json');
		this.messagesPath = join(this.conversationDir, 'messages.jsonl');
		this.patchLogPath = join(this.conversationDir, 'patches.jsonl');
		this.filesDir = join(this.conversationDir, 'files');
		await ensureDir(this.conversationDir);
		await ensureDir(this.filesDir);
	}

	static async listConversations(options: {
		page: number;
		pageSize: number;
		startDate?: Date;
		endDate?: Date;
		providerName?: string;
	}): Promise<any[]> {
		// TODO: Implement actual conversation listing logic
		// This is a placeholder implementation
		return [];
	}

	async saveConversation(conversation: LLMConversation): Promise<void> {
		// TODO: There is a `building-fast` branch that has the previous "optimized, but buggy" solution.
		// This current implementation is simpler but may be less efficient.
		try {
			await this.ensureInitialized();

			const metadata = {
				id: conversation.id,
				providerName: conversation.providerName,
				system: conversation.baseSystem,
				model: conversation.model,
				maxTokens: conversation.maxTokens,
				temperature: conversation.temperature,
				turnCount: conversation.turnCount,
				totalTokenUsage: conversation.totalTokenUsage,
				tools: conversation.getTools(),
				repositoryInfo: {
					type: conversation.ctagsContent ? 'ctags' : 'fileListing',
					content: conversation.ctagsContent ? 'ctags' : conversation.fileListingContent ? 'fileListing' : null,
					tier: conversation.repositoryInfoTier
				}
			};

			await Deno.writeTextFile(this.metadataPath, JSON.stringify(metadata, null, 2));
			logger.info(`Saved metadata for conversation: ${conversation.id}`);

			// Save messages
			const messages = conversation.getMessages();
			const messagesContent = messages.map((m) =>
				JSON.stringify({
					role: m.role,
					content: m.content,
					id: m.id,
					providerResponse: m.providerResponse,
				})
			).join('\n') + '\n';
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

	async loadConversation(llm: LLM): Promise<LLMConversation> {
		await this.ensureInitialized();

		if (!await exists(this.metadataPath)) {
			throw new Error(`Conversation metadata file not found: ${this.metadataPath}`);
		}

		const metadataContent = await Deno.readTextFile(this.metadataPath);
		const metadata = JSON.parse(metadataContent);
		const conversation = new LLMConversation(llm);

		conversation.id = metadata.id;
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
				const turnData = JSON.parse(line);
				conversation.addMessage(turnData.message);
				if (turnData.response) {
					conversation.addMessage(turnData.response);
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
						await conversation.addFileForSystemPrompt(filePath, fileMetadata);
					} else {
						await conversation.addFileToMessageArray(filePath, fileMetadata, fileMetadata.toolUseId);
					}
					logger.info(`Loaded file: ${filePath}`);
				}
			}
		}

		return conversation;
	}

	async logPatch(filePath: string, patch: string): Promise<void> {
		const patchEntry = JSON.stringify({
			timestamp: new Date().toISOString(),
			filePath,
			patch,
		}) + '\n';

		await Deno.writeTextFile(this.patchLogPath, patchEntry, { append: true });
	}

	async getPatchLog(): Promise<Array<{ timestamp: string; filePath: string; patch: string }>> {
		if (!await exists(this.patchLogPath)) {
			return [];
		}

		const content = await Deno.readTextFile(this.patchLogPath);
		const lines = content.trim().split('\n');

		return lines.map((line) => JSON.parse(line));
	}

	async removeLastPatch(): Promise<void> {
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
