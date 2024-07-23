import { Command } from 'cliffy/command/mod.ts';
import { logger } from 'shared/logger.ts';
import { apiClient } from '../utils/apiClient.ts';

export const conversationStart = new Command()
	.name('chat')
	.description('Start a new conversation or continue an existing one')
	.option('-p, --prompt <string>', 'Prompt to start or continue the conversation')
	.option('-i, --id <string>', 'Conversation ID to continue')
	.option('-m, --model <string>', 'LLM model to use for the conversation')
	.option('--text', 'Return plain text instead of JSON')
	.action(async (options) => {
		try {
			const cwd = Deno.cwd();
			let response;
			if (options.id) {
				response = await apiClient.post(`/api/v1/conversation/${options.id}`, {
					prompt: options.prompt,
					model: options.model,
					cwd: cwd,
				});
			} else {
				response = await apiClient.post('/api/v1/conversation', {
					prompt: options.prompt,
					model: options.model,
					cwd: cwd,
				});
			}

			if (response.ok) {
				const data = await response.json();
				apiClient.handleConversationOutput(data, options);
			} else {
				const errorBody = await response.text();
				console.error(JSON.stringify({
					error: `Failed to ${options.id ? 'continue' : 'start'} conversation`,
					status: response.status,
					body: errorBody
				}, null, 2));
			}
		} catch (error) {
			console.error(JSON.stringify({
				error: 'Error in conversation',
				message: error.message
			}, null, 2));
		}
	});
