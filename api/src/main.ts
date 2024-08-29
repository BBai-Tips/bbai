import { Application } from '@oak/oak';
import oak_logger from 'oak_logger';
import { parseArgs } from '@std/cli';
//import { oakCors } from 'cors';

import { config, redactedConfig } from 'shared/configManager.ts';
import router from './routes/routes.ts';
import { logger } from 'shared/logger.ts';
import { BbAiState } from 'api/types.ts';

const { environment, apiPort } = config.api || {};

// Parse command line arguments
const args = parseArgs(Deno.args, {
	string: ['log-file', 'port'],
	boolean: ['help', 'version'],
	alias: { h: 'help', V: 'version', v: 'version', p: 'port', l: 'log-file' },
});

if (args.help) {
	console.log(`
Usage: bbai-api [options]

Options:
  -h, --help                Show this help message
  -V, --version             Show version information
  -p, --port <number>       Specify the port to run the API server (default: ${apiPort})
  -l, --log-file <file>     Specify a log file to write output
  `);
	Deno.exit(0);
}

if (args.version) {
	console.log('BBai API version 0.1.0'); // Replace with actual version
	Deno.exit(0);
}

const logFile = args['log-file'];
const customPort = args.port ? parseInt(args.port, 10) : apiPort;

if (logFile) {
	// Redirect console.log and console.error to the log file
	const consoleFunctions = ['log', 'debug', 'info', 'warn', 'error'];

	const logFileStream = await Deno.open(logFile, { write: true, create: true, append: true });
	const encoder = new TextEncoder();

	consoleFunctions.forEach((funcName) => {
		(console as any)[funcName] = (...args: any[]) => {
			const timestamp = new Date().toISOString();
			const prefix = funcName === 'log' ? '' : `[${funcName.toUpperCase()}] `;
			const message = `${timestamp} ${prefix}${
				args.map((arg) => typeof arg === 'string' ? arg : JSON.stringify(arg)).join(' ')
			}\n`;
			logFileStream.write(encoder.encode(message));
		};
	});

	// Redirect Deno.stderr to the log file
	const originalStderrWrite = Deno.stderr.write;
	Deno.stderr.write = (p: Uint8Array): Promise<number> => {
		logFileStream.write(p);
		return originalStderrWrite.call(Deno.stderr, p);
	};
}

const app = new Application<BbAiState>();

app.use(oak_logger.logger);
if (environment === 'local') {
	app.use(oak_logger.responseTime);
}

// app.use(oakCors({
// 	origin: [/^.+localhost:(300.|800.)$/, 'http://localhost:8002'],
// })); // Enable CORS for All Routes
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
		await app.listen({ port: customPort });
	} catch (error) {
		logger.error(`Failed to start server: ${error.message}`);
		logger.error(`Stack trace: ${error.stack}`);
		Deno.exit(1);
	}
}

export { app };
