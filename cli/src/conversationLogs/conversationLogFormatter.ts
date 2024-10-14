//import { consoleSize } from '@std/console';
import { stripIndents } from 'common-tags';
import { writeAllSync } from '@std/io';
import { TextLineStream } from '@std/streams';
import { colors } from 'cliffy/ansi/mod.ts';
//import { renderToString } from 'preact-render-to-string';

import ConversationLogger from 'api/storage/conversationLogger.ts';
//import { getBbaiDataDir } from 'shared/dataDir.ts';
import { ConversationId, ConversationLogEntryType, ConversationMetrics, TokenUsage } from 'shared/types.ts';
import { ConfigManager } from 'shared/configManager.ts';

// [TODO] this needs to be projectConfig (or fullConfig), which means startDir needs to get passed in
const globalConfig = await ConfigManager.globalConfig();

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
//const CLOCK_ICON = '🕒'; // Clock emoji

export default class ConversationLogFormatter {
	private _maxLineLength: number;

	private static readonly iconColorMap: Record<
		ConversationLogEntryType,
		{ icon: string; color: (text: string) => string; label: string }
	> = {
		user: { icon: USER_ICON, color: colors.green, label: globalConfig.myPersonsName || 'Person' },
		assistant: { icon: ASSISTANT_ICON, color: colors.blue, label: globalConfig.myAssistantsName || 'Assistant' },
		answer: {
			icon: ASSISTANT_ICON,
			color: colors.blue,
			label: `Answer from ${globalConfig.myAssistantsName || 'Assistant'}`,
		},
		tool_use: { icon: TOOL_ICON, color: colors.yellow, label: 'Tool Input' },
		tool_result: { icon: TOOL_ICON, color: colors.yellow, label: 'Tool Output' },
		auxiliary: { icon: AUXILIARY_ICON, color: colors.cyan, label: 'Auxiliary Chat' },
		error: { icon: ERROR_ICON, color: colors.red, label: 'Error' },
	};

	constructor(maxLineLength?: number) {
		this._maxLineLength = ConversationLogFormatter.getMaxLineLength(maxLineLength);
	}

	public async init(): Promise<ConversationLogFormatter> {
		return this;
	}

	static getMaxLineLength(userDefinedLength?: number): number {
		if (userDefinedLength && userDefinedLength > 0) {
			return userDefinedLength;
		}
		const defaultCols = 120; // Default to 120 if unable to determine console width
		try {
			if (Deno.stdin.isTerminal()) {
				const { columns } = Deno.consoleSize();
				return columns > 0 ? columns : defaultCols;
			} else {
				return defaultCols;
			}
		} catch {
			// Handle potential errors when stdin is not available or consoleSize fails
		}
		return defaultCols; // Default fallback
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

	static getTimestamp(): string {
		return new Date().toISOString();
	}

	private static isStatsAndUsageEmpty(stats: ConversationMetrics, usage: TokenUsage): boolean {
		return (
			!stats ||
			(stats.statementCount === 0 && stats.statementTurnCount === 0 && stats.conversationTurnCount === 0) ||
			!usage ||
			(usage.inputTokens === 0 && usage.outputTokens === 0 && usage.totalTokens === 0)
		);
	}

	async formatLogEntry(
		type: ConversationLogEntryType,
		timestamp: string,
		//logEntry: ConversationLogEntry,
		content: string,
		conversationStats: ConversationMetrics,
		tokenUsage: TokenUsage,
		toolName?: string,
	): Promise<string> {
		const { icon, color, label } = ConversationLogFormatter.iconColorMap[type] ||
			{ icon: UNKNOWN_ICON, color: colors.reset, label: 'Unknown' };
		//const label = type === 'user' || type === 'assistant' ? rawLabel : rawLabel + ' Message';

		let header = color(
			`╭─ ${icon}  ${colors.bold(label)}${
				type === 'tool_use' || type === 'tool_result' ? ` (${toolName})` : ''
			}   🕒  ${new Date(timestamp).toLocaleString()}`,
		);

		if (!ConversationLogFormatter.isStatsAndUsageEmpty(conversationStats, tokenUsage)) {
			const summaryInfo = [
				colors.green(`📝  St:${conversationStats.statementCount}`),
				colors.magenta(`🔄  Tn:${conversationStats.statementTurnCount}`),
				colors.blue(`🔢  TT:${conversationStats.conversationTurnCount}`),
				colors.red(`⌨️  In:${tokenUsage.inputTokens}`),
				colors.yellow(`🗨️  Out:${tokenUsage.outputTokens}`),
				colors.green(`Σ  Tot:${tokenUsage.totalTokens}`),
			].join('  ');
			header += ` ${summaryInfo}`;
		}
		const footer = color(`╰${'─'.repeat(this._maxLineLength - 1)}`);

		const formattedContent = content;

		function isImageCompatibleTerminal(): boolean {
			if (Deno.env.get('TERM_PROGRAM') === 'iTerm.app') return true; // Check for iTerm2
			if (Deno.env.get('KITTY_WINDOW_ID') !== undefined) return true; // Check for Kitty
			if (Deno.env.get('WEZTERM_PANE') !== undefined) return true; // Check for WezTerm
			if (Deno.env.get('KONSOLE_VERSION') !== undefined) return true; // Check for Konsole
			try {
				writeAllSync(Deno.stdout, new TextEncoder().encode('\u001b[1;2C')); // Generic check for terminals that support ANSI graphics
				return true;
			} catch {
				return false;
			}
		}

		// 		const wrappedMessage = content.startsWith('File=name=Screenshot.png') && isImageCompatibleTerminal()
		// 			? `\u001b]1337;${content}\u0007\n`
		// 			: content.startsWith('File=name=Screenshot.png')
		// 			? `Terminal doesn't support inline images. Skipping display`
		// 			: this.wrapText(formattedContent, color('  '), '');
		const wrappedMessage = content.startsWith('Screenshot captured from') && isImageCompatibleTerminal()
			? content
			: content.startsWith('Screenshot captured from')
			? `Terminal doesn't support inline images. Skipping display`
			: this.wrapText(formattedContent, color('  '), '');
		//const wrappedMessage = this.wrapText(formattedContent, color('│ '), '');
		//const wrappedMessage = this.wrapText(formattedContent, color('  '), '');

		return stripIndents`
			${header}
			${wrappedMessage}
			${footer}`;
	}

	async formatRawLogEntry(entry: string): Promise<string> {
		const [header, ...messageLines] = entry.split('\n');
		if (typeof header !== 'undefined' && typeof messageLines !== 'undefined') {
			const [typeString, timestamp] = header.replace('## ', '').split(' [');
			// need to parse out the conversationStats and tokenUsage
			const conversationStats: ConversationMetrics = {
				statementCount: 0,
				statementTurnCount: 0,
				conversationTurnCount: 0,
			};
			const tokenUsage: TokenUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
			if (typeof typeString !== 'undefined' && typeof timestamp !== 'undefined') {
				const type = typeString as ConversationLogEntryType;
				return await this.formatLogEntry(
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

	formatSeparator(): string {
		return colors.blue(`${'─'.repeat(this._maxLineLength)}\n`);
	}
}

export async function displayFormattedLogs(
	conversationId: ConversationId,
	callback?: (formattedEntry: string) => void,
	follow = false,
): Promise<void> {
	const formatter = await new ConversationLogFormatter().init();
	const rawLogFile = await ConversationLogger.getLogFileRawPath(Deno.cwd(), conversationId);

	const processEntry = async (entry: string) => {
		//console.debug('Debug: Raw entry before processing:\n', entry.trimStart());
		if (entry.trim() !== '') {
			const formattedEntry = await formatter.formatRawLogEntry(entry.trim());
			if (callback) {
				callback(formattedEntry);
			} else {
				console.log(formattedEntry);
			}
			//console.debug('Debug: Formatted entry:\n' + formattedEntry);
		}
	};

	/*
	const readAndProcessEntries = async (startPosition = 0) => {
		let file: Deno.FsFile | null = null;
		try {
			file = await Deno.open(rawLogFile, { read: true });
			await file.seek(startPosition, Deno.SeekMode.Start);
			const bufReader = new BufReader(file);

			let entry = '';
			let line: string | null;
			while ((line = await bufReader.readString('\n')) !== null) {
				//console.debug('Debug: Read line:', line.trimEnd());
				if (line.includes(ConversationLogger.getEntrySeparator())) {
					await processEntry(entry);
					entry = '';
					//console.debug('Debug: Entry separator found, resetting entry');
				} else {
					entry += line;
				}
			}
			if (entry.trim() !== '') {
				await processEntry(entry);
			}
			return file.seek(0, Deno.SeekMode.Current);
		} finally {
			file?.close();
		}
	};
 */

	const logEntrySeparator = ConversationLogger.getEntrySeparator();

	const readAndProcessEntries = async (startPosition = 0) => {
		let file: Deno.FsFile | null = null;
		try {
			file = await Deno.open(rawLogFile, { read: true });
			await file.seek(startPosition, Deno.SeekMode.Start);

			const reader = file.readable
				.pipeThrough(new TextDecoderStream())
				.pipeThrough(new TextLineStream());

			let entry = '';
			for await (const line of reader) {
				if (line.includes(logEntrySeparator)) {
					await processEntry(entry);
					entry = '';
				} else {
					entry += line + '\n';
				}
			}

			if (entry.trim() !== '') {
				await processEntry(entry);
			}

			return file.seek(0, Deno.SeekMode.Current);
		} finally {
			file?.close();
		}
	};

	try {
		let lastPosition = await readAndProcessEntries();

		if (follow) {
			const watcher = Deno.watchFs(rawLogFile);
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

export async function countLogEntries(conversationId: ConversationId): Promise<number> {
	const rawLogFile = await ConversationLogger.getLogFileRawPath(Deno.cwd(), conversationId);

	try {
		const content = await Deno.readTextFile(rawLogFile);
		const entries = content.split(ConversationLogger.getEntrySeparator());
		// Filter out any empty entries
		return entries.filter((entry) => entry.trim() !== '').length;
	} catch (error) {
		console.error(`Error counting log entries: ${error.message}`);
		return 0;
	}
}
