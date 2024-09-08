import { ConfigManager, type GlobalConfigSchema } from 'shared/configManager.ts';
import { logger } from 'shared/logger.ts';

export default class ApiClient {
	private baseUrl: string;
	private wsUrl: string;

	private constructor(baseUrl: string, wsUrl: string) {
		this.baseUrl = baseUrl;
		this.wsUrl = wsUrl;
	}

	static async create(startDir: string = Deno.cwd()): Promise<ApiClient> {
		const configManager = await ConfigManager.getInstance();
		const globalConfig: GlobalConfigSchema = await configManager.loadGlobalConfig(startDir);
		const apiPort = globalConfig.api.apiPort || 3000;
		const baseUrl = `http://localhost:${apiPort}`;
		const wsUrl = `ws://localhost:${apiPort}`;
		logger.debug(`APIClient: client created with baseUrl: ${baseUrl}, wsUrl: ${wsUrl}`);
		return new ApiClient(baseUrl, wsUrl);
	}

	async get(endpoint: string) {
		try {
			//logger.info(`APIClient: GET request to: ${this.baseUrl}${endpoint}`);
			const response = await fetch(`${this.baseUrl}${endpoint}`);
			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}
			return response;
		} catch (error) {
			logger.error(`APIClient: GET request failed for ${endpoint}: ${error.message}`);
			throw error;
		}
	}

	async post(endpoint: string, data: Record<string, unknown>) {
		try {
			//logger.info(`APIClient: POST request to: ${this.baseUrl}${endpoint}`);
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
			logger.error(`APIClient: POST request failed for ${endpoint}: ${error.message}`);
			throw error;
		}
	}

	connectWebSocket(endpoint: string): Promise<WebSocket> {
		const fullWsUrl = `${this.wsUrl}${endpoint}`;
		//logger.info(`APIClient: Connecting WebSocket to: ${fullWsUrl}`);
		const ws = new WebSocket(fullWsUrl);

		return new Promise((resolve, reject) => {
			ws.onopen = () => {
				//logger.info('APIClient: WebSocket connection opened');
				resolve(ws);
			};
			ws.onerror = (error) => {
				logger.error('APIClient: WebSocket connection error:', error);
				reject(error);
			};
		});
	}
}

//export const apiClient = await ApiClient.create();
