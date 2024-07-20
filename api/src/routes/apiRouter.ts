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
	});

export default apiRouter;
