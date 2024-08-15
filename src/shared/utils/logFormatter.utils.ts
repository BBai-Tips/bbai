//import { consoleSize } from '@std/console';
import { stripIndents } from 'common-tags';
import { join } from '@std/path';
import { BufReader } from '@std/io';
import { colors } from 'cliffy/ansi/mod.ts';

import { getBbaiDataDir } from 'shared/dataDir.ts';
import { ConversationId, ConversationMetrics, ConversationTokenUsage, TokenUsage } from 'shared/types.ts';
import { config } from 'shared/configManager.ts';

// Define theme colors.
//const colorError = colors.bold.red;
//const colorWarn = colors.bold.yellow;
//const colorWnfo = colors.bold.blue;
// // Use theme colors.
//console.log(error("[ERROR]"), "Some error!");

const USER_ICON = '👤';
const ASSISTANT_ICON = '🤖';
const TOOL_ICON = '🔧';
const AUXILIARY_ICON = '📎';
const ERROR_ICON = '❌';
const UNKNOWN_ICON = '❓';
const CLOCK_ICON = '🕒'; // Clock emoji

import { ConversationLoggerEntryType } from 'shared/conversationLogger.ts';

export class LogFormatter {
	private static readonly ENTRY_SEPARATOR = '<<<BBAI_LOG_ENTRY_SEPARATOR>>>';

	private _maxLineLength: number;

	private static readonly iconColorMap: Record<
		ConversationLoggerEntryType,
		{ icon: string; color: (text: string) => string; label: string }
	> = {
		user: { icon: USER_ICON, color: colors.green, label: config.myPersonsName || 'Person' },
		assistant: { icon: ASSISTANT_ICON, color: colors.blue, label: config.myAssistantsName || 'Assistant' },
		tool_use: { icon: TOOL_ICON, color: colors.yellow, label: 'Tool Use' },
		tool_result: { icon: TOOL_ICON, color: colors.yellow, label: 'Tool Result' },
		auxiliary: { icon: AUXILIARY_ICON, color: colors.cyan, label: 'Auxiliary Chat' },
		error: { icon: ERROR_ICON, color: colors.red, label: 'Error' },
	};

	constructor(maxLineLength?: number) {
		this._maxLineLength = LogFormatter.getMaxLineLength(maxLineLength);
	}

	static getMaxLineLength(userDefinedLength?: number): number {
		if (userDefinedLength && userDefinedLength > 0) {
			return userDefinedLength;
		}
		const { columns, rows: _rows } = Deno.consoleSize();
		return columns > 0 ? columns : 120; // Default to 120 if unable to determine console width
	}

	get maxLineLength(): number {
		return this._maxLineLength;
	}

	private wrapText(text: string, indent: string, tail: string): string {
		const effectiveMaxLength = this._maxLineLength - indent.length - tail.length;
		const paragraphs = text.split('\n');
		const wrappedParagraphs = paragraphs.map((paragraph, index) => {
			if (paragraph.trim() === '') {
				// Preserve empty lines between paragraphs, but not at the start or end
				return index > 0 && index < paragraphs.length - 1 ? indent + tail : '';
			} else {
				let remainingText = paragraph;
				const lines = [];

				while (remainingText.length > 0) {
					if (remainingText.length <= effectiveMaxLength) {
						lines.push(remainingText);
						break;
					}

					let splitIndex = remainingText.lastIndexOf(' ', effectiveMaxLength);
					if (splitIndex === -1 || splitIndex === 0) {
						// If no space found or space is at the beginning, force split at max length
						splitIndex = effectiveMaxLength;
					}

					lines.push(remainingText.slice(0, splitIndex));
					remainingText = remainingText.slice(splitIndex).trim();

					// If the remaining text starts with a space, remove it
					if (remainingText.startsWith(' ')) {
						remainingText = remainingText.slice(1);
					}
				}

				return lines.map((l) => `${indent}${l}${tail}`).join('\n');
			}
		});

		// Remove any empty lines at the start and end
		return wrappedParagraphs.filter((p, i) => p !== '' || (i > 0 && i < wrappedParagraphs.length - 1)).join('\n');
	}

	static createRawEntry(
		type: ConversationLoggerEntryType,
		timestamp: string,
		message: string,
		conversationStats: ConversationMetrics,
		tokenUsage: TokenUsage,
		tokenUsageStatement?: TokenUsage,
		tokenUsageConversation?: ConversationTokenUsage,
	): string {
		// [TODO] add token usage to header line
		const { label } = LogFormatter.iconColorMap[type] || { label: 'Unknown' };
		return `## ${label} [${timestamp}]\n${message.trim()}`;
	}

	static createRawEntryWithSeparator(
		type: ConversationLoggerEntryType,
		timestamp: string,
		message: string,
		conversationStats: ConversationMetrics,
		tokenUsage: TokenUsage,
		tokenUsageStatement?: TokenUsage,
		tokenUsageConversation?: ConversationTokenUsage,
	): string {
		let rawEntry = LogFormatter.createRawEntry(
			type,
			timestamp,
			message,
			conversationStats,
			tokenUsage,
			tokenUsageStatement,
			tokenUsageConversation,
		);
		// Ensure entry ends with a single newline and the separator
		rawEntry = rawEntry.trimEnd() + '\n' + LogFormatter.getEntrySeparator() + '\n';
		return rawEntry;
	}

	static getTimestamp(): string {
		return new Date().toISOString();
	}

	private static isStatsAndUsageEmpty(stats: ConversationMetrics, usage: TokenUsage): boolean {
		return (
			!stats ||
			(stats.statementCount === 0 && stats.turnCount === 0 && stats.totalTurnCount === 0) ||
			!usage ||
			(usage.inputTokens === 0 && usage.outputTokens === 0 && usage.totalTokens === 0)
		);
	}

	formatLogEntry(
		type: ConversationLoggerEntryType,
		timestamp: string,
		message: string,
		conversationStats: ConversationMetrics,
		tokenUsage: TokenUsage,
	): string {
		const { icon, color, label } = LogFormatter.iconColorMap[type] ||
			{ icon: UNKNOWN_ICON, color: colors.reset, label: 'Unknown' };
		//const label = type === 'user' || type === 'assistant' ? rawLabel : rawLabel + ' Message';

		let header = color(
			`╭─ ${icon}  ${colors.bold(label)} 🕒  ${new Date(timestamp).toLocaleString()}`,
		);

		if (!LogFormatter.isStatsAndUsageEmpty(conversationStats, tokenUsage)) {
			const summaryInfo = [
				colors.green(`📝  St:${conversationStats.statementCount}`),
				colors.magenta(`🔄  Tn:${conversationStats.turnCount}`),
				colors.blue(`🔢  TT:${conversationStats.totalTurnCount}`),
				colors.red(`⌨️  In:${tokenUsage.inputTokens}`),
				colors.yellow(`🗨️  Out:${tokenUsage.outputTokens}`),
				colors.green(`Σ  Tot:${tokenUsage.totalTokens}`),
			].join('  ');
			header += ` ${summaryInfo}`;
		}
		const footer = color(`╰${'─'.repeat(this._maxLineLength - 1)}`);

		let formattedMessage = message.trim();
		if (type === 'tool_use') {
			formattedMessage = this.prettifyJsonInMessage(formattedMessage);
		}

		//const wrappedMessage = this.wrapText(formattedMessage, color('│ '), '');
		const wrappedMessage = this.wrapText(formattedMessage, color('  '), '');

		return stripIndents`
			${header}
			${wrappedMessage}
			${footer}`;
	}

	formatRawLogEntry(entry: string): string {
		const [header, ...messageLines] = entry.split('\n');
		if (typeof header !== 'undefined' && typeof messageLines !== 'undefined') {
			const [typeString, timestamp] = header.replace('## ', '').split(' [');
			// need to parse out the conversationStats and tokenUsage
			const conversationStats: ConversationMetrics = { statementCount: 0, turnCount: 0, totalTurnCount: 0 };
			const tokenUsage: TokenUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
			if (typeof typeString !== 'undefined' && typeof timestamp !== 'undefined') {
				const type = typeString as ConversationLoggerEntryType;
				return this.formatLogEntry(
					type,
					timestamp.replace(']', ''),
					messageLines.join('\n').trim(),
					conversationStats,
					tokenUsage,
				);
			} else {
				return messageLines.join('\n');
			}
		} else {
			return messageLines.join('\n');
		}
	}

	private prettifyJsonInMessage(message: string): string {
		const jsonRegex = /\{[\s\S]*?\}/;
		return message.replace(jsonRegex, (match) => {
			try {
				const parsed = JSON.parse(match);
				return JSON.stringify(parsed, null, 2);
			} catch (error) {
				// If parsing fails, return the original match
				return match;
			}
		});
	}

	formatSeparator(): string {
		return colors.blue(`${'─'.repeat(this._maxLineLength)}\n`);
	}

	static getEntrySeparator(): string {
		return this.ENTRY_SEPARATOR.trim();
	}
}

export async function displayFormattedLogs(
	conversationId: ConversationId,
	callback?: (formattedEntry: string) => void,
	follow = false,
): Promise<void> {
	const formatter = new LogFormatter();

	const bbaiDataDir = await getBbaiDataDir(Deno.cwd());
	const logFile = join(bbaiDataDir, 'conversations', conversationId, 'conversation.log');

	const processEntry = (entry: string) => {
		//console.debug('Debug: Raw entry before processing:\n', entry.trimStart());
		if (entry.trim() !== '') {
			const formattedEntry = formatter.formatRawLogEntry(entry.trim());
			if (callback) {
				callback(formattedEntry);
			} else {
				console.log(formattedEntry);
			}
			//console.debug('Debug: Formatted entry:\n' + formattedEntry);
		}
	};

	const readAndProcessEntries = async (startPosition = 0) => {
		let file: Deno.FsFile | null = null;
		try {
			file = await Deno.open(logFile, { read: true });
			await file.seek(startPosition, Deno.SeekMode.Start);
			const bufReader = new BufReader(file);

			let entry = '';
			let line: string | null;
			while ((line = await bufReader.readString('\n')) !== null) {
				//console.debug('Debug: Read line:', line.trimEnd());
				if (line.includes(LogFormatter.getEntrySeparator())) {
					processEntry(entry);
					entry = '';
					//console.debug('Debug: Entry separator found, resetting entry');
				} else {
					entry += line;
				}
			}
			if (entry.trim() !== '') {
				processEntry(entry);
			}
			return file.seek(0, Deno.SeekMode.Current);
		} finally {
			file?.close();
		}
	};

	try {
		let lastPosition = await readAndProcessEntries();

		if (follow) {
			const watcher = Deno.watchFs(logFile);
			for await (const event of watcher) {
				if (event.kind === 'modify') {
					lastPosition = await readAndProcessEntries(lastPosition);
				}
			}
		}
	} catch (error) {
		console.error(`Error reading log file: ${error.message}`);
	}
}

export async function writeLogEntry(
	conversationId: ConversationId,
	type: ConversationLoggerEntryType,
	message: string,
	conversationStats: ConversationMetrics,
	tokenUsage: TokenUsage,
	tokenUsageStatement?: TokenUsage,
	tokenUsageConversation?: ConversationTokenUsage,
): Promise<void> {
	const bbaiDataDir = await getBbaiDataDir(Deno.cwd());
	const logFile = join(bbaiDataDir, 'conversations', conversationId, 'conversation.log');

	const timestamp = new Date().toISOString();
	const entry = LogFormatter.createRawEntryWithSeparator(
		type,
		timestamp,
		message,
		conversationStats,
		tokenUsage,
		tokenUsageStatement,
		tokenUsageConversation,
	);

	try {
		// Append the entry to the log file
		await Deno.writeTextFile(logFile, entry, { append: true });
	} catch (error) {
		console.error(`Error writing log entry: ${error.message}`);
	}
}

export async function countLogEntries(conversationId: ConversationId): Promise<number> {
	const bbaiDataDir = await getBbaiDataDir(Deno.cwd());
	const logFile = join(bbaiDataDir, 'conversations', conversationId, 'conversation.log');

	try {
		const content = await Deno.readTextFile(logFile);
		const entries = content.split(LogFormatter.getEntrySeparator());
		// Filter out any empty entries
		return entries.filter((entry) => entry.trim() !== '').length;
	} catch (error) {
		console.error(`Error counting log entries: ${error.message}`);
		return 0;
	}
}
