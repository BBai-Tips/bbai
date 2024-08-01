import { join } from '@std/path';
import { ensureDir } from '@std/fs';

import type { ConversationId } from '../../../api/src/types.ts';
import { getBbaiDir } from 'shared/dataDir.ts';
import { LogFormatter } from 'shared/logFormatter.ts';
//import { logger } from 'shared/logger.ts';

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
		const entry = LogFormatter.createRawEntry(type, timestamp, message);
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

	async logToolResult(toolName: string, result: string) {
		const message = `Tool: ${toolName}\nResult: ${result}`;
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
