import { join } from '@std/path';
import { ensureDir } from '@std/fs';

import type { ConversationId } from 'api/types.ts';
import { getBbaiDir } from 'shared/dataDir.ts';
import { LogFormatter } from 'shared/logFormatter.ts';
//import { logger } from 'shared/logger.ts';
import {
	LLMMessageContentPart,
	LLMMessageContentPartImageBlock,
	LLMMessageContentParts,
	LLMMessageContentPartTextBlock,
} from 'api/llms/llmMessage.ts';

export class ConversationLogger {
	private logFile!: string;

	constructor(private startDir: string, private conversationId: ConversationId) {}

	async initialize() {
		const bbaiDir = await getBbaiDir(this.startDir);
		const logsDir = join(bbaiDir, 'cache', 'conversations', this.conversationId);
		await ensureDir(logsDir);
		this.logFile = join(logsDir, 'conversation.log');
	}

	private async appendToLog(content: string) {
		await Deno.writeTextFile(this.logFile, content + '\n', { append: true });
	}

	private getTimestamp(): string {
		return new Date().toISOString();
	}

	private async logEntry(type: string, message: string) {
		const timestamp = this.getTimestamp();
		const entry = LogFormatter.createRawEntryWithSeparator(type, timestamp, message);
		await this.appendToLog(entry);
	}

	async logUserMessage(message: string) {
		await this.logEntry('User Message', message);
	}

	async logAssistantMessage(message: string) {
		await this.logEntry('Assistant Message', message);
	}

	async logAuxiliaryMessage(message: string) {
		await this.logEntry('Auxiliary Message', message);
	}

	async logToolUse(toolName: string, input: string) {
		const message = `Tool: ${toolName}\nInput: ${input}`;
		await this.logEntry('Tool Use', message);
	}

	async logToolResult(toolName: string, result: string | LLMMessageContentPart | LLMMessageContentParts) {
		const message = `Tool: ${toolName}\nResult: ${
			Array.isArray(result)
				? 'text' in result[0] ? (result[0] as LLMMessageContentPartTextBlock).text : JSON.stringify(result[0])
				: typeof result !== 'string'
				? 'text' in result ? (result as LLMMessageContentPartTextBlock).text : JSON.stringify(result)
				: result
		}`;
		await this.logEntry('Tool Result', message);
	}

	async logError(error: string) {
		await this.logEntry('Error', error);
	}

	async logDiffPatch(filePath: string, patch: string) {
		const message = `Diff Patch for ${filePath}:\n${patch}`;
		await this.logEntry('Diff Patch', message);
	}
}
