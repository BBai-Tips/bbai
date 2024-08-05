import { eventManager, EventName, EventPayloadMap } from 'shared/eventManager.ts';
import { ConversationId } from 'shared/types.ts';
import { apiClient } from './apiClient.ts';

export class WebsocketManager {
	public ws: WebSocket | null = null;

	async setupWebsocket(conversationId?: ConversationId): Promise<void> {
		const MAX_RETRIES = 5;
		const BASE_DELAY = 1000; // 1 second
		let retryCount = 0;

		const connectWebSocket = async (): Promise<WebSocket> => {
			try {
				//console.log('WebsocketManager: Attempting to connect to WebSocket');
				return await apiClient.connectWebSocket(`/api/v1/ws/conversation/${conversationId}`);
			} catch (error) {
				if (retryCount >= MAX_RETRIES) {
					console.error(
						`WebsocketManager: Failed to connect after ${MAX_RETRIES} attempts: ${error.message}`,
					);
					throw new Error(`Failed to connect after ${MAX_RETRIES} attempts: ${error.message}`);
				}
				retryCount++;
				const delay = Math.min(BASE_DELAY * Math.pow(2, retryCount) + Math.random() * 1000, 30000);
				console.log(`WebsocketManager: Connection attempt failed. Retrying in ${delay / 1000} seconds...`);
				await new Promise((resolve) => setTimeout(resolve, delay));
				return connectWebSocket();
			}
		};

		this.ws = await connectWebSocket();
		//console.log('WebsocketManager: WebSocket connection established');

		this.ws.onmessage = (event) => {
			const msgData = JSON.parse(event.data);
			if (msgData.type === 'conversationReady') {
				//console.info('WebsocketManager: Emitting cli:conversationReady event', msgData);
				eventManager.emit(
					'cli:conversationReady',
					{ ...msgData.data } as EventPayloadMap['cli']['cli:conversationReady'],
				);
				eventManager.emit(
					'cli:conversationWaitForReady',
					{
						conversationId: msgData.data.conversationId,
					} as EventPayloadMap['cli']['cli:conversationWaitForReady'],
				);
			} else if (msgData.type === 'conversationEntry') {
				//console.info('WebsocketManager: Emitting cli:conversationAnswer event', msgData);
				eventManager.emit(
					'cli:conversationEntry',
					{ ...msgData.data } as EventPayloadMap['cli']['cli:conversationEntry'],
					//{ conversationId: msgData.data.conversationId } as EventPayloadMap['cli']['cli:conversationEntry'],
				);
			} else if (msgData.type === 'conversationAnswer') {
				//console.info('WebsocketManager: Emitting cli:conversationAnswer event', msgData);
				eventManager.emit(
					'cli:conversationAnswer',
					{ ...msgData.data } as EventPayloadMap['cli']['cli:conversationAnswer'],
				);
				eventManager.emit(
					'cli:conversationWaitForAnswer',
					{
						conversationId: msgData.data.conversationId,
					} as EventPayloadMap['cli']['cli:conversationWaitForAnswer'],
				);
			} else {
				//console.info(`WebsocketManager: Ignoring ${msgData.type} event`, msgData);
				console.error(`WebsocketManager: Received unknown message type: ${msgData.type}`);
			}
		};

		this.ws.onopen = () => {
			//console.log('WebsocketManager: WebSocket connection opened');
			this.ws!.send(JSON.stringify({ conversationId, startDir: Deno.cwd(), task: 'greeting', statement: '' }));
			/*
			const message = JSON.stringify({ conversationId, startDir: Deno.cwd(), task: 'greeting', statement: '' });
			console.log('WebsocketManager: Sending greeting message:', message);
			this.ws!.send(message);
			 */
		};

		this.ws.onclose = async () => {
			//console.log('WebsocketManager: WebSocket connection closed. Attempting to reconnect...');
			//await this.setupWebsocket(conversationId);
		};

		this.ws.onerror = (_error) => {
			//console.error('WebsocketManager: WebSocket error:', error);
			console.error('WebsocketManager: WebSocket error. Attempting to reconnect...');
		};
	}

	async waitForReady(conversationId: ConversationId): Promise<void> {
		//console.log(`WebsocketManager: Waiting for ready event for conversation ${conversationId}`);
		await eventManager.once('cli:conversationWaitForReady' as EventName<'cli'>, conversationId) as Promise<
			EventPayloadMap['cli']['cli:conversationWaitForReady']
		>;
		//console.log(`WebsocketManager: Received ready event for conversation ${conversationId}`);
	}

	async waitForAnswer(conversationId: ConversationId): Promise<void> {
		//console.log(`WebsocketManager: Waiting for answer event for conversation ${conversationId}`);
		await eventManager.once('cli:conversationWaitForAnswer' as EventName<'cli'>, conversationId) as Promise<
			EventPayloadMap['cli']['cli:conversationWaitForAnswer']
		>;
		//console.log(`WebsocketManager: Received answer event for conversation ${conversationId}`);
	}
}

export const websocketManager = new WebsocketManager();
