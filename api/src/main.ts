import { Application } from '@oak/oak';
import oak_logger from 'oak_logger';
//import { oakCors } from "cors";

import { ConfigManager } from 'shared/config/configManager.ts';
import router from './routes/routes.ts';
import { logger } from 'shared/logger.ts';
import { BbAiState } from './types.ts';

const configManager = await ConfigManager.getInstance();
const config = configManager.getConfig().api;

// Redact sensitive information before logging
const redactedConfig = JSON.parse(JSON.stringify(config));
if (redactedConfig.api.anthropicApiKey) redactedConfig.api.anthropicApiKey = '[REDACTED]';
if (redactedConfig.api.openaiApiKey) redactedConfig.api.openaiApiKey = '[REDACTED]';
logger.info(`Starting API with config:`, redactedConfig);

const { environment, appPort } = config;

const app = new Application<BbAiState>();

app.use(oak_logger.logger);
if (environment === 'localdev') {
	app.use(oak_logger.responseTime);
}

app.use(router.routes());
app.use(router.allowedMethods());

app.addEventListener('listen', ({ hostname, port, secure }: { hostname: string; port: number; secure: boolean }) => {
	if (config.ignoreLLMRequestCache) {
		logger.warn('Cache for LLM requests is disabled!');
	}

	logger.info(
		`Listening on: ${secure ? 'https://' : 'http://'}${
			hostname ?? 'localhost'
		}:${port} for environment ${environment}`,
	);
});
app.addEventListener('error', (evt: ErrorEvent) => {
	// Will log the thrown error to the console.
	logger.info(evt.error);
});

if (import.meta.main) {
	await app.listen({ port: appPort });
}

export { app };
