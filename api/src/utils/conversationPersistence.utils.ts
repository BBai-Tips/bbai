import { ensureDir, exists } from '@std/fs';
import { join } from '@std/path';
import LLMConversation from '../llms/conversation.ts';
import LLM from '../llms/providers/baseLLM.ts';
import { logger } from 'shared/logger.ts';

export class ConversationPersistence {
	private filePath: string;
	private patchLogPath: string;
	private filesDir: string;

	constructor(conversationId: string) {
		const cacheDir = join(Deno.env.get('HOME') || '', '.bbai', 'cache');
		this.filePath = join(cacheDir, `${conversationId}.jsonl`);
		this.patchLogPath = join(cacheDir, `${conversationId}_patches.jsonl`);
		this.filesDir = join(cacheDir, conversationId, 'files');
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
		try {
			await ensureDir(join(this.filePath, '..'));
			await ensureDir(this.filesDir);

			const metadata = {
				id: conversation.id,
				providerName: conversation.providerName,
				system: conversation.system,
				model: conversation.model,
				maxTokens: conversation.maxTokens,
				temperature: conversation.temperature,
			};

			const metadataLine = JSON.stringify(metadata) + '\n';

			if (!await exists(this.filePath)) {
				await Deno.writeTextFile(this.filePath, metadataLine);
			}

			const lastMessage = conversation.getLastMessage();
			const lastResponse = conversation.getLastMessageProviderResponse();

			const turnData = {
				turnCount: conversation.turnCount,
				message: lastMessage,
				response: lastResponse,
				tokenUsage: conversation.totalTokenUsage,
				tools: conversation.getTools(),
			};

			const turnLine = JSON.stringify(turnData) + '\n';
			await Deno.writeTextFile(this.filePath, turnLine, { append: true });

			// Save files
			const files = conversation.getFiles();
			for (const [filePath, fileData] of files.entries()) {
				const fileStoragePath = join(this.filesDir, filePath);
				await ensureDir(join(fileStoragePath, '..'));
				await Deno.writeTextFile(fileStoragePath, fileData.content);
				await Deno.writeTextFile(`${fileStoragePath}.meta`, JSON.stringify(fileData.metadata));
			}
		} catch (error) {
			if (error instanceof Deno.errors.PermissionDenied) {
				throw createError(
					ErrorType.FileHandling,
					`Permission denied when saving conversation: ${this.filePath}`,
					{
						filePath: this.filePath,
						operation: 'write',
					} as FileHandlingErrorOptions,
				);
			} else if (error instanceof Deno.errors.NotFound) {
				throw createError(
					ErrorType.FileHandling,
					`File or directory not found when saving conversation: ${this.filePath}`,
					{
						filePath: this.filePath,
						operation: 'write',
					} as FileHandlingErrorOptions,
				);
			} else {
				logger.error(`Error saving conversation: ${error.message}`);
				throw createError(ErrorType.FileHandling, `Failed to save conversation: ${this.filePath}`, {
					filePath: this.filePath,
					operation: 'write',
				} as FileHandlingErrorOptions);
			}
		}
	}

	async loadConversation(llm: LLM): Promise<LLMConversation> {
		if (!await exists(this.filePath)) {
			throw new Error(`Conversation file not found: ${this.filePath}`);
		}

		const content = await Deno.readTextFile(this.filePath);
		const lines = content.trim().split('\n');

		if (lines.length === 0) {
			throw new Error('Conversation file is empty');
		}

		const metadata = JSON.parse(lines[0]);
		const conversation = new LLMConversation(llm);

		conversation.id = metadata.id;
		conversation.system = metadata.system;
		conversation.model = metadata.model;
		conversation.maxTokens = metadata.maxTokens;
		conversation.temperature = metadata.temperature;

		for (let i = 1; i < lines.length; i++) {
			const turnData = JSON.parse(lines[i]);
			conversation.addMessage(turnData.message);
			conversation.updateTotals(turnData.tokenUsage, 1);
			conversation.addTools(turnData.tools);
		}

		// Load files
		if (await exists(this.filesDir)) {
			for await (const entry of Deno.readDir(this.filesDir)) {
				if (entry.isFile && !entry.name.endsWith('.meta')) {
					const filePath = join(this.filesDir, entry.name);
					const content = await Deno.readTextFile(filePath);
					const metadataContent = await Deno.readTextFile(`${filePath}.meta`);
					const metadata = JSON.parse(metadataContent);

					if (metadata.path.startsWith('<file')) {
						await conversation.addFileToSystemPrompt(entry.name, content, metadata);
					} else {
						await conversation.addFileToMessageArray(entry.name, content, metadata);
					}
					logger.info(`Loaded file: ${entry.name}`);
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
