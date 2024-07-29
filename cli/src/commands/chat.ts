import { Command } from 'cliffy/command/mod.ts';
import { Input } from 'cliffy/prompt/mod.ts';
import { highlight } from 'https://esm.sh/highlight.js@11.7.0';
import { apiClient } from '../utils/apiClient.ts';
import { logger } from 'shared/logger.ts';

export const chat = new Command()
	.description('Start a chat session with BBai')
	.option('-i, --id <id:string>', 'Conversation ID')
	.option('-p, --prompt <prompt:string>', 'Initial prompt')
	.action(async (options) => {
		let conversationId = options.id;

		async function getMultilineInput(): Promise<string> {
			return await Input.prompt({
				message: 'Enter your prompt:',
				multiline: true,
				transform: (input: string) => highlight(input, { language: 'plaintext' }).value,
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
				const response = await apiClient.sendPrompt(prompt, conversationId);
				apiClient.handleConversationOutput(response, { id: conversationId, json: false });
				conversationId = response.conversationId;
			} catch (error) {
				logger.error(`Error in chat: ${error.message}`);
			}
		}
	});
