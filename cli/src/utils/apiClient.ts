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
		logger.info(`Creating API client with base URL: ${baseUrl}`);
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
}

export const apiClient = await ApiClient.create();
