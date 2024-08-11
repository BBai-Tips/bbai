import { Command } from 'cliffy/command/mod.ts';
import { ConversationMetadata } from 'shared/types.ts';
import { resolve } from '@std/path';
import { apiClient } from '../utils/apiClient.ts';
// import { createSpinner, startSpinner, stopSpinner } from '../utils/terminalHandler.utils.ts';

export const conversationList = new Command()
	.description('List saved conversations')
	.option('-d, --directory <dir:string>', 'The starting directory for the project', { default: Deno.cwd() })
	.action(async ({ directory }) => {
		// 		const spinner = createSpinner('Fetching saved conversations...');
		// 		startSpinner(spinner, 'Fetching saved conversations...');

		try {
			const startDir = resolve(directory);
			const response = await apiClient.get(`/api/v1/conversation?startDir=${encodeURIComponent(startDir)}`);
			// 			stopSpinner(spinner);

			if (response.ok) {
				const { conversations, pagination } = await response.json();
				if (conversations.length === 0) {
					console.log('No saved conversations found on this page.');
				} else {
					console.log('Saved conversations:');
					console.log(
						`Page ${pagination.page} of ${pagination.totalPages} (Total items: ${pagination.totalItems})`,
					);
					conversations.forEach(
						(conversation: ConversationMetadata, index: number) => {
							console.log(`${index + 1}. ID: ${conversation.id}`);
							console.log(`   Title: ${conversation.title}`);
							console.log(`   LLM Provider: ${conversation.llmProviderName || 'N/A'}`);
							console.log(`   Model: ${conversation.model || 'N/A'}`);
							console.log(`   Created At: ${new Date(conversation.createdAt).toLocaleString()}`);
							console.log(`   Updated At: ${new Date(conversation.updatedAt).toLocaleString()}`);
							console.log(''); // Add a blank line between conversations
						},
					);
				}
			} else {
				console.error('Failed to fetch saved conversations:', response.statusText);
				const errorBody = await response.json();
				console.error('Error details:', errorBody.error);
			}
		} catch (error) {
			// 			stopSpinner(spinner);
			console.error('Error fetching saved conversations:', error.message);
		}
	});
