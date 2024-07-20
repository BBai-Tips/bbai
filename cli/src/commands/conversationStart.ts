import { Command } from 'cliffy/command/mod.ts';
import { logger } from 'shared/logger.ts';
import { apiClient } from '../utils/apiClient.ts';

export const conversationStart = new Command()
	.name('start')
	.description('Start a new conversation')
	.option('-s, --system <string>', 'System message to start the conversation')
	.option('-m, --model <string>', 'LLM model to use for the conversation')
	.action(async (options) => {
		try {
			const response = await apiClient.post('/api/v1/conversation/start', {
				system: options.system,
				model: options.model,
			});

			if (response.ok) {
				const data = await response.json();
				logger.info(`New conversation started. Conversation ID: ${data.conversationId}`);
				logger.debug('Response body:', data);
			} else {
				logger.error(`Failed to start conversation. Status: ${response.status}`);
				const errorBody = await response.text();
				logger.debug('Error response body:', errorBody);
			}
		} catch (error) {
			logger.error(`Error starting conversation: ${error.message}`);
		}
	});
