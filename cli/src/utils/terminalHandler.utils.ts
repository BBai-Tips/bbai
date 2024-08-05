import { Input } from 'cliffy/prompt/mod.ts';
import { ansi, colors, tty } from 'cliffy/ansi/mod.ts';
import Kia from 'kia-spinner';
import { LogFormatter } from 'shared/logFormatter.ts';
//import { LLMProviderMessageMeta, LLMProviderMessageResponse } from 'api/types/llms.ts';
import { LLMMessageContentPartTextBlock } from 'api/llms/llmMessage.ts';
import { getStatementHistory } from './statementHistory.utils.ts';
import { ConversationEntry, ConversationId, ConversationResponse, ConversationStart } from 'shared/types.ts';

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

export function initializeTerminal(): void {
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

export async function getMultilineInput(bbaiDir: string): Promise<string> {
	const history = await getStatementHistory(bbaiDir);
	const input = await Input.prompt({
		message: 'Ask Claude',
		prefix: '👤  ',
		//files: true,
		info: true,
		//list: true,
		suggestions: history,
		//completeOnEmpty: true,
		//history: {
		//	enable: true,
		//	persistent: true,
		//},
		//suggestions: [
		//	'apiStart',
		//	'apiStatus',
		//	'conversationStart',
		//],
		//transform: (input: string) => highlight(input, { language: 'plaintext' }).value,
	});
	return input;
}

export function displayDividerLine(formatter: LogFormatter): void {
	const cols = formatter.maxLineLength;
	console.log(palette.secondary(`╭${'─'.repeat(cols - 2)}╮`));
}

export function displayConversationStart(
	_formatter: LogFormatter,
	data: ConversationStart,
	conversationId?: ConversationId,
): void {
	conversationId = data.conversationId;

	if (!data.conversationId) {
		console.log('Entry has no conversationId', data);
		return;
	}

	const { conversationTitle } = data;
	const statementCount = data.statementCount || 1; // Ensure statementCount is defined

	const shortTitle = conversationTitle ? conversationTitle : '<pending>';

	console.log(palette.secondary('╭─────────────────────────────────────────────────────╮'));
	console.log(
		palette.secondary('│') +
			palette.primary(` ${symbols.sparkles} Conversation Started ${symbols.sparkles}`.padEnd(55)) +
			palette.secondary('│'),
	);
	console.log(palette.secondary('├─────────────────────────────────────────────────────┤'));
	console.log(palette.secondary('│') + palette.accent(` ID: ${conversationId}`.padEnd(55)) + palette.secondary('│'));
	console.log(palette.secondary('│') + palette.info(` Title: ${shortTitle}`.padEnd(55)) + palette.secondary('│'));
	console.log(
		palette.secondary('│') + palette.success(` ${symbols.info} Statement: ${statementCount}`.padEnd(55)) +
			palette.secondary('│'),
	);
	console.log(palette.secondary('╰─────────────────────────────────────────────────────╯'));
	console.log('');
}

export function displayConversationEntry(
	formatter: LogFormatter,
	data: ConversationEntry,
	conversationId?: ConversationId,
): void {
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
		tokenUsage = {
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

	const entry = LogFormatter.createRawEntry('assistant', timestamp, content, conversationStats, tokenUsage);
	const formattedEntry = formatter.formatRawLogEntry(highlightOutput(entry));
	console.log(formattedEntry);

	console.log(palette.secondary('╭─────────────────────────────────────────────────────╮'));
	console.log(
		palette.secondary('│') + palette.primary(` ${symbols.speechBalloon} Conversation Update`.padEnd(55)) +
			palette.secondary('│'),
	);
	console.log(palette.secondary('├─────────────────────────────────────────────────────┤'));
	console.log(palette.secondary('│') + palette.accent(` ID: ${conversationId}`.padEnd(53)) + palette.secondary('│'));
	console.log(
		palette.secondary('│') + palette.info(` Title: ${conversationTitle}`.padEnd(55)) + palette.secondary('│'),
	);
	console.log(
		palette.secondary('│') +
			palette.success(` ${symbols.info} Statement: ${conversationStats.statementCount}`.padEnd(55)) +
			palette.secondary('│'),
	);
	console.log(
		palette.secondary('│') +
			palette.warning(` ${symbols.radioOn} Turn: ${conversationStats.turnCount}`.padEnd(55)) +
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
			palette.error(` ${symbols.arrowDown} Input Tokens: ${tokenUsage.inputTokens}`.padEnd(55)) +
			palette.secondary('│'),
	);
	console.log(
		palette.secondary('│') +
			palette.success(` ${symbols.arrowUp} Output Tokens: ${tokenUsage.outputTokens}`.padEnd(55)) +
			palette.secondary('│'),
	);
	console.log(
		palette.secondary('│') +
			palette.primary(` ${symbols.radioOn} Total Tokens: ${tokenUsage.totalTokens}`.padEnd(55)) +
			palette.secondary('│'),
	);
	console.log(palette.secondary('╰─────────────────────────────────────────────────────╯'));
	console.log('');
}

export function displayConversationUpdate(
	formatter: LogFormatter,
	data: ConversationResponse,
	conversationId?: ConversationId,
): void {
	conversationId = data.conversationId;

	if (!data.response) {
		console.log('Entry has no response', data);
		return;
	}

	const {
		conversationTitle,
		conversationStats = {
			statementCount: 1,
			turnCount: 1,
			totalTurnCount: 1,
		},
		tokenUsage = {
			inputTokens: data.response.usage.inputTokens,
			outputTokens: data.response.usage.outputTokens,
			totalTokens: data.response.usage.totalTokens,
		},
	} = data;
	//const tokenUsage = data.response.usage;

	const timestamp = LogFormatter.getTimestamp();
	const contentPart = data.response.answerContent[0] as LLMMessageContentPartTextBlock;
	const entry = LogFormatter.createRawEntry('assistant', timestamp, contentPart.text, conversationStats, tokenUsage);
	const formattedEntry = formatter.formatRawLogEntry(highlightOutput(entry));
	console.log(formattedEntry);

	const summaryLine1 = colors.bold.cyan(`┌─ Conversation `) + colors.yellow(`ID: ${colors.bold(conversationId)} `) +
		colors.green(`${symbols.info} ${conversationStats.statementCount} `) +
		colors.magenta(`${symbols.radioOn} ${conversationStats.turnCount} `) +
		colors.blue(`${symbols.clockwiseRightAndLeftSemicircleArrows} ${conversationStats.totalTurnCount}`);

	const summaryLine2 = colors.bold.cyan(`└─ `) + colors.red(`${symbols.arrowDown} ${tokenUsage?.inputTokens} `) +
		colors.yellow(`${symbols.arrowUp} ${tokenUsage?.outputTokens} `) +
		colors.green(`${symbols.radioOn} ${tokenUsage?.totalTokens}`);

	const titleLine = colors.bold.cyan(`│ Title: ${colors.white(conversationTitle)}`);
	// Removed maxLength and padding calculations

	console.log(summaryLine1);
	console.log(titleLine);
	console.log(summaryLine2 + '\n');
}

export function displayConversationComplete(
	response: ConversationResponse,
	options: { id?: string; text?: boolean },
): void {
	const isNewConversation = !options.id;
	const { conversationId, conversationStats, conversationTitle } = response;
	const tokenUsage = response.response.usage;

	if (!options.text) {
		console.log(JSON.stringify(
			{
				...response,
				isNewConversation,
				conversationId,
				conversationTitle,
				conversationStats,
				tokenUsage,
			},
			null,
			2,
		));
	} else {
		const contentPart = response.response.answerContent[0] as LLMMessageContentPartTextBlock;
		console.log(highlightOutput(contentPart.text));

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
			palette.secondary('│') + palette.info(` Title: ${conversationTitle}`.padEnd(55)) + palette.secondary('│'),
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
				palette.error(` ${symbols.arrowDown} Input Tokens: ${tokenUsage?.inputTokens}`.padEnd(55)) +
				palette.secondary('│'),
		);
		console.log(
			palette.secondary('│') +
				palette.success(` ${symbols.arrowUp} Output Tokens: ${tokenUsage?.outputTokens}`.padEnd(55)) +
				palette.secondary('│'),
		);
		console.log(
			palette.secondary('│') +
				palette.primary(` ${symbols.radioOn} Total Tokens: ${tokenUsage?.totalTokens}`.padEnd(55)) +
				palette.secondary('│'),
		);
		console.log(palette.secondary('╰─────────────────────────────────────────────────────╯'));
		console.log('');
	}
}

function highlightOutput(text: string): string {
	// TODO: Implement syntax highlighting
	//return highlight(text, { language: 'plaintext' }).value;
	return text;
}

export function showSpinner(message: string): Kia {
	const spinner = new Kia({
		text: palette.info(message),
		color: 'cyan',
	});
	spinner.start();
	return spinner;
}

export function stopSpinner(spinner: Kia, successMessage: string = 'Done'): void {
	spinner.succeed(successMessage);
}
