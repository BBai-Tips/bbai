import { Command } from 'cliffy/command/mod.ts';
import { logger } from 'shared/logger.ts';
import { getPid, isApiRunning, removePid } from '../utils/pid.utils.ts';

export const apiStop = new Command()
	.name('stop')
	.description('Stop the bbai API server')
	.action(async () => {
		if (!(await isApiRunning())) {
			logger.info('bbai API server is not running.');
			return;
		}

		logger.info('Stopping bbai API server...');

			const cwd = Deno.cwd();
		const pid = await getPid(cwd);
		if (pid === null) {
			logger.error('Unable to find API server PID.');
			return;
		}

		try {
			Deno.kill(pid, 'SIGTERM');
			await removePid();
			logger.info('bbai API server stopped successfully.');
		} catch (error) {
			logger.error(`Error stopping bbai API server: ${error.message}`);
		}
	});
