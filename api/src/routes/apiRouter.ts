import { Context, Router } from '@oak/oak';
import { LLMFactory } from '../llms/llmProvider.ts';
import { logger } from 'shared/logger.ts';
import {
    startConversation,
    getConversation,
    updateConversation,
    deleteConversation,
    addMessage,
    clearConversation,
    undoConversation
} from './api/conversation.handlers.ts';
import { addFile, removeFile, listFiles } from './api/file.handlers.ts';
import { getTokenUsage } from './api/token.handlers.ts';
import { runCliCommand } from './api/cli.handlers.ts';
import { loadExternalContent } from './api/external.handlers.ts';
import { getLogs } from './api/log.handlers.ts';
import { persistConversation, resumeConversation } from './api/persistence.handlers.ts';

const apiRouter = new Router();
apiRouter
    .post('/v1/generate', async (ctx: Context) => {
        const body = await ctx.request.body.json();
        const { prompt, provider, model, system } = body;

        if (!prompt || !provider) {
            ctx.response.status = 400;
            ctx.response.body = { error: 'Missing prompt or provider' };
            return;
        }

        try {
            const llmProvider = LLMFactory.getProvider(provider);
            const response = await llmProvider.speakWith({
                messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
                system: system || '',
                prompt: prompt,
                model: model || '',
            });
            ctx.response.body = response;
        } catch (error) {
            logger.error(`Error generating response: ${error.message}`);
            ctx.response.status = 500;
            ctx.response.body = { error: 'Failed to generate response' };
        }
    })
    .get('/v1/status', (ctx: Context) => {
        ctx.response.body = { status: 'OK', message: 'API is running' };
    })
    // Conversation endpoints
    .post('/v1/conversation', startConversation)
    .get('/v1/conversation/:id', getConversation)
    .put('/v1/conversation/:id', updateConversation)
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
