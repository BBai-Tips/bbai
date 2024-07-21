import { Command } from 'cliffy/command/mod.ts';
import { logger } from 'shared/logger.ts';
import { config } from 'shared/configManager.ts';
import { isApiRunning, savePid } from '../utils/pid.utils.ts';
import { getBbaiDir } from 'shared/dataDir.ts';
import { join } from '@std/path';

export const apiStart = new Command()
	.name('start')
	.description('Start the bbai API server')
	.option('--log-level <level:string>', 'Set the log level for the API server', { default: undefined })
	.action(async ({ logLevel: cliLogLevel }) => {
		if (await isApiRunning()) {
			logger.info('bbai API server is already running.');
			return;
		}

		const bbaiDir = await getBbaiDir();
		const logFile = join(bbaiDir, 'api.log');
		const logLevel = cliLogLevel ?? config.logLevel ?? 'info';

		logger.info(`Starting bbai API server, logging at level ${logLevel} to ${logFile}`);

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
		//`--log-level=${logLevel}`,

		const command = new Deno.Command(Deno.execPath(), {
			args: [...cmdArgs, '../api/src/main.ts', logFile],
			cwd: '../api',
			stdout: 'null',
			stderr: 'null',
			stdin: 'null',
			detached: true,
			env: {
				...Deno.env.toObject(),
				//LOG_LEVEL: logLevel,
			},
		});

		const process = command.spawn();

		// Wait a short time to ensure the process has started
		await new Promise((resolve) => setTimeout(resolve, 1000));

		const pid = process.pid;
		await savePid(pid);

		logger.info(`bbai API server started with PID: ${pid}`);
		logger.info(`Logs are being written to: ${logFile}`);
		logger.info("Use 'bbai stop' to stop the server.");

		// Unref the child process to allow the parent to exit
		process.unref();
		Deno.exit(0);
	});
