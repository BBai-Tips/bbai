import { Command } from 'cliffy/command/mod.ts';
import { logger } from 'shared/logger.ts';
import { config } from 'shared/configManager.ts';
import { isApiRunning, savePid } from '../utils/pid.utils.ts';
import { getBbaiDir, getProjectRoot } from 'shared/dataDir.ts';
import { join } from '@std/path';
import { isCompiledBinary } from '../utils/environment.utils.ts';

export const apiStart = new Command()
	.name('start')
	.description('Start the bbai API server')
	.option('--log-level <level:string>', 'Set the log level for the API server', { default: undefined })
	.option('--log-file <file:string>', 'Specify a log file to write output', { default: undefined })
	.action(async ({ logLevel: cliLogLevel, logFile: cliLogFile }) => {
		const startDir = Deno.cwd();
		if (await isApiRunning(startDir)) {
			logger.info('bbai API server is already running.');
			return;
		}

		const bbaiDir = await getBbaiDir(startDir);
		const projectRoot = await getProjectRoot(startDir);
		const logFile = cliLogFile || config.logFile || 'api.log';
		const logFilePath = join(bbaiDir, logFile);
		const logLevel = cliLogLevel || config.logLevel || 'info';

		logger.info(`Starting bbai API server...`);

		let command: Deno.Command;

		if (isCompiledBinary()) {
			// If running as a compiled binary, start the API directly
			command = new Deno.Command('bbai-api', {
				args: ['--log-file', logFilePath],
				stdout: 'null',
				stderr: 'null',
				stdin: 'null',
				env: {
					...Deno.env.toObject(),
					LOG_LEVEL: logLevel,
				},
			});
		} else {
			// If running from repository, use Deno to start the API
			const cmdArgs = [
				'run',
				'--allow-read',
				'--allow-write',
				'--allow-env',
				'--allow-net',
				'--allow-run',
			];
			if (logLevel === 'debug') {
				cmdArgs.push('--watch');
			}

			command = new Deno.Command(Deno.execPath(), {
				args: [...cmdArgs, join(projectRoot, 'api/src/main.ts'), '--log-file', logFilePath],
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
		await new Promise((resolve) => setTimeout(resolve, 1000));

		const pid = process.pid;
		await savePid(startDir, pid);

		logger.info(`bbai API server started with PID: ${pid}`);
		logger.info(`Logs at level ${logLevel} are being written to: ${logFilePath}`);
		logger.info("Use 'bbai stop' to stop the server.");

		// Unref the child process to allow the parent to exit
		process.unref();
		Deno.exit(0);
	});
