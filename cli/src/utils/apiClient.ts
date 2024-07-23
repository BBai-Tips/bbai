import { config } from 'shared/configManager.ts';
import { logger } from 'shared/logger.ts';

class ApiClient {
	private baseUrl: string;

	private constructor(baseUrl: string) {
		this.baseUrl = baseUrl;
	}

	static async create(): Promise<ApiClient> {
		const apiPort = config.api?.apiPort || 3000;
		const baseUrl = `http://localhost:${apiPort}`;
		return new ApiClient(baseUrl);
	}

	async get(endpoint: string) {
		try {
			const response = await fetch(`${this.baseUrl}${endpoint}`);
			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}
			return response;
		} catch (error) {
			logger.error(`GET request failed for ${endpoint}: ${error.message}`);
			throw error;
		}
	}

	async post(endpoint: string, data: Record<string, unknown>) {
		try {
			const response = await fetch(`${this.baseUrl}${endpoint}`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(data),
			});
			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}
			return response;
		} catch (error) {
			logger.error(`POST request failed for ${endpoint}: ${error.message}`);
			throw error;
		}
	}

	async sendPrompt(prompt: string, conversationId?: string): Promise<any> {
		const endpoint = conversationId ? `/api/v1/prompt/${conversationId}` : '/api/v1/prompt';
		const response = await this.post(endpoint, { prompt });
		return await response.json();
	}

	handleConversationOutput(response: any, options: any) {
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
			console.log(response.response.answerContent[0].text);

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
}

export const apiClient = await ApiClient.create();
