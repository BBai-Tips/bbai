import { Application } from '@oak/oak';
import oak_logger from 'oak_logger';
//import { oakCors } from "cors";

import { config, redactedConfig } from 'shared/configManager.ts';
import router from './routes/routes.ts';
import { logger } from 'shared/logger.ts';
import { BbAiState } from './types.ts';


const { environment, appPort } = config.api;

// Get the log file path from command line arguments
const logFile = Deno.args[0];

if (logFile) {
  // Redirect console.log and console.error to the log file
  const logFileStream = await Deno.open(logFile, { write: true, create: true, append: true });
  const encoder = new TextEncoder();

  console.log = (...args) => {
    const message = args.map(arg => typeof arg === 'string' ? arg : JSON.stringify(arg)).join(' ') + '\n';
    logFileStream.write(encoder.encode(message));
  };

  console.info = (...args) => {
    const message = '[INFO] ' + args.map(arg => typeof arg === 'string' ? arg : JSON.stringify(arg)).join(' ') + '\n';
    logFileStream.write(encoder.encode(message));
  };
  console.error = (...args) => {
    const message = '[ERROR] ' + args.map(arg => typeof arg === 'string' ? arg : JSON.stringify(arg)).join(' ') + '\n';
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
