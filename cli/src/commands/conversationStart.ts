import { Command } from 'cliffy/command/mod.ts';
import { logger } from 'shared/logger.ts';
import { apiClient } from '../utils/apiClient.ts';
import { readLines } from '@std/io';

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
				const input = [];
				const stdin = Deno.stdin;

				if (stdin.isTerminal()) {
					console.log("Enter your prompt. End with a line containing only a dot ('.'):");
					for await (const line of readLines(stdin)) {
						if (line === '.') {
							break;
						}
						input.push(line);
					}
				} else {
					for await (const line of readLines(stdin)) {
						input.push(line);
					}
				}

				if (input.length === 0) {
					console.error('No input provided. Use -p option or provide input via STDIN.');
					Deno.exit(1);
				}

				prompt = input.join('\n');
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
				apiClient.handleConversationOutput(data, options);
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
