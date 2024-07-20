import { Application } from '@oak/oak';
import oak_logger from 'oak_logger';
//import { oakCors } from "cors";

import { ConfigManager } from 'shared/configManager.ts';
import router from './routes/routes.ts';
import { logger } from 'shared/logger.ts';
import { BbAiState } from './types.ts';

const configManager = await ConfigManager.getInstance();
const config = configManager.getConfig();

const { environment, appPort } = config.api;

const app = new Application<BbAiState>();

app.use(oak_logger.logger);
if (environment === 'localdev') {
	app.use(oak_logger.responseTime);
}

app.use(router.routes());
app.use(router.allowedMethods());

app.addEventListener('listen', ({ hostname, port, secure }: { hostname: string; port: number; secure: boolean }) => {
	const redactedConfig = configManager.getRedactedConfig();
	logger.info(`Starting API with config:`, redactedConfig);
	
	if (config.api?.ignoreLLMRequestCache) {
		logger.warn('Cache for LLM requests is disabled!');
	}

	logger.info(`Environment: ${environment}`);

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
