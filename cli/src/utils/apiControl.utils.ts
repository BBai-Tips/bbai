import { logger } from 'shared/logger.ts';
import { getPid, isApiRunning, removePid, savePid } from '../utils/pid.utils.ts';
import { getBbaiDir, getProjectRoot } from 'shared/dataDir.ts';
import { dirname, join } from '@std/path';
import { isCompiledBinary } from '../utils/environment.utils.ts';
import ApiClient from 'cli/apiClient.ts';
import { watchLogs } from 'shared/logViewer.ts';
import { ConfigManager } from 'shared/configManager.ts';
//import { getProjectRoot } from 'shared/dataDir.ts';

export async function startApiServer(
	startDir: string,
	apiHostname?: string,
	apiPort?: string,
	apiUseTls?: boolean,
	apiLogLevel?: string,
	apiLogFile?: string,
	follow?: boolean,
): Promise<{ pid: number; apiLogFilePath: string; listen: string }> {
	const fullConfig = await ConfigManager.fullConfig(startDir);
	if (await isApiRunning(startDir)) {
		logger.info('BBai API server is already running.');
		const pid = await getPid(startDir);
		const bbaiDir = await getBbaiDir(startDir);
		const apiLogFileName = apiLogFile || fullConfig.api?.logFile || 'api.log';
		const apiLogFilePath = join(bbaiDir, apiLogFileName);
		const apiHostname = fullConfig.api.apiHostname || 'localhost';
		const apiPort = fullConfig.api.apiPort || 3000;
		const apiUseTls = typeof fullConfig.api.apiUseTls !== 'undefined' ? fullConfig.api.apiUseTls : true;
		return { pid: pid || 0, apiLogFilePath, listen: `${apiUseTls ? 'https' : 'http'}://${apiHostname}:${apiPort}` };
	}

	const bbaiDir = await getBbaiDir(startDir);
	const projectRoot = await getProjectRoot(startDir);
	const apiLogFileName = apiLogFile || fullConfig.api?.logFile || 'api.log';
	const apiLogFilePath = join(bbaiDir, apiLogFileName);
	const logLevel = apiLogLevel || fullConfig.api?.logLevel || 'info';
	if (!apiHostname) apiHostname = `${fullConfig.api.apiHostname}`;
	if (!apiPort) apiPort = `${fullConfig.api.apiPort}`;
	if (typeof apiUseTls === 'undefined') {
		apiUseTls = typeof fullConfig.api.apiUseTls !== 'undefined' ? fullConfig.api.apiUseTls : true;
	}
	const apiHostnameArgs = apiHostname ? ['--hostname', apiHostname] : [];
	const apiPortArgs = apiPort ? ['--port', apiPort] : [];
	const apiUseTlsArgs = typeof apiUseTls !== 'undefined' ? ['--use-tls', apiUseTls ? 'true' : 'false'] : [];

	//const redactedFullConfig = await ConfigManager.redactedFullConfig(startDir);
	//logger.debug(`Starting API with config:`, redactedFullConfig);
	logger.debug(
		`Starting BBai API server from ${startDir} on ${apiHostname}:${apiPort}, logging to ${apiLogFilePath}`,
	);

	let command: Deno.Command;

	if (isCompiledBinary()) {
		const bbaiApiExecFile = await Deno.realPath(join(dirname(Deno.execPath()), fullConfig.bbaiApiExeName));
		logger.debug(`Starting BBai API as compiled binary using ${bbaiApiExecFile}`);
		command = new Deno.Command(bbaiApiExecFile, {
			args: ['--log-file', apiLogFilePath, ...apiHostnameArgs, ...apiPortArgs, ...apiUseTlsArgs],
			cwd: startDir,
			stdout: 'null',
			stderr: 'null',
			stdin: 'null',
			env: {
				...Deno.env.toObject(),
				LOG_LEVEL: logLevel,
			},
		});
	} else {
		logger.info(`Starting BBai API as script using ${projectRoot}/api/src/main.ts`);
		const cmdArgs = [
			'run',
			'--allow-read',
			'--allow-write',
			'--allow-env',
			'--allow-net',
			'--allow-run',
		];

		command = new Deno.Command(Deno.execPath(), {
			args: [
				...cmdArgs,
				join(projectRoot, 'api/src/main.ts'),
				'--log-file',
				apiLogFilePath,
				...apiHostnameArgs,
				...apiPortArgs,
			],
			cwd: join(projectRoot, 'api'),
			stdout: 'null',
			stderr: 'null',
			stdin: 'null',
			env: {
				...Deno.env.toObject(),
				LOG_LEVEL: logLevel,
			},
		});
	}

	const process = command.spawn();

	// Wait a short time to ensure the process has started
	await new Promise((resolve) => setTimeout(resolve, 500));

	const pid = process.pid;
	await savePid(startDir, pid);

	if (!follow) {
		// Unref the child process to allow the parent to exit
		process.unref();
		logger.debug(`Detached from BBai API and returning with PID ${pid}`);
	}

	return { pid, apiLogFilePath, listen: `${apiHostname}:${apiPort}` };
}

export async function stopApiServer(startDir: string): Promise<void> {
	if (!(await isApiRunning(startDir))) {
		logger.info('BBai API server is not running.');
		return;
	}

	logger.info('Stopping BBai API server...');

	const pid = await getPid(startDir);
	if (pid === null) {
		logger.error('Unable to find API server PID.');
		return;
	}

	try {
		Deno.kill(pid, 'SIGTERM');
		await removePid(startDir);
		logger.info('BBai API server stopped successfully.');
	} catch (error) {
		logger.error(`Error stopping BBai API server: ${error.message}`);
	}
}

export async function restartApiServer(
	startDir: string,
	apiHostname?: string,
	apiPort?: string,
	apiUseTls?: boolean,
	apiLogLevel?: string,
	apiLogFile?: string,
): Promise<void> {
	await stopApiServer(startDir);
	await startApiServer(startDir, apiHostname, apiPort, apiUseTls, apiLogLevel, apiLogFile);
}

export async function followApiLogs(apiLogFilePath: string, startDir: string): Promise<void> {
	try {
		// Set up SIGINT (Ctrl+C) handler
		const ac = new AbortController();
		//const signal = ac.signal;

		Deno.addSignalListener('SIGINT', async () => {
			console.log('\nReceived SIGINT. Stopping API server...');
			await stopApiServer(startDir);
			ac.abort();
			Deno.exit(0);
		});

		await watchLogs(apiLogFilePath, (content: string) => {
			console.log(content);
		});
	} catch (error) {
		if (error instanceof Deno.errors.Interrupted) {
			console.log('Log following interrupted.');
		} else {
			console.error(`Error following logs: ${error.message}`);
		}
	} finally {
		Deno.removeSignalListener('SIGINT', () => {});
	}
}

export async function getApiStatus(startDir: string): Promise<{
	running: boolean;
	pid?: number;
	apiUrl?: string;
	apiStatus?: unknown;
	error?: string;
}> {
	const fullConfig = await ConfigManager.fullConfig(startDir);
	const apiHostname = fullConfig.api.apiHostname || 'localhost';
	const apiPort = fullConfig.api.apiPort || 3000;
	const apiUseTls = typeof fullConfig.api.apiUseTls !== 'undefined' ? fullConfig.api.apiUseTls : true;
	const isRunning = await isApiRunning(startDir);
	const status: {
		running: boolean;
		pid?: number;
		apiUrl?: string;
		apiStatus?: unknown;
		error?: string;
	} = { running: isRunning };

	if (isRunning) {
		const pid = await getPid(startDir);
		status.pid = pid !== null ? pid : undefined;
		status.apiUrl = `${apiUseTls ? 'https' : 'http'}://${apiHostname}:${apiPort}`;

		try {
			const apiClient = await ApiClient.create(startDir, apiHostname, apiPort, apiUseTls);
			const response = await apiClient.get('/api/v1/status');
			if (response.ok) {
				const apiStatus = await response.json();
				status.apiStatus = apiStatus;
			} else {
				status.error = `Error fetching API status: ${response.statusText}`;
			}
		} catch (error) {
			status.error = `Error connecting to API: ${error instanceof Error ? error.message : String(error)}`;
		}
	} else {
		status.error = 'Process is not running (or has no saved PID)';
	}

	return status;
}
