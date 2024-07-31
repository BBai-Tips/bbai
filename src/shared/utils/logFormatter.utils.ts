//import { consoleSize } from '@std/console';
import { join } from '@std/path';
import { BufReader } from '@std/io';

import { getBbaiDir } from 'shared/dataDir.ts';

const ANSI_RESET = '\x1b[0m';
const ANSI_RED = '\x1b[31m';
const ANSI_GREEN = '\x1b[32m';
const ANSI_CYAN = '\x1b[36m';
const ANSI_YELLOW = '\x1b[33m';
const ANSI_BLUE = '\x1b[34m';

const USER_ICON = '👤';
const ASSISTANT_ICON = '🤖';
const TOOL_ICON = '🔧';
const AUXILIARY_ICON = '📎';
const ERROR_ICON = '❌';
const UNKNOWN_ICON = '❓';

export class LogFormatter {
	private static readonly ENTRY_SEPARATOR = '\n<<<BBAI_LOG_ENTRY_SEPARATOR>>>\n';

	private maxLineLength: number;

	constructor(maxLineLength?: number) {
		this.maxLineLength = this.getMaxLineLength(maxLineLength);
	}

	private getMaxLineLength(userDefinedLength?: number): number {
		if (userDefinedLength && userDefinedLength > 0) {
			return userDefinedLength;
		}
		const { columns, rows: _rows } = Deno.consoleSize();
		return columns > 0 ? columns : 120; // Default to 120 if unable to determine console width
	}

	private wrapText(text: string, indent: string, tail: string): string {
		const paragraphs = text.split('\n');
		const wrappedParagraphs = paragraphs.map((paragraph) => {
			const words = paragraph.split(/\s+/);
			let line = indent;
			const lines = [];

			for (const word of words) {
				if (line.length + word.length > this.maxLineLength - tail.length) {
					lines.push(line.trimEnd());
					line = indent + word + ' ';
				} else {
					line += word + ' ';
				}
			}
			if (line.trim()) {
				lines.push(line.trimEnd());
			}

			return lines.map((l) => l + tail).join('\n');
		});

		if (wrappedParagraphs.length > 1) {
			return wrappedParagraphs.join('\n' + indent + '\n') + '\n';
		}

		return wrappedParagraphs[0] + '\n';
	}

	static createRawEntry(type: string, timestamp: string, message: string): string {
		// [TODO] add token usage to header line
		return `## ${type} [${timestamp}]\n${message.trim()}\n${this.ENTRY_SEPARATOR}`;
	}

	static getTimestamp(): string {
		return new Date().toISOString();
	}

	formatLogEntry(type: string, timestamp: string, message: string): string {
		let icon: string;
		let color: string;

		switch (type) {
			case 'User Message':
				icon = USER_ICON;
				color = ANSI_GREEN;
				break;
			case 'Assistant Message':
				icon = ASSISTANT_ICON;
				color = ANSI_BLUE;
				break;
			case 'Auxiliary Message':
				icon = AUXILIARY_ICON;
				color = ANSI_CYAN;
				break;
			case 'Tool Use':
			case 'Tool Result':
			case 'Diff Patch':
				icon = TOOL_ICON;
				color = ANSI_YELLOW;
				break;
			case 'Error':
				icon = ERROR_ICON;
				color = ANSI_RED;
				break;
			default:
				icon = UNKNOWN_ICON;
				color = ANSI_RESET;
		}

		const header = `${color}╭─ ${icon} ${type} [${timestamp}]${ANSI_RESET}\n`;
		const footer = `\n${color}╰${'─'.repeat(this.maxLineLength - 1)}${ANSI_RESET}\n`;
		const wrappedMessage = this.wrapText(message, `${color}│ `, `${ANSI_RESET}\n`);

		return `${header}\n${wrappedMessage}${footer}\n`;
	}

	formatRawLogEntry(entry: string): string {
		const [header, ...messageLines] = entry.split('\n');
		if (typeof header !== 'undefined' && typeof messageLines !== 'undefined') {
			const [type, timestamp] = header.replace('## ', '').split(' [');
			if (typeof type !== 'undefined' && typeof timestamp !== 'undefined') {
				return this.formatLogEntry(type, timestamp.replace(']', ''), messageLines.join('\n'));
			} else {
				return messageLines.join('\n');
			}
		} else {
			return messageLines.join('\n');
		}
	}

	formatSeparator(): string {
		return `${ANSI_BLUE}${'─'.repeat(this.maxLineLength)}${ANSI_RESET}\n`;
	}

	static getEntrySeparator(): string {
		return this.ENTRY_SEPARATOR;
	}
}

export async function displayFormattedLogs(
	conversationId: string,
	callback?: (formattedEntry: string) => void,
	follow = false,
): Promise<void> {
	const formatter = new LogFormatter();
	const bbaiDir = await getBbaiDir(Deno.cwd());
	const logFile = join(bbaiDir, 'cache', 'conversations', conversationId, 'conversation.log');

	const processEntry = (entry: string) => {
		console.debug('Debug: Raw entry before processing:\n', entry);
		if (entry.trim() !== '') {
			const formattedEntry = formatter.formatRawLogEntry(entry);
			if (callback) {
				callback(formattedEntry);
			} else {
				console.log(formattedEntry);
			}
			console.debug('Debug: Formatted entry:\n' + formattedEntry);
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
				console.debug('Debug: Read line:', line);
				if (line.includes('<<<BBAI_LOG_ENTRY_SEPARATOR>>>')) {
					processEntry(entry);
					entry = '';
					console.debug('Debug: Entry separator found, resetting entry');
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
	conversationId: string,
	type: string,
	message: string,
): Promise<void> {
	const bbaiDir = await getBbaiDir(Deno.cwd());
	const logFile = join(bbaiDir, 'cache', 'conversations', conversationId, 'conversation.log');

	const timestamp = new Date().toISOString();
	const entry = LogFormatter.createRawEntry(type, timestamp, message);

	try {
		await Deno.writeTextFile(logFile, entry, { append: true });
	} catch (error) {
		console.error(`Error writing log entry: ${error.message}`);
	}
}

export async function countLogEntries(conversationId: string): Promise<number> {
	const bbaiDir = await getBbaiDir(Deno.cwd());
	const logFile = join(bbaiDir, 'cache', 'conversations', conversationId, 'conversation.log');

	try {
		const content = await Deno.readTextFile(logFile);
		const entries = content.split(LogFormatter.getEntrySeparator().trim());
		// Filter out any empty entries
		return entries.filter((entry) => entry.trim() !== '').length;
	} catch (error) {
		console.error(`Error counting log entries: ${error.message}`);
		return 0;
	}
}
