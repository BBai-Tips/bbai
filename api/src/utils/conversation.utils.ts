import type LLMChatInteraction from '../llms/interactions/chatInteraction.ts';
import { stripIndents } from 'common-tags';

export async function generateConversationTitle(chat: LLMChatInteraction, prompt: string): Promise<string> {
	const titlePrompt = stripIndents`
        Create a very short title (max 5 words) for a conversation based on the following prompt:
        "${prompt.substring(0, 500)}${prompt.length > 500 ? '...' : ''}"
        
        Respond with the title only, no additional text.`;
	const response = await chat.chat(titlePrompt);
	const contentPart = response.messageResponse.answerContent[0] as { type: 'text'; text: string };
	return contentPart.text.trim();
}
