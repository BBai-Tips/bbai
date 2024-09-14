import { Command } from 'cliffy/command/mod.ts';
import { colors } from 'cliffy/ansi/colors.ts';

import { ConfigManager } from 'shared/configManager.ts';
import { followApiLogs, getApiStatus, startApiServer } from '../utils/apiControl.utils.ts';

export const apiStart = new Command()
	.name('start')
	.description('Start the bbai API server')
	.option('--log-level <level:string>', 'Set the log level for the API server', { default: undefined })
	.option('--log-file <file:string>', 'Specify a log file to write output', { default: undefined })
	.option('--hostname <string>', 'Specify the hostname for API to listen on', { default: undefined })
	.option('--port <string>', 'Specify the port for API to listen on', { default: undefined })
	.option('--follow', 'Do not detach and follow the API logs', { default: false })
	.action(async ({ logLevel: apiLogLevel, logFile: apiLogFile, hostname, port, follow }) => {
		const startDir = Deno.cwd();
		const fullConfig = await ConfigManager.fullConfig(startDir);
		const apiHostname = `${hostname || fullConfig.api?.apiHostname || 'localhost'}`;
		const apiPort = `${port || fullConfig.api?.apiPort || 3000}`; // cast as string
		const { pid, apiLogFilePath } = await startApiServer(
			startDir,
			apiHostname,
			apiPort,
			apiLogLevel,
			apiLogFile,
			follow,
		);

		const chatUrl = `https://chat.bbai.tips/#apiHostname=${
			encodeURIComponent(apiHostname)
		}&apiPort=${apiPort}&startDir=${encodeURIComponent(startDir)}`;

		// Check if the API is running
		let apiRunning = false;
		const maxAttempts = 5;
		const delayMs = 1000;

		await new Promise((resolve) => setTimeout(resolve, delayMs * 2));
		for (let attempt = 1; attempt <= maxAttempts; attempt++) {
			const status = await getApiStatus(startDir);
			if (status.running) {
				apiRunning = true;
				break;
			}
			await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
		}

		if (!apiRunning) {
			console.error(colors.bold.red('Failed to start the API server after multiple attempts.'));
			Deno.exit(1);
		}

		if (!fullConfig.noBrowser) {
			try {
				const command = Deno.build.os === 'windows'
					? new Deno.Command('cmd', { args: ['/c', 'start', chatUrl] })
					: Deno.build.os === 'darwin'
					? new Deno.Command('open', { args: [chatUrl] })
					: new Deno.Command('xdg-open', { args: [chatUrl] });
				await command.output();
			} catch (error) {
				console.error('Failed to open the browser automatically. Please open the URL manually.', error);
			}
		}

		if (follow) {
			await followApiLogs(apiLogFilePath, startDir);
		} else {
			console.log(`${colors.bold.blue.underline('BBai API started successfully!')}`);

			console.log(`\nAPI server started with PID: ${pid}`);
			console.log(`Logs are being written to: ${colors.green(apiLogFilePath)}`);
			console.log(`Chat URL: ${colors.bold.cyan(chatUrl)}`);
			console.log(`Use ${colors.bold.green('bbai stop')} to stop the server.`);
			if (!fullConfig.noBrowser) console.log('\nAttempting to open the chat in your default browser...');
			Deno.exit(0);
		}
	});
