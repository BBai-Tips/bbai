import { config } from 'shared/configManager.ts';
import { logger } from 'shared/logger.ts';

class ApiClient {
	private baseUrl: string;

	private constructor(baseUrl: string) {
		this.baseUrl = baseUrl;
	}

	static async create(): Promise<ApiClient> {
		const baseUrl = `http://localhost:${config.api.apiPort}`;
		return new ApiClient(baseUrl);
	}

	async get(endpoint: string) {
		return await fetch(`${this.baseUrl}${endpoint}`);
	}

	async post(endpoint: string, data: Record<string, unknown>) {
		return await fetch(`${this.baseUrl}${endpoint}`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(data),
		});
	}
}

export const apiClient = await ApiClient.create();
