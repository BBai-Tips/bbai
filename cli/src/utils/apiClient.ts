import { config } from 'shared/configManager.ts';
import { logger } from 'shared/logger.ts';

class ApiClient {
	private baseUrl: string;
	private wsUrl: string;

	private constructor(baseUrl: string, wsUrl: string) {
		this.baseUrl = baseUrl;
		this.wsUrl = wsUrl;
	}

	static async create(): Promise<ApiClient> {
		const apiPort = config.api?.apiPort || 3000;
		const baseUrl = `http://localhost:${apiPort}`;
		const wsUrl = `ws://localhost:${apiPort}`;
		return new ApiClient(baseUrl, wsUrl);
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

	/*
	async sendPrompt(prompt: string, conversationId?: ConversationId): Promise<any> {
		const endpoint = conversationId ? `/api/v1/prompt/${conversationId}` : '/api/v1/prompt';
		const response = await this.post(endpoint, { prompt });
		return await response.json();
	}
	 */

	async connectWebSocket(endpoint: string): Promise<WebSocket> {
		const ws = new WebSocket(`${this.wsUrl}${endpoint}`);
		// we don't want to wait for the connection to be open
		//await new Promise((resolve) => {
		//	ws.onopen = resolve;
		//});
		return ws;
	}
	//private sendWsMessage(ws: WebSocket, type: string, data: any) {
	//	ws.send(JSON.stringify({ type, data }));
	//}
}

export const apiClient = await ApiClient.create();
