import { join } from '@std/path';
import { ensureDir } from '@std/fs';
import { format } from '@std/datetime';
//import { unicodeWidth } from "@std/cli/unicode-width";

import type { ConversationId } from '../types.ts';
import { getBbaiDir } from 'shared/dataDir.ts';
import { logger } from 'shared/logger.ts';

const ANSI_RESET = '\x1b[0m';
const ANSI_RED = '\x1b[31m';
const ANSI_GREEN = '\x1b[32m';
const ANSI_CYAN = '\x1b[36m';
const ANSI_YELLOW = '\x1b[33m';
const ANSI_BLUE = '\x1b[34m';

const INDENT = '│ ';
const USER_ICON = '👤';
const ASSISTANT_ICON = '🤖';
const TOOL_ICON = '🔧';
const AUXILIARY_ICON = '📎';
const ERROR_ICON = '❌';

export class ConversationLogger {
	private logFile!: string;
	private maxLineLength: number;

	constructor(private startDir: string, private conversationId: ConversationId, maxLineLength?: number) {
		this.maxLineLength = this.getMaxLineLength(maxLineLength);
	}

	private getMaxLineLength(userDefinedLength?: number): number {
		if (userDefinedLength && userDefinedLength > 0) {
			return userDefinedLength;
		}
		//const { columns } = consoleSize(Deno.stdout.rid);
		const { columns, rows: _rows } = Deno.consoleSize();
		return columns > 0 ? columns : 120; // Default to 120 if unable to determine console width
	}

	// ... (rest of the existing methods)

	async initialize() {
		logger.debug(`ConversationLogger startDir: ${this.startDir}`);
		const bbaiDir = await getBbaiDir(this.startDir);
		const logsDir = join(bbaiDir, 'cache', 'conversations', this.conversationId);
		logger.debug(`ConversationLogger: ${logsDir}`);
		await ensureDir(logsDir);
		this.logFile = join(logsDir, 'conversation.log');
	}

	private async appendToLog(content: string) {
		await Deno.writeTextFile(this.logFile, content + '\n', { append: true });
	}

	private getTimestamp(): string {
		return format(new Date(), "yyyy-MM-dd'T'HH:mm:ss.SSSXXX");
	}

	private wrapText(text: string, indent: string, tail: string): string {
		const words = text.trim().split(/\s+/);
		let line = indent;
		const lines = [];

		for (const word of words) {
			if ((line + word).length > this.maxLineLength - tail.length) {
				lines.push(line.trimEnd() + tail);
				line = indent + word + ' ';
			} else {
				line += word + ' ';
			}
		}
		if (line.trim()) {
			lines.push(line.trimEnd() + tail);
		}

		return lines.join('\n');
	}

	private async logEntry(icon: string, color: string, type: string, message: string) {
		const timestamp = this.getTimestamp();
		const header = `${color}╭─ ${icon} ${type} [${timestamp}]${ANSI_RESET}`;
		const footer = `${color}╰${'─'.repeat(this.maxLineLength - 1)}${ANSI_RESET}`;
		const wrappedMessage = this.wrapText(message, `${color}${INDENT}`, `${ANSI_RESET}`);

		const formattedMessage = `${header}\n${wrappedMessage}\n${footer}\n`;
		await this.appendToLog(formattedMessage);
	}

	async logUserMessage(message: string) {
		await this.logEntry(USER_ICON, ANSI_GREEN, 'User', message);
	}

	async logAssistantMessage(message: string) {
		await this.logEntry(ASSISTANT_ICON, ANSI_BLUE, 'Assistant', message);
	}

	async logAuxiliaryMessage(message: string) {
		await this.logEntry(AUXILIARY_ICON, ANSI_CYAN, 'Auxiliary', message);
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
		const separator = `${ANSI_BLUE}${'─'.repeat(this.maxLineLength)}${ANSI_RESET}\n`;
		await this.appendToLog(separator);
	}
}
