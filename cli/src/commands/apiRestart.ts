import { Command } from 'cliffy/command/mod.ts';
import { restartApiServer } from '../utils/apiControl.utils.ts';
import { ConfigManager, type GlobalConfigSchema } from 'shared/configManager.ts';
import { logger } from 'shared/logger.ts';

export const apiRestart = new Command()
	.name('restart')
	.description('Restart the bbai API server')
	.option('--log-level <level:string>', 'Set the log level for the API server', { default: undefined })
	.option('--log-file <file:string>', 'Specify a log file to write API output', { default: undefined })
	.option('--port <string>', 'Specify the port for API to listen on', { default: undefined })
	.action(async ({ logLevel: apiLogLevel, logFile: apiLogFile, port }) => {
		const startDir = Deno.cwd();
		const configManager = await ConfigManager.getInstance();
		const globalConfig: GlobalConfigSchema = await configManager.loadGlobalConfig(startDir);
		const apiPort = `${port || globalConfig.api?.apiPort || 3000}`; // cast as string
		try {
			logger.info('Restarting API...');
			await restartApiServer(startDir, apiPort, apiLogLevel, apiLogFile);
			logger.info('API restarted successfully.');
		} catch (error) {
			logger.error(`Error restarting bbai API server: ${error.message}`);
		}
	});
