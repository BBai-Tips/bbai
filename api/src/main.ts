import { Application } from '@oak/oak';
import oak_logger from 'oak_logger';
//import { oakCors } from "cors";

import { config, redactedConfig } from 'shared/configManager.ts';
import router from './routes/routes.ts';
import { logger } from 'shared/logger.ts';
import { BbAiState } from './types.ts';

const { environment, apiPort } = config.api || {};

// Get the log file path from command line arguments
const logFile = Deno.args[0];

if (logFile) {
	// Redirect console.log and console.error to the log file
	const consoleFunctions = ['log', 'debug', 'info', 'warn', 'error'];

	const logFileStream = await Deno.open(logFile, { write: true, create: true, append: true });
	const encoder = new TextEncoder();

	consoleFunctions.forEach((funcName) => {
		(console as any)[funcName] = (...args: any[]) => {
			const prefix = funcName === 'log' ? '' : `[${funcName.toUpperCase()}] `;
			const message = prefix + args.map((arg) => typeof arg === 'string' ? arg : JSON.stringify(arg)).join(' ') +
				'\n';
			logFileStream.write(encoder.encode(message));
		};
	});
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

if (import.meta.main) {
	try {
		await app.listen({ port: apiPort });
	} catch (error) {
		logger.error(`Failed to start server: ${error.message}`);
		logger.error(`Stack trace: ${error.stack}`);
		Deno.exit(1);
	}
}

export { app };
