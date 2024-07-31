import { Command } from 'cliffy/command/mod.ts';
import { Input, Select } from 'cliffy/prompt/mod.ts';
//import highlight from 'highlight';
import { readLines } from '@std/io';
import { ansi, colors, tty } from 'cliffy/ansi/mod.ts';
//import { KeyCode, parse } from 'cliffy/keycode/mod.ts';

import { logger } from 'shared/logger.ts';
import { apiClient } from '../utils/apiClient.ts';
import { LogFormatter } from 'shared/logFormatter.ts';
import { ConversationLogger } from 'shared/conversationLogger.ts';
import { LLMProviderMessageMeta, LLMProviderMessageResponse } from '../../../api/src/types/llms.types.ts';
//import { isApiRunning } from '../utils/pid.utils.ts';
//import { apiStart } from './apiStart.ts';
//import { apiStop } from './apiStop.ts';
import { getBbaiDir, getProjectRoot } from 'shared/dataDir.ts';
import { addToPromptHistory, getPromptHistory } from '../utils/promptHistory.utils.ts';

interface ConversationResponse {
	response: LLMProviderMessageResponse;
	messageMeta: LLMProviderMessageMeta;
	conversationId: string;
	statementCount: number;
	turnCount: number;
	totalTurnCount: number;
	title: string;
}

const symbols = {
	info: '🛈',
	radioOn: '🔘',
	clockwiseRightAndLeftSemicircleArrows: '🔁',
	arrowDown: '⬇️',
	arrowUp: '⬆️',
};

export const conversationStart = new Command()
	.name('chat')
	.description('Start a new conversation or continue an existing one')
	.option('-p, --prompt <string>', 'Prompt to start or continue the conversation')
	.option('-i, --id <string>', 'Conversation ID to continue')
	.option('-m, --model <string>', 'LLM model to use for the conversation')
	.option('--text', 'Return plain text instead of JSON')
	.action(async (options) => {
		//let apiStartedByUs = false;

		try {
			const startDir = Deno.cwd();
			const bbaiDir = await getBbaiDir(Deno.cwd());
			//const projectRoot = await getProjectRoot(Deno.cwd());

			// Check if API is running, start it if not
			/*
			const apiRunning = await isApiRunning(projectRoot);
			if (!apiRunning) {
				console.log('API is not running. Starting it now...');
				await apiStart.action();
				apiStartedByUs = true;
				console.log('API started successfully.');
			}
 */

			// Ensure API is stopped when the process exits
			const cleanup = async () => {
				//if (apiStartedByUs) {
				//	apiStop.action();
				//}
			};
			Deno.addSignalListener('SIGINT', cleanup);
			Deno.addSignalListener('SIGTERM', cleanup);

			let prompt = options.prompt;

			if (!prompt) {
				const stdin = Deno.stdin;

				if (stdin.isTerminal()) {
					let conversationId = options.id;

					tty
						//.cursorSave
						//.cursorHide
						.cursorTo(0, 0)
						.eraseScreen();

					//const response = await fetch('https://avatars.githubusercontent.com/u/176643338?s=48&v=4');
					//const imageBuffer: ArrayBuffer = await response.arrayBuffer();
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

					const formatter = new LogFormatter();

					/*
					async function* keypress(): AsyncGenerator<KeyCode, void> {
						while (true) {
							const data = new Uint8Array(8);

							Deno.stdin.setRaw(true);
							const nread = await Deno.stdin.read(data);
							Deno.stdin.setRaw(false);

							if (nread === null) {
								return;
							}

							const keys: Array<KeyCode> = parse(data.subarray(0, nread));

							for (const key of keys) {
								yield key;
							}
						}
					}

					console.log('Hit ctrl + c to exit.');

					for await (const key of keypress()) {
						if (key.ctrl && key.name === 'c') {
							console.log('exit');
							break;
						}
						console.log(key.char);
					}
					 */

					async function getMultilineInput(): Promise<string> {
						const history = await getPromptHistory(bbaiDir);
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

					// Main chat loop
					while (true) {
						let prompt: string;
						if (options.prompt) {
							prompt = options.prompt;
							options.prompt = undefined; // Clear the initial prompt after first use
						} else {
							prompt = await getMultilineInput();
							await cleanup();
						}

						if (prompt.toLowerCase() === 'exit') {
							console.log('Exiting chat...');
							break;
						}

						try {
							//const response = await apiClient.sendPrompt(prompt, conversationId);
							//apiClient.handleConversationOutput(response, { id: conversationId, json: false });
							//conversationId = response.conversationId;

							let response;
							if (conversationId) {
								response = await apiClient.post(`/api/v1/conversation/${conversationId}`, {
									prompt: prompt,
									model: options.model,
									startDir: startDir,
								});
							} else {
								response = await apiClient.post('/api/v1/conversation', {
									prompt: prompt,
									model: options.model,
									startDir: startDir,
								});
							}

							if (response.ok) {
								await addToPromptHistory(bbaiDir, prompt);
								const data = await response.json();
								handleConversationUpdate(formatter, data, conversationId);
								conversationId = data.conversationId;
							} else {
								const errorBody = await response.text();
								const errorMessage = `Failed to ${
									conversationId ? 'continue' : 'start'
								} conversation. ${response.status}: ${response.statusText}`;
								const errorData = {
									conversationId,
									response: {
										answerContent: [{ text: errorMessage }],
										usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
									},
									statementCount: 0,
									turnCount: 0,
									totalTurnCount: 0,
									title: 'Error',
								};
								handleConversationUpdate(formatter, errorData, conversationId);
								logger.error(`API request failed: ${errorMessage}`);
								logger.error(`Error body: ${errorBody}`);
							}
							await cleanup();
						} catch (error) {
							logger.error(`Error in chat: ${error.message}`);
						}
					}
					Deno.exit(0);
				} else {
					const input = [];
					for await (const line of readLines(stdin)) {
						input.push(line);
					}
					if (input.length === 0) {
						console.error('No input provided. Use -p option or provide input via STDIN.');
						Deno.exit(1);
					}

					prompt = input.join('\n');
				}
			}

			// Trim any leading/trailing whitespace
			prompt = prompt.trim();

			let response;
			if (options.id) {
				response = await apiClient.post(`/api/v1/conversation/${options.id}`, {
					prompt: prompt,
					model: options.model,
					startDir: startDir,
				});
			} else {
				response = await apiClient.post('/api/v1/conversation', {
					prompt: prompt,
					model: options.model,
					startDir: startDir,
				});
			}

			if (response.ok) {
				const data = await response.json();
				handleConversationComplete(data, options);
			} else {
				const errorBody = await response.text();
				console.error(JSON.stringify(
					{
						error: `Failed to ${options.id ? 'continue' : 'start'} conversation`,
						status: response.status,
						body: errorBody,
					},
					null,
					2,
				));
				logger.error(`API request failed: ${response.status} ${response.statusText}`);
				logger.error(`Error body: ${errorBody}`);
			}
		} catch (error) {
			console.error(JSON.stringify(
				{
					error: 'Error in conversation',
					message: error.message,
				},
				null,
				2,
			));
			logger.error(`Unexpected error: ${error.message}`);
			logger.error(`Stack trace: ${error.stack}`);
			//} finally {
			//	await cleanup();
		}
	});

function highlightOutput(text: string): string {
	//return highlight(text, { language: 'plaintext' }).value;
	return text;
}

function handleConversationUpdate(formatter: LogFormatter, data: ConversationResponse, conversationId?: string) {
	//const isNewConversation = !conversationId;
	conversationId = data.conversationId;
	const statementCount = data.statementCount;
	const turnCount = data.turnCount;
	const totalTurnCount = data.totalTurnCount;
	const title = data.title;
	const tokenUsage = data.response.usage;

	const timestamp = LogFormatter.getTimestamp();
	const entry = LogFormatter.createRawEntry('Assistant Message', timestamp, data.response.answerContent[0].text);
	const formattedEntry = formatter.formatRawLogEntry(highlightOutput(entry));
	console.log(formattedEntry);

	const summaryLine1 = colors.bold.cyan(`┌─ Conversation `) + colors.yellow(`ID: ${colors.bold(conversationId)} `) +
		colors.green(`${symbols.info} ${statementCount} `) + colors.magenta(`${symbols.radioOn} ${turnCount} `) +
		colors.blue(`${symbols.clockwiseRightAndLeftSemicircleArrows} ${totalTurnCount}`);

	const summaryLine2 = colors.bold.cyan(`└─ `) + colors.red(`${symbols.arrowDown} ${tokenUsage.inputTokens} `) +
		colors.yellow(`${symbols.arrowUp} ${tokenUsage.outputTokens} `) +
		colors.green(`${symbols.radioOn} ${tokenUsage.totalTokens}`);

	const titleLine = colors.bold.cyan(`│ Title: ${colors.white(title.padEnd(45))} │`);
	const maxLength = Math.max(summaryLine1.length, summaryLine2.length, titleLine.length);
	const padding = ' '.repeat(maxLength - summaryLine1.length);

	console.log(summaryLine1 + padding + colors.bold.cyan('─┐'));
	console.log(titleLine);
	console.log(summaryLine2 + ' '.repeat(maxLength - summaryLine2.length) + colors.bold.cyan('─┘') + '\n');

	// 	console.log(colors.dim.italic(
	// 		`Token Usage: Input: ${tokenUsage.inputTokens}, Output: ${tokenUsage.outputTokens}, Total: ${tokenUsage.totalTokens}`,
	// 	));
}

function handleConversationComplete(response: ConversationResponse, options: { id?: string; text?: boolean }) {
	const isNewConversation = !options.id;
	const conversationId = response.conversationId;
	const statementCount = response.statementCount;
	const turnCount = response.turnCount;
	const totalTurnCount = response.totalTurnCount;
	const title = response.title;
	const tokenUsage = response.response.usage;

	if (!options.text) {
		console.log(JSON.stringify(
			{
				...response,
				isNewConversation,
				conversationId,
				statementCount,
				turnCount,
				totalTurnCount,
				title,
				tokenUsage,
			},
			null,
			2,
		));
	} else {
		console.log(highlightOutput(response.response.answerContent[0].text));

		console.log(colors.bold.cyan('\n┌─────────────── Conversation ───────────────┐'));
		console.log(colors.bold.cyan('│                                                    │'));
		console.log(
			colors.bold.cyan('│  ') + colors.yellow(`ID: ${colors.bold(conversationId.padEnd(43))}`) +
				colors.bold.cyan(' │'),
		);
		console.log(
			colors.bold.cyan('│  ') + colors.green(`Title: ${title.padEnd(40)}`) +
				colors.bold.cyan(' │'),
		);
		console.log(
			colors.bold.cyan('│  ') + colors.magenta(`Turn Count: ${turnCount.toString().padEnd(36)}`) +
				colors.bold.cyan(' │'),
		);
		console.log(
			colors.bold.cyan('│  ') + colors.blue(`Total Turn Count: ${totalTurnCount.toString().padEnd(30)}`) +
				colors.bold.cyan(' │'),
		);
		console.log(colors.bold.cyan('│                                                    │'));
		console.log(colors.bold.cyan('│  Token Usage:                                      │'));
		console.log(colors.bold.cyan('└────────────────────────────────────────────────────┘'));
		const summaryLine1 = colors.bold.cyan(`┌─ Conversation `) +
			colors.yellow(`ID: ${colors.bold(conversationId)} `) +
			colors.green(`${symbols.info} ${statementCount} `) + colors.magenta(`${symbols.radioOn} ${turnCount} `) +
			colors.blue(`${symbols.clockwiseRightAndLeftSemicircleArrows} ${totalTurnCount}`);

		const summaryLine2 = colors.bold.cyan(`└─ `) + colors.red(`${symbols.arrowDown} ${tokenUsage.inputTokens} `) +
			colors.yellow(`${symbols.arrowUp} ${tokenUsage.outputTokens} `) +
			colors.green(`${symbols.radioOn} ${tokenUsage.totalTokens}`);

		const titleLine = colors.bold.cyan(`│ Title: ${colors.white(title.padEnd(45))} │`);
		const maxLength = Math.max(summaryLine1.length, summaryLine2.length, titleLine.length);
		const padding = ' '.repeat(maxLength - summaryLine1.length);

		console.log(summaryLine1 + padding + colors.bold.cyan('─┐'));
		console.log(titleLine);
		console.log(summaryLine2 + ' '.repeat(maxLength - summaryLine2.length) + colors.bold.cyan('─┘'));

		console.log(colors.dim.italic(
			`Token Usage: Input: ${tokenUsage.inputTokens}, Output: ${tokenUsage.outputTokens}, Total: ${tokenUsage.totalTokens}`,
		));
	}
}
