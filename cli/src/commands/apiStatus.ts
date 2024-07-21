import { Command } from 'cliffy/command/mod.ts';
import { logger } from 'shared/logger.ts';
import { getPid, isApiRunning } from '../utils/pid.utils.ts';
import { config } from 'shared/configManager.ts';

export const apiStatus = new Command()
	.name('status')
	.description('Check the status of the bbai API server')
	.action(async () => {
		const apiPort = config.api?.apiPort || 3000;

		if (await isApiRunning()) {
			const pid = await getPid();
			logger.info(`bbai API server is running with PID: ${pid}`);

			try {
				const response = await fetch(`http://localhost:${apiPort}/api/v1/status`);
				if (response.ok) {
					const status = await response.json();
					logger.info('API Status:');
					logger.info(`  Status: ${status.status}`);
					logger.info(`  Message: ${status.message}`);
					logger.info(`  API URL: http://localhost:${apiPort}`);
				} else {
					logger.error(`Error fetching API status: ${response.statusText}`);
				}
			} catch (error) {
				logger.error(`Error connecting to API: ${error.message}`);
			}
		} else {
			logger.info('bbai API server is not running.');
		}
	});
