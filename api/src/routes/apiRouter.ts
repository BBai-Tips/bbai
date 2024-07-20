import { Context, Router } from '@oak/oak';
import { LLMFactory } from '../llms/llmProvider.ts';
import { logger } from 'shared/logger.ts';

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
	.post('/v1/conversation', async (ctx: Context) => {
		// Start a new conversation
	})
	.get('/v1/conversation/:id', async (ctx: Context) => {
		// Get conversation details
	})
	.put('/v1/conversation/:id', async (ctx: Context) => {
		// Update conversation
	})
	.delete('/v1/conversation/:id', async (ctx: Context) => {
		// Delete conversation
	})
	.post('/v1/conversation/:id/message', async (ctx: Context) => {
		// Add a message to the conversation
	})
	.post('/v1/conversation/:id/clear', async (ctx: Context) => {
		// Clear conversation history
	})
	.post('/v1/conversation/:id/undo', async (ctx: Context) => {
		// Undo last change in conversation
	})
	// File management endpoints
	.post('/v1/files', async (ctx: Context) => {
		// Add file to conversation
	})
	.delete('/v1/files/:id', async (ctx: Context) => {
		// Remove file from conversation
	})
	.get('/v1/files', async (ctx: Context) => {
		// List files in conversation
	})
	// Token usage endpoint
	.get('/v1/tokens', async (ctx: Context) => {
		// Get current token usage
	})
	// CLI command endpoint
	.post('/v1/cli', async (ctx: Context) => {
		// Run arbitrary CLI command
	})
	// External content endpoint
	.post('/v1/external', async (ctx: Context) => {
		// Load content from external web site
	})
	// Logs endpoint
	.get('/v1/logs', async (ctx: Context) => {
		// Get conversation logs
	})
	// Persistence endpoints
	.post('/v1/persist', async (ctx: Context) => {
		// Persist current conversation to disk
	})
	.post('/v1/resume', async (ctx: Context) => {
		// Resume conversation from disk
	});

export default apiRouter;
