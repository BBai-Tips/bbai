import { Command } from 'cliffy/command/mod.ts';
import { Spinner, TerminalHandler } from '../utils/terminalHandler.utils.ts';
import { readLines } from '@std/io';

import { logger } from 'shared/logger.ts';
import { apiClient } from '../utils/apiClient.ts';
import { LogFormatter } from 'shared/logFormatter.ts';
import { ConversationEntry, ConversationId, ConversationResponse, ConversationStart } from 'shared/types.ts';
import { isApiRunning } from '../utils/pid.utils.ts';
import { startApiServer, stopApiServer } from '../utils/apiControl.utils.ts';
import { getBbaiDir, getProjectRoot } from 'shared/dataDir.ts';
import { addToStatementHistory } from '../utils/statementHistory.utils.ts';
import { websocketManager } from '../utils/websocketManager.ts';
import { generateConversationId } from 'shared/conversationManagement.ts';
import { eventManager } from 'shared/eventManager.ts';

const startDir = Deno.cwd();
const bbaiDir = await getBbaiDir(startDir);
const projectRoot = await getProjectRoot(startDir);

export const conversationStart = new Command()
	.name('chat')
	.description('Start a new conversation or continue an existing one')
	.option('-s, --statement <string>', 'Statement (or question) to start or continue the conversation')
	.option('-i, --id <string>', 'Conversation ID to continue (optional)')
	.option('-m, --model <string>', 'LLM model to use for the conversation')
	.option('--text', 'Return plain text instead of JSON')
	.action(async (options) => {
		let apiStartedByUs = false;

		const cleanup = async () => {
			// Ensure API is stopped when the process exits
			if (apiStartedByUs) {
				await stopApiServer(projectRoot);
			}
		};
		const exit = async () => {
			cleanup();
			Deno.exit(0);
		};
		Deno.addSignalListener('SIGINT', exit);
		Deno.addSignalListener('SIGTERM', exit);

		try {
			// Check if API is running, start it if not
			const apiRunning = await isApiRunning(projectRoot);
			if (!apiRunning) {
				console.log('API is not running. Starting it now...');
				await startApiServer(projectRoot);
				//await new Promise((resolve) => setTimeout(resolve, 1000));
				apiStartedByUs = true;
				console.log('API started successfully.');
			}

			const startDir = Deno.cwd();
			let conversationId: string = options.id || generateConversationId();
			let statement = options.statement?.trim();

			const stdin = Deno.stdin;
			// if we got a statement passed on cli, or if we're not running in terminal then must be getting stdin
			if (statement || (!statement && !stdin.isTerminal())) {
				// no statement passed, so must be stdin, read all the lines
				if (!statement) {
					const input = [];
					for await (const line of readLines(stdin)) {
						input.push(line);
					}
					if (input.length === 0) {
						console.error('No input provided. Use -p option or provide input via STDIN.');
						Deno.exit(1);
					}

					statement = input.join('\n');
				}
				// we've got a statement now; either passed as cli arg or read from stdin
				let response;
				if (conversationId) {
					response = await apiClient.post(`/api/v1/conversation/${conversationId}`, {
						statement: statement,
						//model: options.model,
						startDir: startDir,
					});
				} else {
					response = await apiClient.post('/api/v1/conversation', {
						statement: statement,
						//model: options.model,
						startDir: startDir,
					});
				}

				if (response.ok) {
					const data = await response.json();
					const terminalHandler = new TerminalHandler(bbaiDir);
					terminalHandler.displayConversationComplete(data, options);
				} else {
					const errorBody = await response.text();
					console.error(JSON.stringify(
						{
							error: `Failed to ${conversationId ? 'continue' : 'start'} conversation`,
							status: response.status,
							body: errorBody,
						},
						null,
						2,
					));
					logger.error(`API request failed: ${response.status} ${response.statusText}`);
					logger.error(`Error body: ${errorBody}`);
				}
			} else {
				const terminalHandler = new TerminalHandler(bbaiDir);

				// we're running in a terminal
				terminalHandler.initializeTerminal();

				await websocketManager.setupWebsocket(conversationId);

				// Spinner is now managed by terminalHandler
				terminalHandler.startSpinner('Setting up...');

				// Set up event listeners
				let conversationStartDisplayed = false;
				eventManager.on('cli:conversationReady', (data) => {
					if (!conversationStartDisplayed) {
						terminalHandler.displayConversationStart(data as ConversationStart, conversationId, true);
						conversationStartDisplayed = true;
					}
				}, conversationId);

				eventManager.on('cli:conversationEntry', (data) => {
					terminalHandler.displayConversationEntry(data as ConversationEntry, conversationId, true);
				}, conversationId);

				eventManager.on('cli:conversationAnswer', (data) => {
					terminalHandler.displayConversationUpdate(data as ConversationResponse, conversationId, false);
				}, conversationId);

				eventManager.on('cli:websocketReconnected', handleWebsocketReconnection);

				await websocketManager.waitForReady(conversationId!);

				// Main chat loop
				while (true) {
					terminalHandler.hideSpinner();
					statement = await terminalHandler.getMultilineInput();

					const statementCmd = statement.toLowerCase();
					if (statementCmd === 'exit' || statementCmd === 'quit') {
						console.log('Exiting chat...');
						break;
					}
					if (statement === '') {
						console.log('Ask something first...\n');
						continue;
					}

					// terminalHandler.displayDividerLine();

					try {
						//console.log(`Processing statement using conversationId: ${conversationId}`);
						await processStatement(terminalHandler, conversationId!, statement);
					} catch (error) {
						logger.error(`Error in chat: ${error.message}`);
					}
				}
				await cleanup();
				Deno.exit(0);
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
		} finally {
			await cleanup();
		}
	});

function handleWebsocketReconnection() {
	//console.log(palette.info('WebSocket reconnected. Redrawing prompt...'));
	//redrawPrompt();
}

const processStatement = async (
	terminalHandler: TerminalHandler,
	conversationId: ConversationId,
	statement: string,
): Promise<void> => {
	await addToStatementHistory(bbaiDir, statement);
	const task = 'converse';
	terminalHandler.startSpinner('Claude is thinking...');
	try {
		websocketManager.ws?.send(JSON.stringify({ conversationId, startDir, task, statement }));
		await websocketManager.waitForAnswer(conversationId);
	} finally {
		terminalHandler.stopSpinner('Claude is finished');
	}
};
