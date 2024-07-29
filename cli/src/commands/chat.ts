import { Command } from 'cliffy/command/mod.ts';
import { Input, Select } from 'cliffy/prompt/mod.ts';
import highlight from 'highlight';
import { apiClient } from '../utils/apiClient.ts';
import { logger } from 'shared/logger.ts';
import { ConversationResponse } from '../types/conversation.ts';
import { addToPromptHistory, getPromptHistory } from '../utils/promptHistory.utils.ts';

export const chat = new Command()
	.description('Start a chat session with BBai')
	.option('-i, --id <id:string>', 'Conversation ID')
	.option('-p, --prompt <prompt:string>', 'Initial prompt')
	.action(async (options) => {
		let conversationId = options.id;

		async function getMultilineInput(startDir: string): Promise<string> {
			const history = await getPromptHistory(startDir);
			const input = await Input.prompt({
				message: '> ',
				multiline: true,
				files: true,
				info: true,
				list: true,
				suggestions: history,
				completeOnEmpty: true,
				history: {
					enable: true,
					persistent: true,
				},
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
				prompt = await getMultilineInput(Deno.cwd());

			if (prompt.toLowerCase() === 'exit') {
				console.log('Exiting chat...');
				break;
			}

			try {
				const response = await apiClient.sendPrompt(prompt, conversationId);
				await addToPromptHistory(Deno.cwd(), prompt);
				handleConversationOutput(response, { id: conversationId, json: false });
				conversationId = response.conversationId;
			} catch (error) {
				logger.error(`Error in chat: ${error.message}`);
			}
		}
	});

function highlightOutput(text: string): string {
	return highlight(text, { language: 'plaintext' }).value;
}

function handleConversationOutput(response: ConversationResponse, options: { id?: string; json: boolean }) {
	const isNewConversation = !options.id;
	const conversationId = response.conversationId;
	const statementCount = response.statementCount;
	const turnCount = response.turnCount;
	const totalTurnCount = response.totalTurnCount;
	const tokenUsage = response.response.usage;

	if (options.json) {
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

		console.log(`\nConversation ID: ${conversationId}`);
		console.log(`Statement Count: ${statementCount}`);
		console.log(`Turn Count: ${turnCount}`);
		console.log(`Total Turn Count: ${totalTurnCount}`);
		console.log(
			`Token Usage: Input: ${tokenUsage.inputTokens}, Output: ${tokenUsage.outputTokens}, Total: ${tokenUsage.totalTokens}`,
		);

		if (isNewConversation) {
			console.log(`\nNew conversation started.`);
			console.log(`To continue this conversation, use:`);
			console.log(`bbai chat -i ${conversationId} -p "Your next question"`);
		}
	}
}
