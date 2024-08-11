import { Context, RouterContext } from '@oak/oak';

import ProjectEditorManager from '../../editor/projectEditorManager.ts';
import { logger } from 'shared/logger.ts';
import { ConversationId } from 'shared/types.ts';
import EventManager, { EventMap, EventName } from 'shared/eventManager.ts';

class WebSocketHandler {
	private projectEditorManager: ProjectEditorManager;
	//private connections: Map<WebSocket, string> = new Map(); // WebSocket to conversationId mapping

	constructor(private eventManager: EventManager) {
		this.projectEditorManager = new ProjectEditorManager();
	}

	handleConnection(ws: WebSocket, conversationId: ConversationId) {
		ws.onopen = () => {
			logger.info('WebSocket connection opened');
		};

		ws.onmessage = async (event) => {
			try {
				const message = JSON.parse(event.data);
				await this.handleMessage(ws, conversationId, message);
			} catch (error) {
				logger.error('Error handling message:', error);
				ws.send(JSON.stringify({ error: 'Invalid message format' }));
			}
		};

		ws.onclose = () => {
			logger.info('WebSocket connection closed');
			this.removeConnection(ws, conversationId);
		};

		ws.onerror = (error) => {
			logger.error('WebSocket error:', error);
		};

		this.setupEventListeners(ws, conversationId);
	}

	private async handleMessage(ws: WebSocket, conversationId: ConversationId, message: any) {
		const { task, statement, startDir } = message;
		//this.connections.set(ws, conversationId);
		//logger.info('WebSocketHandler: handleMessage', message);

		let projectEditor = this.projectEditorManager.getEditor(conversationId);

		if (!projectEditor && task !== 'greeting') {
			ws.send(JSON.stringify({
				type: 'error',
				data: {
					error: 'No active conversation',
					code: 'NO_ACTIVE_CONVERSATION',
				},
			}));
			return;
		}

		if (task === 'greeting') {
			if (!startDir) {
				ws.send(JSON.stringify({
					type: 'error',
					data: {
						error: 'Start directory is required for greeting',
						code: 'START_DIR_REQUIRED',
					},
				}));
				return;
			}

			try {
				projectEditor = await this.projectEditorManager.getOrCreateEditor(conversationId, startDir);

				//console.log('WebSocketHandler: Emitting projectEditor:conversationReady event');
				this.eventManager.emit('projectEditor:conversationReady', {
					conversationId: projectEditor.conversation.id,
					conversationTitle: projectEditor.conversation.title || '',
					statementCount: projectEditor.statementCount,
				});
			} catch (error) {
				logger.error('Error creating project editor:', error);
				this.eventManager.emit('projectEditor:conversationError', {
					conversationId,
					error: 'Failed to create project editor',
					code: 'PROJECT_EDITOR_CREATION_FAILED',
				});
			}
			return;
		}

		try {
			const _result = await projectEditor?.handleStatement(statement);
			//logger.debug(`handleStatement result: ${JSON.stringify(result)}`);
		} catch (error) {
			logger.error('Error handling statement:', error);
			this.eventManager.emit('projectEditor:conversationError', {
				conversationId,
				error: 'Error handling statement',
				code: 'STATEMENT_ERROR',
			});
		}
	}

	private setupEventListeners(ws: WebSocket, conversationId: ConversationId) {
		//const conversationId = this.connections.get(ws);
		if (!conversationId) {
			logger.error('No conversationId found for WebSocket connection');
			throw new Error('No conversationId found for WebSocket connection');
		}

		const listeners: Array<{ event: EventName<keyof EventMap>; callback: (data: any) => void }> = [
			{
				event: 'projectEditor:conversationReady',
				callback: (data) => this.sendMessage(ws, 'conversationReady', data),
			},
			{
				event: 'projectEditor:conversationEntry',
				callback: (data) => this.sendMessage(ws, 'conversationEntry', data),
			},
			{
				event: 'projectEditor:conversationAnswer',
				callback: (data) => this.sendMessage(ws, 'conversationAnswer', data),
			},
			{
				event: 'projectEditor:conversationError',
				callback: (data) => this.sendMessage(ws, 'conversationError', data),
			},
		];

		listeners.forEach((listener) => this.eventManager.on(listener.event, listener.callback, conversationId));

		// Store listeners to remove them when the connection closes
		ws.addEventListener('close', () => {
			listeners.forEach((listener) => this.eventManager.off(listener.event, listener.callback, conversationId));
			this.removeConnection(ws, conversationId);
		});
	}

	private removeConnection(_ws: WebSocket, conversationId: ConversationId) {
		//const conversationId: ConversationId | undefined = this.connections.get(ws);
		if (conversationId) {
			this.projectEditorManager.releaseEditor(conversationId);
		}
		//this.connections.delete(ws);
	}

	// Method to send messages back to the client
	private sendMessage(ws: WebSocket, type: string, data: any) {
		//logger.debug(`Sending WebSocket message: type=${type}, data=${JSON.stringify(data)}`);
		//logger.debug('WebSocketHandler-sendMessage called');
		ws.send(JSON.stringify({ type, data }));
	}
}

export default WebSocketHandler;

// Create a single instance of EventManager and WebSocketHandler
const eventManager = EventManager.getInstance();
const wsHandler = new WebSocketHandler(eventManager);

// This is the function that gets mounted to the endpoint in apiRouter
export const websocketConversation = async (ctx: Context) => {
	logger.debug('websocketConversation called');

	try {
		const { id } = (ctx as RouterContext<'/conversation/:id', { id: string }>).params;
		const conversationId: ConversationId = id;

		if (!ctx.isUpgradable) {
			ctx.throw(400, 'Cannot upgrade to WebSocket');
		}
		const ws = ctx.upgrade();
		wsHandler.handleConnection(ws, conversationId);
		ctx.response.status = 200;
		//ctx.response.body = { status: 'CONNECTED' };
	} catch (error) {
		logger.error(`Error in websocketConversation: ${error.message}`, error);
		ctx.response.status = 500;
		ctx.response.body = { error: 'Failed to generate response', details: error.message };
	}
};
