import { Application } from '@oak/oak';
import oak_logger from 'oak_logger';
//import { oakCors } from "cors";

import { config, redactedConfig } from 'shared/configManager.ts';
import router from './routes/routes.ts';
import { logger } from 'shared/logger.ts';
import { BbAiState } from './types.ts';

const { environment, apiPort } = config.api || {};

// Add more detailed logging for configuration
logger.info(`API Configuration:`, JSON.stringify(config.api, null, 2));
logger.info(`API Port: ${apiPort}`);

// Get the log file path from command line arguments
const logFile = Deno.args[0];

if (logFile) {
	// Redirect console.log and console.error to the log file
	const logFileStream = await Deno.open(logFile, { write: true, create: true, append: true });
	const encoder = new TextEncoder();

	console.log = (...args) => {
		const message = args.map((arg) => typeof arg === 'string' ? arg : JSON.stringify(arg)).join(' ') + '\n';
		logFileStream.write(encoder.encode(message));
	};

	console.debug = (...args) => {
		const message = '[DEBUG] ' + args.map((arg) => typeof arg === 'string' ? arg : JSON.stringify(arg)).join(' ') +
			'\n';
		logFileStream.write(encoder.encode(message));
	};
	console.info = (...args) => {
		const message = '[INFO] ' + args.map((arg) => typeof arg === 'string' ? arg : JSON.stringify(arg)).join(' ') +
			'\n';
		logFileStream.write(encoder.encode(message));
	};
	console.warn = (...args) => {
		const message = '[WARN] ' + args.map((arg) => typeof arg === 'string' ? arg : JSON.stringify(arg)).join(' ') +
			'\n';
		logFileStream.write(encoder.encode(message));
	};
	console.error = (...args) => {
		const message = '[ERROR] ' + args.map((arg) => typeof arg === 'string' ? arg : JSON.stringify(arg)).join(' ') +
			'\n';
		logFileStream.write(encoder.encode(message));
	};
}

const app = new Application<BbAiState>();

app.use(oak_logger.logger);
if (environment === 'local') {
	app.use(oak_logger.responseTime);
}

app.use(router.routes());
app.use(router.allowedMethods());

app.addEventListener('listen', ({ hostname, port, secure }: { hostname: string; port: number; secure: boolean }) => {
	logger.info(`Starting API with config:`, redactedConfig);
	if (config.api?.ignoreLLMRequestCache) {
		logger.warn('Cache for LLM requests is disabled!');
	}
	logger.info(`Environment: ${environment}`);
	logger.info(`Listening on: ${secure ? 'https://' : 'http://'}${hostname ?? 'localhost'}:${port}`);
});
app.addEventListener('error', (evt: ErrorEvent) => {
	logger.error(`Application error:`, evt.error);
});

// Add a basic health check endpoint
app.use(async (context, next) => {
	if (context.request.url.pathname === "/health") {
		context.response.body = "OK";
	} else {
		await next();
	}
});

// Log all incoming requests
app.use(async (context, next) => {
	const start = Date.now();
	await next();
	const ms = Date.now() - start;
	logger.info(`${context.request.method} ${context.request.url.pathname} - ${ms}ms`);
});

if (import.meta.main) {
	try {
		logger.info(`Attempting to start server on port: ${apiPort}`);
		await app.listen({ port: apiPort });
		logger.info(`Server successfully started. Listening on port: ${apiPort}`);
	} catch (error) {
		logger.error(`Failed to start server: ${error.message}`);
		logger.error(`Stack trace: ${error.stack}`);
		Deno.exit(1);
	}
}

export { app };
