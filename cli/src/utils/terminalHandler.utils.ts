import { renderMultilineInput } from './MultilineInputRenderer.tsx';
import { Input } from 'cliffy/prompt/mod.ts';
import { ansi, colors, tty } from 'cliffy/ansi/mod.ts';
import { keypress, KeyPressEvent } from 'cliffy/keypress/mod.ts';

import { unicodeWidth } from '@std/cli';
import { stripAnsiCode } from '@std/fmt/colors';
import Kia from 'kia-spinner';
import { SPINNERS } from './terminalSpinners.ts';
import { LogFormatter } from 'shared/logFormatter.ts';
//import { LLMProviderMessageMeta, LLMProviderMessageResponse } from 'api/types/llms.ts';
import { LLMMessageContentPartTextBlock } from 'api/llms/llmMessage.ts';
import { getStatementHistory } from './statementHistory.utils.ts';
import {
	ConversationEntry,
	ConversationId,
	ConversationResponse,
	ConversationStart,
	ConversationTokenUsage,
} from 'shared/types.ts';
//import { logger } from 'shared/logger.ts';

type Spinner = Kia;
export type { Spinner };

const symbols = {
	info: '🛈',
	radioOn: '🔘',
	clockwiseRightAndLeftSemicircleArrows: '🔁',
	arrowDown: '⬇️',
	arrowUp: '⬆️',
	sparkles: '✨',
	speechBalloon: '💬',
	hourglass: '⏳',
};

const palette = {
	primary: colors.blue,
	secondary: colors.cyan,
	accent: colors.yellow,
	success: colors.green,
	warning: colors.yellow,
	error: colors.red,
	info: colors.magenta,
};

export class TerminalHandler {
	private formatter: LogFormatter;
	private history: string[] = [];
	private spinner!: Spinner;
	private bbaiDir: string;

	constructor(bbaiDir: string) {
		this.formatter = new LogFormatter();
		this.bbaiDir = bbaiDir;
		this.spinner = this.createSpinner('BBai warming up...');
		this.loadHistory();
	}

	private async loadHistory() {
		// TODO: Implement loading history from file or database
		this.history = await getStatementHistory(this.bbaiDir);
	}

	public initializeTerminal(): void {
		tty
			//.cursorSave
			//.cursorHide
			.cursorTo(0, 0)
			.eraseScreen();

		console.log(
			ansi.cursorTo(0, 0) +
				ansi.eraseDown() +
				//ansi.image(imageBuffer, {
				//	width: 2,
				//	preserveAspectRatio: true,
				//}) + '  ' +
				ansi.cursorTo(6, 2) +
				colors.bold.blue.underline('BBai') + colors.bold.blue(' - Be Better with code and docs') +
				//colors.bold.blue(ansi.link('BBai', 'https://bbai.tips')) +
				'\n',
		);
	}

	public async getMultilineInput(): Promise<string> {
		const lines: string[] = [''];
		let currentLine = 0;
		let cursorPos = 0;

		console.log('Enter your multi-line input (Ctrl+D to finish):');

		const redraw = () => {
			console.clear();
			console.log('Enter your multi-line input (Ctrl+D to finish):');
			lines.forEach((line, index) => {
				if (index === currentLine) {
					console.log(`> ${line}`);
					Deno.stdout.writeSync(new TextEncoder().encode(ansi.cursorMove(-line.length + cursorPos, 0)));
				} else {
					console.log(`  ${line}`);
				}
			});
		};

		for await (const event: KeyPressEvent of keypress()) {
			if (event.ctrl && event.name === 'd') {
				break;
			} else if (event.name === 'return') {
				lines.splice(currentLine + 1, 0, '');
				currentLine++;
				cursorPos = 0;
			} else if (event.name === 'backspace') {
				if (cursorPos > 0) {
					lines[currentLine] = lines[currentLine].slice(0, cursorPos - 1) +
						lines[currentLine].slice(cursorPos);
					cursorPos--;
				} else if (currentLine > 0) {
					cursorPos = lines[currentLine - 1].length;
					lines[currentLine - 1] += lines[currentLine];
					lines.splice(currentLine, 1);
					currentLine--;
				}
			} else if (event.name === 'up' && currentLine > 0) {
				currentLine--;
				cursorPos = Math.min(cursorPos, lines[currentLine].length);
			} else if (event.name === 'down' && currentLine < lines.length - 1) {
				currentLine++;
				cursorPos = Math.min(cursorPos, lines[currentLine].length);
			} else if (event.name === 'left' && cursorPos > 0) {
				cursorPos--;
			} else if (event.name === 'right' && cursorPos < lines[currentLine].length) {
				cursorPos++;
			} else if (event.sequence && !event.ctrl && !event.meta && !event.name) {
				lines[currentLine] = lines[currentLine].slice(0, cursorPos) + event.sequence +
					lines[currentLine].slice(cursorPos);
				cursorPos += event.sequence.length;
			}

			redraw();
		}

		console.clear();
		return lines.join('\n');
	}
	/*
	public async getMultilineInput(): Promise<string> {
		return new Promise((resolve) => {
			const handleSubmit = (value: string) => {
				resolve(value);
			};

			const saveHistory = (value: string) => {
				if (!this.history.includes(value)) {
					this.history.push(value);
					this.saveHistory();
				}
			};

			renderMultilineInput({
				onSubmit: handleSubmit,
				history: this.history,
				saveHistory: saveHistory,
			});
		});
	}
	*/

	private async saveHistory(): Promise<void> {
		// TODO: Implement saving history to file or database
	}

	public displayDividerLine(): void {
		const cols = this.formatter.maxLineLength;
		console.log(palette.secondary(`╭${'─'.repeat(cols - 2)}╮`));
	}

	public displayConversationStart(
		data: ConversationStart,
		conversationId?: ConversationId,
		expectingMoreInput: boolean = true,
	): void {
		if (this.spinner) this.hideSpinner();
		conversationId = data.conversationId;

		if (!data.conversationId) {
			console.log('Entry has no conversationId', data);
			return;
		}

		const { conversationTitle } = data;
		const statementCount = data.statementCount || 1; // Ensure statementCount is defined

		const shortTitle = conversationTitle ? conversationTitle : '<pending>';

		const { columns } = Deno.consoleSize();
		const maxWidth = Math.min(columns - 2, 120); // Max width of 120 or console width - 2

		// Calculate the required width based on the content
		const contentWidth = Math.max(
			unicodeWidth(stripAnsiCode(` ${symbols.sparkles} Conversation Started ${symbols.sparkles}`)),
			unicodeWidth(stripAnsiCode(` ID: ${conversationId}`)),
			unicodeWidth(stripAnsiCode(` Title: ${shortTitle}`)),
			unicodeWidth(stripAnsiCode(` Statement: ${statementCount}`)),
		);

		const borderWidth = Math.min(contentWidth + 4, maxWidth); // Add 4 for left and right padding
		const horizontalBorder = '─'.repeat(borderWidth - 3);

		const padContent = (content: string) => {
			const paddingWidth = borderWidth - unicodeWidth(stripAnsiCode(content)) - 3; // -3 for '│ ' and '│'
			return content + ' '.repeat(Math.max(0, paddingWidth));
		};

		console.log(palette.secondary(`╭${horizontalBorder}╮`));
		console.log(
			palette.secondary('│') +
				palette.primary(padContent(` ${symbols.sparkles} Conversation Started ${symbols.sparkles}`)) +
				palette.secondary('│'),
		);
		console.log(palette.secondary(`├${horizontalBorder}┤`));
		console.log(
			palette.secondary('│') + palette.accent(padContent(` ID: ${conversationId}`)) + palette.secondary('│'),
		);
		console.log(
			palette.secondary('│') + palette.info(padContent(` Title: ${shortTitle}`)) + palette.secondary('│'),
		);
		console.log(
			palette.secondary('│') +
				palette.success(padContent(` Statement: ${statementCount}`)) +
				palette.secondary('│'),
		);
		console.log(palette.secondary(`╰${horizontalBorder}╯`));
		console.log('');

		if (expectingMoreInput && this.spinner) {
			this.startSpinner('Claude is thinking...');
		}
	}

	public displayConversationEntry(
		data: ConversationEntry,
		conversationId?: ConversationId,
		expectingMoreInput: boolean = false,
	): void {
		if (this.spinner) this.hideSpinner();
		// Ensure all optional properties are handled
		const {
			conversationTitle,
			type: _type,
			content,
			timestamp,
			conversationStats = {
				statementCount: 1,
				turnCount: 1,
				totalTurnCount: 1,
			},
			tokenUsageStatement = {
				inputTokens: 0,
				outputTokens: 0,
				totalTokens: 0,
			},
		} = data;
		conversationId = data.conversationId;

		if (!data.content) {
			console.log('Entry has no content', data);
			return;
		}

		const entry = LogFormatter.createRawEntry(
			'assistant',
			timestamp,
			content,
			conversationStats,
			tokenUsageStatement,
		);
		const formattedEntry = this.formatter.formatRawLogEntry(this.highlightOutput(entry));
		console.log(formattedEntry);

		const { columns } = Deno.consoleSize();
		const isNarrow = columns < 100;

		const idShort = conversationId?.substring(0, 8) || '';
		const titleShort = conversationTitle?.substring(0, isNarrow ? 10 : 20) || '';

		//logger.debug(`Preparing summary line with conversationStats: ${JSON.stringify(conversationStats)}, tokenUsage: ${JSON.stringify(tokenUsageStatement)}`);
		const summaryLine = [
			colors.cyan(isNarrow ? 'C' : 'Conv'),
			colors.yellow(isNarrow ? `${idShort}` : `ID:${idShort}`),
			colors.green(isNarrow ? `S${conversationStats.statementCount}` : `St:${conversationStats.statementCount}`),
			colors.magenta(isNarrow ? `T${conversationStats.turnCount}` : `Tn:${conversationStats.turnCount}`),
			colors.blue(isNarrow ? `TT${conversationStats.totalTurnCount}` : `TT:${conversationStats.totalTurnCount}`),
			colors.red(isNarrow ? `↓${tokenUsageStatement.inputTokens}` : `In:${tokenUsageStatement.inputTokens}`),
			colors.yellow(
				isNarrow ? `↑${tokenUsageStatement.outputTokens}` : `Out:${tokenUsageStatement.outputTokens}`,
			),
			colors.green(isNarrow ? `Σ${tokenUsageStatement.totalTokens}` : `Tot:${tokenUsageStatement.totalTokens}`),
			colors.cyan(isNarrow ? `${titleShort}` : `Title:${titleShort}`),
		].join('  '); // Two spaces between each item

		console.log(summaryLine);

		if (expectingMoreInput && this.spinner) {
			this.startSpinner('Claude is thinking...');
		}
	}

	public displayConversationUpdate(
		data: ConversationResponse,
		conversationId?: ConversationId,
		expectingMoreInput: boolean = false,
	): void {
		//logger.debug(`displayConversationUpdate called with data: ${JSON.stringify(data)}`);
		if (this.spinner) this.hideSpinner();
		conversationId = data.conversationId;

		if (!data.response) {
			console.log('Entry has no response', data);
			return;
		}

		const {
			conversationTitle,
			conversationStats = { statementCount: 1, turnCount: 1, totalTurnCount: 1 },
			tokenUsageStatement = {
				inputTokens: data.response.usage.inputTokens,
				outputTokens: data.response.usage.outputTokens,
				totalTokens: data.response.usage.totalTokens,
			},
		} = data;

		const timestamp = LogFormatter.getTimestamp();
		const contentPart = data.response.answerContent[0] as LLMMessageContentPartTextBlock;
		const entry = LogFormatter.createRawEntry(
			'assistant',
			timestamp,
			contentPart.text,
			conversationStats,
			tokenUsageStatement,
		);
		const formattedEntry = this.formatter.formatRawLogEntry(this.highlightOutput(entry));
		console.log(formattedEntry);

		const { columns } = Deno.consoleSize();
		const isNarrow = columns < 100;

		const idShort = conversationId?.substring(0, 8) || '';
		const titleShort = conversationTitle?.substring(0, isNarrow ? 10 : 20) || '';

		//logger.debug(`Preparing summary line with conversationStats: ${JSON.stringify(conversationStats)}, tokenUsage: ${JSON.stringify(tokenUsageStatement)}`);
		const summaryLine = [
			colors.cyan(isNarrow ? 'C' : 'Conv'),
			colors.yellow(isNarrow ? `${idShort}` : `ID:${idShort}`),
			colors.green(isNarrow ? `S${conversationStats.statementCount}` : `St:${conversationStats.statementCount}`),
			colors.magenta(isNarrow ? `T${conversationStats.turnCount}` : `Tn:${conversationStats.turnCount}`),
			colors.blue(isNarrow ? `TT${conversationStats.totalTurnCount}` : `TT:${conversationStats.totalTurnCount}`),
			colors.red(isNarrow ? `↓${tokenUsageStatement.inputTokens}` : `In:${tokenUsageStatement.inputTokens}`),
			colors.yellow(
				isNarrow ? `↑${tokenUsageStatement.outputTokens}` : `Out:${tokenUsageStatement.outputTokens}`,
			),
			colors.green(isNarrow ? `Σ${tokenUsageStatement.totalTokens}` : `Tot:${tokenUsageStatement.totalTokens}`),
			colors.cyan(isNarrow ? `${titleShort}` : `Title:${titleShort}`),
		].join('  '); // Two spaces between each item

		console.log(summaryLine);

		if (expectingMoreInput && this.spinner) {
			this.startSpinner('Claude is thinking...');
		}
	}

	public displayConversationComplete(
		response: ConversationResponse,
		options: { id?: string; text?: boolean },
		expectingMoreInput: boolean = false,
	): void {
		if (this.spinner) this.hideSpinner();
		const isNewConversation = !options.id;
		const { conversationId, conversationStats, conversationTitle } = response;
		const tokenUsageStatement = response.response.usage;
		const tokenUsageConversation: ConversationTokenUsage = {
			inputTokensTotal: response.response.usage.inputTokens,
			outputTokensTotal: response.response.usage.outputTokens,
			totalTokensTotal: response.response.usage.totalTokens,
		};

		if (!options.text) {
			console.log(JSON.stringify(
				{
					...response,
					isNewConversation,
					conversationId,
					conversationTitle,
					conversationStats,
					tokenUsageConversation,
				},
				null,
				2,
			));
		} else {
			const contentPart = response.response.answerContent[0] as LLMMessageContentPartTextBlock;
			console.log(this.highlightOutput(contentPart.text));

			console.log(palette.secondary('╭─────────────────────────────────────────────────────╮'));
			console.log(
				palette.secondary('│') +
					palette.primary(` ${symbols.sparkles} Conversation Complete ${symbols.sparkles}`.padEnd(55)) +
					palette.secondary('│'),
			);
			console.log(palette.secondary('├─────────────────────────────────────────────────────┤'));
			console.log(
				palette.secondary('│') + palette.accent(` ID: ${conversationId}`.padEnd(55)) + palette.secondary('│'),
			);
			console.log(
				palette.secondary('│') + palette.info(` Title: ${conversationTitle}`.padEnd(55)) +
					palette.secondary('│'),
			);
			console.log(
				palette.secondary('│') +
					palette.success(` ${symbols.info} Statements: ${conversationStats.statementCount}`.padEnd(55)) +
					palette.secondary('│'),
			);
			console.log(
				palette.secondary('│') +
					palette.warning(` ${symbols.radioOn} Turns: ${conversationStats.turnCount}`.padEnd(55)) +
					palette.secondary('│'),
			);
			console.log(
				palette.secondary('│') +
					palette.info(
						` ${symbols.clockwiseRightAndLeftSemicircleArrows} Total Turns: ${conversationStats.totalTurnCount}`
							.padEnd(53),
					) + palette.secondary('│'),
			);
			console.log(palette.secondary('├─────────────────────────────────────────────────────┤'));
			console.log(
				palette.secondary('│') +
					palette.error(
						` ${symbols.arrowDown} Input Tokens: ${tokenUsageConversation?.inputTokensTotal}`.padEnd(55),
					) +
					palette.secondary('│'),
			);
			console.log(
				palette.secondary('│') +
					palette.success(
						` ${symbols.arrowUp} Output Tokens: ${tokenUsageConversation?.outputTokensTotal}`.padEnd(55),
					) +
					palette.secondary('│'),
			);
			console.log(
				palette.secondary('│') +
					palette.primary(
						` ${symbols.radioOn} Total Tokens: ${tokenUsageConversation?.totalTokensTotal}`.padEnd(55),
					) +
					palette.secondary('│'),
			);
			console.log(palette.secondary('╰─────────────────────────────────────────────────────╯'));
			console.log('');
		}
	}

	private highlightOutput(text: string): string {
		// TODO: Implement syntax highlighting
		//return highlight(text, { language: 'plaintext' }).value;
		return text;
	}

	public createSpinner(message: string): Spinner {
		return new Kia({
			text: palette.info(message),
			color: 'cyan',
			spinner: SPINNERS.bouncingBar,
		});
	}

	public startSpinner(message?: string): void {
		this.spinner.start(message);
	}
	public stopSpinner(successMessage: string = 'Done'): void {
		this.spinner.succeed(successMessage);
	}

	public showSpinner(message?: string): void {
		this.spinner.start(message);
	}
	public hideSpinner(): void {
		this.spinner.stop();
	}
}
