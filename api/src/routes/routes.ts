import { Context, Router } from '@oak/oak';

import { errorHandler } from '../middlewares/error.middleware.ts';
//import { metricsHandler } from '../middlewares/metrics.middleware.ts';

import { LLMFactory } from '../llm/llmProvider.ts';
import { logger } from 'shared/logger.ts';

// api routes
const apiRouter = new Router();
apiRouter
	.post('/v1/generate', async (ctx) => {
		const body = await ctx.request.body({ type: 'json' }).value;
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
	});

// top-level routes
const router = new Router();
router
	/**
	 * @openapi
	 * /:
	 *   get:
	 *     summary: API root
	 *     description: Returns a welcome message for the bbai API
	 *     responses:
	 *       200:
	 *         description: Successful response with welcome message
	 */
	.get('/', (ctx: Context) => {
		ctx.response.body = 'bbai API';
	})
	.use(errorHandler) // Apply the errorHandler to all routes
	//.use(metricsHandler) // Apply the metricsHandler to all routes
	.use('/api', apiRouter.routes(), apiRouter.allowedMethods());
/**
 * @openapi
 * /metrics:
 *   get:
 *     summary: Get API metrics
 *     description: Retrieve metrics for the API
 *     responses:
 *       200:
 *         description: Successful response with API metrics
 */
// 	.get('/metrics', async (ctx) => {
// 		const metrics = await metricsService.getMetrics();
// 		ctx.response.headers.set('Content-Type', 'text/plain');
// 		ctx.response.body = metrics;
// 	})

export default router;
