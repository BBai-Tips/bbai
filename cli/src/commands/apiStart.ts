import { Command } from 'cliffy/command/mod.ts';

import { config } from '../../../src/shared/config/configManager.ts';
import { followApiLogs, startApiServer } from '../utils/apiControl.utils.ts';

export const apiStart = new Command()
	.name('start')
	.description('Start the bbai API server')
	.option('--log-level <level:string>', 'Set the log level for the API server', { default: undefined })
	.option('--log-file <file:string>', 'Specify a log file to write output', { default: undefined })
	.option('--follow', 'Do not detach and follow the API logs', { default: false })
	.action(async ({ logLevel: apiLogLevel, logFile: apiLogFile, follow }) => {
		const startDir = Deno.cwd();
		const { pid, apiLogFilePath } = await startApiServer(startDir, apiLogLevel, apiLogFile, follow);

		const apiPort = config.api?.apiPort || 3000;

		const chatUrl = `https://chat.bbai.tips/#apiPort=${apiPort}`;
		console.log(`\n\x1b[1m\x1b[32mBBai API server started successfully!\x1b[0m`);
		console.log(`\x1b[1m\x1b[36mPlease visit: ${chatUrl}\x1b[0m`);
		console.log('Attempting to open the chat in your default browser...');

		try {
			await open(chatUrl);
		} catch (error) {
			console.error('Failed to open the browser automatically. Please open the URL manually.', error);
		}

		if (follow) {
			await followApiLogs(apiLogFilePath, startDir);
		} else {
			console.log(`API server started with PID: ${pid}`);
			console.log(`Logs are being written to: ${apiLogFilePath}`);
			console.log("Use 'bbai api stop' to stop the server.");
			Deno.exit(0);
		}
	});
