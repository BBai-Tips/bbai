import { Command } from 'cliffy/command/mod.ts';
import { startApiServer } from '../utils/apiControl.utils.ts';

export const apiStart = new Command()
	.name('start')
	.description('Start the bbai API server')
	.option('--log-level <level:string>', 'Set the log level for the API server', { default: undefined })
	.option('--log-file <file:string>', 'Specify a log file to write output', { default: undefined })
	.action(async ({ logLevel: cliLogLevel, logFile: cliLogFile }) => {
		const startDir = Deno.cwd();
		await startApiServer(startDir, cliLogLevel, cliLogFile);
		// Do we need to call exit? Maybe it helps because we've spawned the api process??
		Deno.exit(0);
	});
