import { Context, Router } from '@oak/oak';
import { errorHandler } from '../middlewares/error.middleware.ts';
//import { metricsHandler } from '../middlewares/metrics.middleware.ts';
import apiRouter from './apiRouter.ts';

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
