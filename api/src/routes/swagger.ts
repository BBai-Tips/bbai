import swaggerJsdoc from 'swagger-jsdoc';

const swaggerDefinition = {
	openapi: '3.0.0',
	info: {
		title: 'bbai API', // Title (required)
		version: '1.0.0', // Version (required)
		description: 'An API to provide LLM and code editing services',
	},
};
const options = {
	swaggerDefinition,
	// Path to the API docs
	// Note that this path is relative to the current directory from which deno is ran, not the application itself.
	apis: ['./src/routes/routes.ts', './src/routes/*.handlers.ts'],
	failOnErrors: true,
	verbose: true,
};
// Initialize swagger-jsdoc -> returns validated swagger spec in json format
const swaggerSpec = swaggerJsdoc(options);

// swagger routes
const swaggerRouter = new Router();
swaggerRouter
	.get('/openapi.json', (ctx: Context) => {
		ctx.response.body = swaggerSpec;
	})
	.get('/swagger.json', (ctx: Context) => {
		ctx.response.body = swaggerSpec;
	});

export default swaggerRouter;
