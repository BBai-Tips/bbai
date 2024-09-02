import { Command } from 'cliffy/command/mod.ts';
import { restartApiServer } from '../utils/apiControl.utils.ts';
import { logger } from 'shared/logger.ts';

export const apiRestart = new Command()
	.name('restart')
	.description('Restart the bbai API server')
	.option('--log-level <level:string>', 'Set the log level for the API server', { default: undefined })
	.option('--log-file <file:string>', 'Specify a log file to write API output', { default: undefined })
	.action(async ({ logLevel: apiLogLevel, logFile: apiLogFile }) => {
		const startDir = Deno.cwd();
		try {
			logger.info('Restarting API...');
			await restartApiServer(startDir, apiLogLevel, apiLogFile);
			logger.info('API restarted successfully.');
		} catch (error) {
			logger.error(`Error restarting bbai API server: ${error.message}`);
		}
	});
