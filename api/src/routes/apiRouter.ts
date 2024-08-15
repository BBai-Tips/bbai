import { Context, Router } from '@oak/oak';
//import { logger } from 'shared/logger.ts';
import {
	clearConversation,
	continueConversation,
	deleteConversation,
	getConversation,
	listConversations,
} from './api/conversation.handlers.ts';
import { websocketConversation } from './api/websocket.handlers.ts';

const apiRouter = new Router();

apiRouter
	.get('/v1/status', (ctx: Context) => {
		ctx.response.body = { status: 'OK', message: 'API is running' };
	})
	// Conversation endpoints
	.get('/v1/ws/conversation/:id', websocketConversation)
	//.post('/v1/conversation', startConversation)
	.get('/v1/conversation', listConversations)
	.get('/v1/conversation/:id', getConversation)
	.post('/v1/conversation/:id', continueConversation)
	.delete('/v1/conversation/:id', deleteConversation)
	//.post('/v1/conversation/:id/message', addMessage)
	//.post('/v1/conversation/:id/undo', undoConversation)
	.post('/v1/conversation/:id/clear', clearConversation);
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
