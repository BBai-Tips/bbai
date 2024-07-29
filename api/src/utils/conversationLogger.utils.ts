import { join } from '@std/path';
import { ensureDir } from '@std/fs';

import type { ConversationId } from '../types.ts';
import { getBbaiDir } from 'shared/dataDir.ts';
import { logger } from 'shared/logger.ts';

const ANSI_RESET = '\x1b[0m';
const ANSI_RED = '\x1b[31m';
const ANSI_GREEN = '\x1b[32m';
const ANSI_CYAN = '\x1b[36m';
const ANSI_YELLOW = '\x1b[33m';
const ANSI_BLUE = '\x1b[34m';

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
		await Deno.writeTextFile(this.logFile, content + '\n\n', { append: true });
	}

	private getTimestamp(): string {
		return new Date().toISOString();
	}

	private async logEntry(type: string, message: string) {
		const timestamp = this.getTimestamp();
		const entry = `## ${type} [${timestamp}]\n${message}`;
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
