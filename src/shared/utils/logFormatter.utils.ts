//import { consoleSize } from '@std/console';
import { join } from '@std/path';

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

		const header = `${color}╭─ ${icon} ${type} [${timestamp}]${ANSI_RESET}`;
		const footer = `${color}╰${'─'.repeat(this.maxLineLength - 1)}${ANSI_RESET}`;
		const wrappedMessage = this.wrapText(message, `${color}│ `, `${ANSI_RESET}`);

		return `${header}\n${wrappedMessage}\n${footer}\n`;
	}

	formatRawLogEntry(entry: string): string {
		const [header, ...messageLines] = entry.split('\n');
		const [type, timestamp] = header.replace('## ', '').split(' [');
		return this.formatLogEntry(type, timestamp.replace(']', ''), messageLines.join('\n'));
	}

	formatSeparator(): string {
		return `${ANSI_BLUE}${'─'.repeat(this.maxLineLength)}${ANSI_RESET}\n`;
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

	try {
		const file = await Deno.open(logFile, { read: true });
		const bufReader = new BufReader(file);

		let entry = '';
		let line: string | null;

		const processEntry = (entry: string) => {
			const formattedEntry = formatter.formatRawLogEntry(entry);
			if (callback) {
				callback(formattedEntry);
			} else {
				console.log(formattedEntry);
				console.log(formatter.formatSeparator());
			}
		};

		const readAndProcessEntries = async () => {
			while ((line = await bufReader.readString('\n')) !== null) {
				if (line.trim() === '') {
					if (entry.trim() !== '') {
						processEntry(entry);
						entry = '';
					}
				} else {
					entry += line;
				}
			}
			if (entry.trim() !== '') {
				processEntry(entry);
			}
		};

		await readAndProcessEntries();

		if (follow) {
			const watcher = Deno.watchFs(logFile);
			for await (const event of watcher) {
				if (event.kind === 'modify') {
					await readAndProcessEntries();
				}
			}
		}
	} catch (error) {
		console.error(`Error reading log file: ${error.message}`);
	} finally {
		if (file) {
			file.close();
		}
	}
}
