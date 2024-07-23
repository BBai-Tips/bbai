import { Command } from 'cliffy/command/mod.ts';
import { logger } from 'shared/logger.ts';
import { apiClient } from '../utils/apiClient.ts';

export const conversationStart = new Command()
	.name('chat')
	.description('Start a new conversation or continue an existing one')
	.option('-p, --prompt <string>', 'Prompt to start or continue the conversation')
	.option('-i, --id <string>', 'Conversation ID to continue')
	.option('-m, --model <string>', 'LLM model to use for the conversation')
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
				logger.info(
					`Conversation ${options.id ? 'continued' : 'started'}. Conversation ID: ${data.conversationId}`,
				);
				logger.debug('Response body:', data);
			} else {
				logger.error(`Failed to ${options.id ? 'continue' : 'start'} conversation. Status: ${response.status}`);
				const errorBody = await response.text();
				logger.error('Error response body:', errorBody);
			}
		} catch (error) {
			logger.error(`Error in conversation: ${error.message}`);
		}
	});
