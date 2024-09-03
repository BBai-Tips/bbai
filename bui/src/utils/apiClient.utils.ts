// import { config } from 'shared/configManager.ts';
// import { logger } from 'shared/logger.ts';

// Browser-compatible logger
const logger = {
	info: (message: string) => console.log(message),
	error: (message: string) => console.error(message),
};

export class ApiClient {
	private baseUrl: string;

	constructor(baseUrl: string) {
		this.baseUrl = baseUrl;
	}

	static create(): ApiClient {
		let baseUrl: string;
		if (typeof window !== 'undefined' && window.location) {
			baseUrl = window.location.origin;
		} else {
			// Fallback for non-browser environments (e.g., during SSR)
			baseUrl = 'http://localhost:3000'; // Adjust this port if needed
		}
		logger.info(`APIClient: client created with baseUrl: ${baseUrl}`);
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
			logger.error(
				`APIClient: GET request failed for ${endpoint}: ${error.message}`,
			);
			throw error;
		}
	}

	async post(endpoint: string, data: Record<string, unknown>) {
		logger.info(`APIClient: sending POST to: ${this.baseUrl}${endpoint}`);
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
			logger.error(
				`APIClient: POST request failed for ${endpoint}: ${error.message}`,
			);
			throw error;
		}
	}
}
