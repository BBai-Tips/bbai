import { ensureDir, exists } from '@std/fs';
import { join } from '@std/path';
import LLMConversation from '../llms/conversation.ts';
import LLM from '../llms/providers/baseLLM.ts';
import { logger } from 'shared/logger.ts';

export class ConversationPersistence {
	private filePath: string;

	constructor(conversationId: string) {
		const cacheDir = join(Deno.env.get('HOME') || '', '.bbai', 'cache');
		this.filePath = join(cacheDir, `${conversationId}.jsonl`);
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
		await ensureDir(join(this.filePath, '..'));

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

		return conversation;
	}
}
