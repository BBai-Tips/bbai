import { Application } from '@oak/oak';
import type { ListenOptions, ListenOptionsTls } from '@oak/oak';
import oak_logger from 'oak_logger';
import { parseArgs } from '@std/cli';
import { oakCors } from 'cors';

import { ConfigManager } from 'shared/configManager.ts';
import router from './routes/routes.ts';
import { logger } from 'shared/logger.ts';
import type { BbAiState } from 'api/types.ts';
import { readFromBbaiDir, readFromGlobalConfigDir } from 'shared/dataDir.ts';
import { apiFileLogger } from './utils/fileLogger.ts';

// CWD is set by `bbai` in Deno.Command, or implicitly set by user if calling bbai-api directly
const startDir = Deno.cwd();
const fullConfig = await ConfigManager.fullConfig(startDir);
const redactedFullConfig = await ConfigManager.redactedFullConfig(startDir);
const { environment, apiHostname, apiPort, apiUseTls } = fullConfig.api;

// Parse command line arguments
const args = parseArgs(Deno.args, {
	string: ['log-file', 'port', 'hostname'],
	boolean: ['help', 'version'],
	alias: { h: 'help', V: 'version', v: 'version', p: 'port', H: 'hostname', t: 'useTls', l: 'log-file' },
});

if (args.help) {
	console.log(`
Usage: ${fullConfig.bbaiApiExeName} [options]

Options:
  -h, --help                Show this help message
  -V, --version             Show version information
  -H, --hostname <string>   Specify the hostname to run the API server (default: ${apiHostname})
  -p, --port <number>       Specify the port to run the API server (default: ${apiPort})
  -t, --useTls <boolean>    Specify whether the API server should use TLS (default: ${apiUseTls})
  -l, --log-file <file>     Specify a log file to write output
  `);
	Deno.exit(0);
}

if (args.version) {
	console.log(`BBai API version ${fullConfig.version}`);
	Deno.exit(0);
}

// Redirect console.log and console.error to the log file
const apiLogFile = args['log-file'];
if (apiLogFile) await apiFileLogger(apiLogFile);

const customHostname = args.hostname ? args.hostname : apiHostname;
const customPort: number = args.port ? parseInt(args.port, 10) : apiPort as number;
const customUseTls: boolean = typeof args.useTls !== 'undefined'
	? (args.useTls === 'true' ? true : false)
	: !!apiUseTls;
//console.debug(`BBai API starting at ${customHostname}:${customPort}`);

const app = new Application<BbAiState>();

app.use(oak_logger.logger);
if (environment === 'local') {
	app.use(oak_logger.responseTime);
}

app.use(oakCors({
	origin: [/^https?:\/\/localhost(:\d+)?$/, /^https?:\/\/((www|chat)\.)?bbai\.tips$/],
})); // Enable CORS for localhost, bbai.tips, and chat.bbai.tips
app.use(router.routes());
app.use(router.allowedMethods());

app.addEventListener('listen', ({ hostname, port, secure }: { hostname: string; port: number; secure: boolean }) => {
	logger.info(`Starting API with config:`, redactedFullConfig);
	if (fullConfig.api?.ignoreLLMRequestCache) {
		logger.warn('Cache for LLM requests is disabled!');
	}
	logger.info(`Environment: ${environment}`);
	logger.info(`Listening on: ${secure ? 'https://' : 'http://'}${hostname ?? 'localhost'}:${port}`);
});
app.addEventListener('error', (evt: ErrorEvent) => {
	logger.error(`Application error:`, evt.error);
});

if (import.meta.main) {
	let listenOpts: ListenOptions = { hostname: customHostname, port: customPort };
	if (customUseTls) {
		const cert = fullConfig.api.tlsCertPem ||
			await readFromBbaiDir(startDir, fullConfig.api.tlsCertFile || 'localhost.pem') ||
			await readFromGlobalConfigDir(fullConfig.api.tlsCertFile || 'localhost.pem') || '';
		const key = fullConfig.api.tlsKeyPem ||
			await readFromBbaiDir(startDir, fullConfig.api.tlsKeyFile || 'localhost-key.pem') ||
			await readFromGlobalConfigDir(fullConfig.api.tlsKeyFile || 'localhost-key.pem') || '';

		listenOpts = { ...listenOpts, secure: true, cert, key } as ListenOptionsTls;
	}

	try {
		await app.listen(listenOpts);
	} catch (error) {
		logger.error(`Failed to start server: ${error.message}`);
		logger.error(`Stack trace: ${error.stack}`);
		Deno.exit(1);
	}
}

export { app };
