import { Command } from 'cliffy/command/mod.ts';
//import { apiStop } from './apiStop.ts';
//import { apiStart } from './apiStart.ts';
import { logger } from 'shared/logger.ts';

export const apiRestart = new Command()
	.name('restart')
	.description('Restart the bbai API server')
	.option('--log-level <level:string>', 'Set the log level for the API server', { default: undefined })
	.option('--log-file <file:string>', 'Specify a log file to write output', { default: undefined })
	.action(async ({ logLevel: cliLogLevel, logFile: cliLogFile }) => {
		//const startDir = Deno.cwd();
		try {
			logger.info('Not implemented...');
			//logger.info('Restarting API...');
			//await apiStop.action();
			//await apiStart.action();
			//logger.info('API restarted successfully.');
		} catch (error) {
			logger.error(`Error restarting bbai API server: ${error.message}`);
		}
	});
