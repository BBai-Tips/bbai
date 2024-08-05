import { Context, Router } from '@oak/oak';
//import { logger } from 'shared/logger.ts';
import {
	clearConversation,
	continueConversation,
	deleteConversation,
	getConversation,
	startConversation,
	undoConversation,
} from './api/conversation.handlers.ts';
import { websocketConversation } from './api/websocket.handlers.ts';
// import WebSocketHandler from './api/websocket.handlers.ts';
// import EventManager from 'shared/eventManager.ts';

const apiRouter = new Router();
/*
const connectedClients = new Set<WebSocket>();

const startConversationWithWebSocket = async (ctx: Context) => {
	const result = await startConversation(ctx);
	await broadcastConversationUpdate(result);
	return result;
};
const continueConversationWithWebSocket = async (ctx: Context) => {
	const result = await continueConversation(ctx);
	await broadcastConversationUpdate(result);
	return result;
};
async function broadcastConversationUpdate(update: any) {
	for (const client of connectedClients) {
		await client.send(JSON.stringify(update));
	}
}

function handleWebSocketConnection(ws: WebSocket) {
	connectedClients.add(ws);

	ws.onclose = () => {
		connectedClients.delete(ws);
	};

	ws.onmessage = (msg) => {
		//try {
		await speakWithEmitter.postAndWait({ ...data, createdBy });
		ws.send({ isSuccessful: true });
		//} catch {
		//  ctx.throw(400);
		//}
	};

	for await (const speakWithResponse of speakWithEmitter) {
		//if (speakWithResponse.conversationId === conversationId) {
		ws.send(JSON.stringify(speakWithResponse));
		//}
	}
}
 */

apiRouter
	.get('/v1/status', (ctx: Context) => {
		ctx.response.body = { status: 'OK', message: 'API is running' };
	})
	// Conversation endpoints
	.get('/v1/ws/conversation/:id', websocketConversation)
	.post('/v1/conversation', startConversation)
	.get('/v1/conversation/:id', getConversation)
	.post('/v1/conversation/:id', continueConversation)
	.delete('/v1/conversation/:id', deleteConversation)
	//.post('/v1/conversation/:id/message', addMessage)
	.post('/v1/conversation/:id/clear', clearConversation)
	.post('/v1/conversation/:id/undo', undoConversation);
/*
	// NOT IMPLEMENTED
	// File management endpoints
	.post('/v1/files', addFile)
	.delete('/v1/files/:id', removeFile)
	.get('/v1/files', listFiles)
	// Token usage endpoint
	.get('/v1/tokens', getTokenUsage)
	// CLI command endpoint
	.post('/v1/cli', runCliCommand)
	// External content endpoint
	.post('/v1/external', loadExternalContent)
	// Logs endpoint
	.get('/v1/logs', getLogs)
	// Persistence endpoints
	.post('/v1/persist', persistConversation)
	.post('/v1/resume', resumeConversation)
 */

export default apiRouter;
