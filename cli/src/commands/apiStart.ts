import { Command } from 'cliffy/command/mod.ts';
import { followApiLogs, startApiServer } from '../utils/apiControl.utils.ts';

export const apiStart = new Command()
	.name('start')
	.description('Start the bbai API server')
	.option('--log-level <level:string>', 'Set the log level for the API server', { default: undefined })
	.option('--log-file <file:string>', 'Specify a log file to write output', { default: undefined })
	.option('--follow', 'Do not detach and follow the API logs', { default: false })
	.action(async ({ logLevel: cliLogLevel, logFile: cliLogFile, follow }) => {
		const startDir = Deno.cwd();
		const { pid, logFilePath } = await startApiServer(startDir, cliLogLevel, cliLogFile, follow);

		if (follow) {
			await followApiLogs(logFilePath, startDir);
		} else {
			console.log(`API server started with PID: ${pid}`);
			console.log(`Logs are being written to: ${logFilePath}`);
			console.log("Use 'bbai api stop' to stop the server.");
			Deno.exit(0);
		}
	});
