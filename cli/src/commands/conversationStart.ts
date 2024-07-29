import { Command } from 'cliffy/command/mod.ts';
import { Input } from 'cliffy/prompt/mod.ts';
import highlight from 'highlight';
import { readLines } from '@std/io';
import { colors } from 'cliffy/ansi/mod.ts';

import { logger } from 'shared/logger.ts';
import { apiClient } from '../utils/apiClient.ts';
import { LogFormatter } from 'shared/logFormatter.ts';
import { ConversationLogger } from 'shared/conversationLogger.ts';
import { getProjectRoot } from 'shared/dataDir.ts';
import { LLMProviderMessageMeta, LLMProviderMessageResponse } from '../../../api/src/types/llms.types.ts';
import { isApiRunning } from '../utils/pid.utils.ts';
import { apiStart } from './apiStart.ts';
import { apiStop } from './apiStop.ts';

interface ConversationResponse {
	response: LLMProviderMessageResponse;
	messageMeta: LLMProviderMessageMeta;
	conversationId: string;
	statementCount: number;
	turnCount: number;
	totalTurnCount: number;
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
		try {
			const startDir = Deno.cwd();
			let prompt = options.prompt;

			if (!prompt) {
				const stdin = Deno.stdin;

				if (stdin.isTerminal()) {
					let conversationId = options.id;

					const formatter = new LogFormatter();

					async function getMultilineInput(): Promise<string> {
						return await Input.prompt({
							message: 'Ask Claude',
							prefix: '👤  ',
							//files: true,
							//info: true,
							//list: true,
							//transform: (input: string) => highlight(input, { language: 'plaintext' }).value,
						});
					}

					// Main chat loop
					while (true) {
						let prompt: string;
						if (options.prompt) {
							prompt = options.prompt;
							options.prompt = undefined; // Clear the initial prompt after first use
						} else {
							prompt = await getMultilineInput();
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
								const data = await response.json();
								handleConversationUpdate(formatter, data, conversationId);
								conversationId = data.conversationId;
							} else {
								const errorBody = await response.json();
								handleConversationUpdate(formatter, errorBody, conversationId);
								/*
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
 */
							}
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
		}
	});

function highlightOutput(text: string): string {
	//return highlight(text, { language: 'plaintext' }).value;
	return text;
}

function handleConversationUpdate(formatter: LogFormatter, data: ConversationResponse, conversationId?: string) {
	const isNewConversation = !conversationId;
	conversationId = data.conversationId;
	const statementCount = data.statementCount;
	const turnCount = data.turnCount;
	const totalTurnCount = data.totalTurnCount;
	const tokenUsage = data.response.usage;

	const timestamp = LogFormatter.getTimestamp();
	const entry = LogFormatter.createRawEntry('Assistant Message', timestamp, data.response.answerContent[0].text);
	const formattedEntry = formatter.formatRawLogEntry(highlightOutput(entry));
	console.log(formattedEntry);

	const summaryLine1 = colors.bold.cyan(`┌─ Summary `) + colors.yellow(`ID: ${colors.bold(conversationId)} `) +
		colors.green(`${symbols.info} ${statementCount} `) + colors.magenta(`${symbols.radioOn} ${turnCount} `) +
		colors.blue(`${symbols.clockwiseRightAndLeftSemicircleArrows} ${totalTurnCount}`);

	const summaryLine2 = colors.bold.cyan(`└─ `) + colors.red(`${symbols.arrowDown} ${tokenUsage.inputTokens} `) +
		colors.yellow(`${symbols.arrowUp} ${tokenUsage.outputTokens} `) +
		colors.green(`${symbols.radioOn} ${tokenUsage.totalTokens}`);

	const maxLength = Math.max(summaryLine1.length, summaryLine2.length);
	const padding = ' '.repeat(maxLength - summaryLine1.length);

	console.log(summaryLine1 + padding + colors.bold.cyan('─┐'));
	console.log(summaryLine2 + ' '.repeat(maxLength - summaryLine2.length) + colors.bold.cyan('─┘'));

	console.log(colors.dim.italic(
		`Token Usage: Input: ${tokenUsage.inputTokens}, Output: ${tokenUsage.outputTokens}, Total: ${tokenUsage.totalTokens}`,
	));
}
function handleConversationComplete(response: ConversationResponse, options: { id?: string; text?: boolean }) {
	const isNewConversation = !options.id;
	const conversationId = response.conversationId;
	const statementCount = response.statementCount;
	const turnCount = response.turnCount;
	const totalTurnCount = response.totalTurnCount;
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
				tokenUsage,
			},
			null,
			2,
		));
	} else {
		console.log(highlightOutput(response.response.answerContent[0].text));

		console.log(colors.bold.cyan('\n┌─────────────── Conversation Summary ───────────────┐'));
		console.log(colors.bold.cyan('│                                                    │'));
		console.log(
			colors.bold.cyan('│  ') + colors.yellow(`Conversation ID: ${colors.bold(conversationId.padEnd(31))}`) +
				colors.bold.cyan(' │'),
		);
		console.log(
			colors.bold.cyan('│  ') + colors.green(`Statement Count: ${statementCount.toString().padEnd(31)}`) +
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
		const summaryLine1 = colors.bold.cyan(`┌─ Summary `) + colors.yellow(`ID: ${colors.bold(conversationId)} `) +
			colors.green(`${symbols.info} ${statementCount} `) + colors.magenta(`${symbols.radioOn} ${turnCount} `) +
			colors.blue(`${symbols.clockwiseRightAndLeftSemicircleArrows} ${totalTurnCount}`);

		const summaryLine2 = colors.bold.cyan(`└─ `) + colors.red(`${symbols.arrowDown} ${tokenUsage.inputTokens} `) +
			colors.yellow(`${symbols.arrowUp} ${tokenUsage.outputTokens} `) +
			colors.green(`${symbols.radioOn} ${tokenUsage.totalTokens}`);

		const maxLength = Math.max(summaryLine1.length, summaryLine2.length);
		const padding = ' '.repeat(maxLength - summaryLine1.length);

		console.log(summaryLine1 + padding + colors.bold.cyan('─┐'));
		console.log(summaryLine2 + ' '.repeat(maxLength - summaryLine2.length) + colors.bold.cyan('─┘'));

		console.log(colors.dim.italic(
			`Token Usage: Input: ${tokenUsage.inputTokens}, Output: ${tokenUsage.outputTokens}, Total: ${tokenUsage.totalTokens}`,
		));
	}
}
