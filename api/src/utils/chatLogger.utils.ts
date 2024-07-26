import { join } from '@std/path';
import { ensureDir } from '@std/fs';
import { format } from '@std/datetime';

import { getBbaiDir } from 'shared/dataDir.ts';
import { logger } from 'shared/logger.ts';

const ANSI_RESET = '\x1b[0m';
const ANSI_RED = '\x1b[31m';
const ANSI_GREEN = '\x1b[32m';
const ANSI_YELLOW = '\x1b[33m';
const ANSI_BLUE = '\x1b[34m';

const INDENT = '  ';
const MAX_LINE_LENGTH = 80;
const USER_ICON = '👤';
const ASSISTANT_ICON = '🤖';
const TOOL_ICON = '🔧';
const ERROR_ICON = '❌';

export class ChatLogger {
	private logFile!: string;

	constructor(private startDir: string, private conversationId: string) {}

	async initialize() {
		logger.debug(`ChatLogger startDir: ${this.startDir}`);
		const bbaiDir = await getBbaiDir(this.startDir);
		const logsDir = join(bbaiDir, 'cache', 'conversations', this.conversationId);
		logger.debug(`ChatLogger: ${logsDir}`);
		await ensureDir(logsDir);
		this.logFile = join(logsDir, 'chat.log');
	}

	private async appendToLog(content: string) {
		await Deno.writeTextFile(this.logFile, content + '\n', { append: true });
	}

	private getTimestamp(): string {
		return format(new Date(), "yyyy-MM-dd'T'HH:mm:ss.SSSXXX");
	}

	private wrapText(text: string, indent: string): string {
		const words = text.split(' ');
		let line = '';
		const lines = [];

		for (const word of words) {
			if ((line + word).length > MAX_LINE_LENGTH - indent.length) {
				lines.push(indent + line.trim());
				line = '';
			}
			line += word + ' ';
		}
		lines.push(indent + line.trim());

		return lines.join('\n');
	}

	private async logEntry(icon: string, color: string, type: string, message: string) {
		const timestamp = this.getTimestamp();
		const header = `${color}╭─ ${icon} ${type} [${timestamp}]${ANSI_RESET}`;
		const footer = `${color}╰${'─'.repeat(MAX_LINE_LENGTH - 2)}${ANSI_RESET}`;
		const wrappedMessage = this.wrapText(message, INDENT);

		const formattedMessage = `${header}\n${wrappedMessage}\n${footer}\n`;
		await this.appendToLog(formattedMessage);
	}

	async logUserMessage(message: string) {
		await this.logEntry(USER_ICON, ANSI_GREEN, 'User', message);
	}

	async logAssistantMessage(message: string) {
		await this.logEntry(ASSISTANT_ICON, ANSI_BLUE, 'Assistant', message);
	}

	async logToolUse(toolName: string, input: string) {
		const message = `Tool Use: ${toolName}\nInput: ${input}`;
		await this.logEntry(TOOL_ICON, ANSI_YELLOW, 'Tool', message);
	}

	async logToolResult(toolName: string, result: string) {
		const message = `Tool Result: ${toolName}\nResult: ${result}`;
		await this.logEntry(TOOL_ICON, ANSI_YELLOW, 'Tool', message);
	}

	async logError(error: string) {
		await this.logEntry(ERROR_ICON, ANSI_RED, 'Error', error);
	}

	async logDiffPatch(filePath: string, patch: string) {
		const message = `Diff Patch for ${filePath}:\n${patch}`;
		await this.logEntry(TOOL_ICON, ANSI_YELLOW, 'Diff', message);
	}

	async logSeparator() {
		const separator = `${ANSI_BLUE}${'─'.repeat(MAX_LINE_LENGTH)}${ANSI_RESET}\n`;
		await this.appendToLog(separator);
	}
}
