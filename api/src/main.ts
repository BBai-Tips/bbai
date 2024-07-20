import { Application } from '@oak/oak';
import oak_logger from 'oak_logger';
//import { oakCors } from "cors";

import { config, configRedacted } from './config/config.ts';
import router from './routes/routes.ts';
import { logger } from 'shared/logger.ts';
import { BbAiState } from './types.ts';

logger.debug(`App Config using ${config.envPath}`, configRedacted);

const { environment, appPort } = config;

const app = new Application<BbAiState>();

/*
// Set the environment as part of the application state
// This is just an example of setting state; environment is already available via `config`
app.state.environment = environment;
 */

app.use(oak_logger.logger);
if (environment === 'localdev') {
	app.use(oak_logger.responseTime);
}

/*
if (config.useCors) {
    const corsOptions = {
        "origin": config.clientUrl,
        "methods": "GET,HEAD,PUT,PATCH,POST,DELETE",
        "preflightContinue": false,
        "optionsSuccessStatus": 200,
        "credentials": true,
    };
    app.use(oakCors(corsOptions));
}
 */

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
