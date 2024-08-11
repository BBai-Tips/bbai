import { eventManager, EventName, EventPayloadMap } from 'shared/eventManager.ts';
import { ConversationId } from 'shared/types.ts';
import { apiClient } from './apiClient.ts';

export class WebsocketManager {
	public ws: WebSocket | null = null;
	private MAX_RETRIES = 5;
	private BASE_DELAY = 1000; // 1 second
	private retryCount = 0;

	async setupWebsocket(conversationId?: ConversationId): Promise<void> {
		const connectWebSocket = async (): Promise<WebSocket> => {
			try {
				//console.log('WebsocketManager: Attempting to connect to WebSocket');
				return await apiClient.connectWebSocket(`/api/v1/ws/conversation/${conversationId}`);
			} catch (error) {
				await this.handleRetry(error);
				return connectWebSocket();
			}
		};

		this.ws = await connectWebSocket();
		this.retryCount = 0; // Reset retry count on successful connection
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
					{ ...msgData.data, expectingMoreInput: true } as EventPayloadMap['cli']['cli:conversationEntry'],
				);
			} else if (msgData.type === 'conversationAnswer') {
				//console.info('WebsocketManager: Emitting cli:conversationAnswer event', msgData);
				eventManager.emit(
					'cli:conversationAnswer',
					{ ...msgData.data, expectingMoreInput: false } as EventPayloadMap['cli']['cli:conversationAnswer'],
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
			console.log('WebsocketManager: WebSocket connection closed. Attempting to reconnect...');
			await this.handleRetry(new Error('WebSocket connection closed'));
			await this.setupWebsocket(conversationId);
			eventManager.emit(
				'cli:websocketReconnected',
				{ conversationId } as EventPayloadMap['cli']['cli:websocketReconnected'],
			);
		};

		this.ws.onerror = async (event) => {
			const error = event instanceof ErrorEvent ? event.error : new Error('Unknown WebSocket error');
			console.error('WebsocketManager: WebSocket error:', error);
			await this.handleRetry(error);
			await this.setupWebsocket(conversationId);
			eventManager.emit(
				'cli:websocketReconnected',
				{ conversationId } as EventPayloadMap['cli']['cli:websocketReconnected'],
			);
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

	private async handleRetry(error: Error): Promise<void> {
		if (this.retryCount >= this.MAX_RETRIES) {
			console.error(
				`WebsocketManager: Failed to connect after ${this.MAX_RETRIES} attempts: ${error.message}`,
			);
			throw new Error(`Failed to connect after ${this.MAX_RETRIES} attempts: ${error.message}`);
		}
		this.retryCount++;
		const delay = Math.min(this.BASE_DELAY * Math.pow(2, this.retryCount) + Math.random() * 1000, 30000);
		console.log(`WebsocketManager: Connection attempt failed. Retrying in ${delay / 1000} seconds...`);
		await new Promise((resolve) => setTimeout(resolve, delay));
	}
}

export const websocketManager = new WebsocketManager();
