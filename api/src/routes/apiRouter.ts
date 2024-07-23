import { Context, Router } from '@oak/oak';
import { LLMFactory } from '../llms/llmProvider.ts';
import { logger } from 'shared/logger.ts';
import {
	addMessage,
	clearConversation,
	continueConversation,
	deleteConversation,
	getConversation,
	startConversation,
	undoConversation,
} from './api/conversation.handlers.ts';
import { addFile, listFiles, removeFile } from './api/file.handlers.ts';
import { getTokenUsage } from './api/token.handlers.ts';
import { runCliCommand } from './api/cli.handlers.ts';
import { loadExternalContent } from './api/external.handlers.ts';
import { getLogs } from './api/log.handlers.ts';
import { persistConversation, resumeConversation } from './api/persistence.handlers.ts';

const apiRouter = new Router();
apiRouter
	.get('/v1/status', (ctx: Context) => {
		ctx.response.body = { status: 'OK', message: 'API is running' };
	})
	// Conversation endpoints
	.post('/v1/conversation', startConversation)
	.get('/v1/conversation/:id', getConversation)
	.post('/v1/conversation/:id', continueConversation)
	.delete('/v1/conversation/:id', deleteConversation)
	.post('/v1/conversation/:id/message', addMessage)
	.post('/v1/conversation/:id/clear', clearConversation)
	.post('/v1/conversation/:id/undo', undoConversation)
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
	.post('/v1/resume', resumeConversation);

export default apiRouter;
