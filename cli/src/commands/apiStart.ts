import { Command } from 'cliffy/command/mod.ts';
import { colors } from 'cliffy/ansi/colors.ts';

import { ConfigManager, type GlobalConfigSchema } from 'shared/configManager.ts';
import { followApiLogs, startApiServer } from '../utils/apiControl.utils.ts';

export const apiStart = new Command()
	.name('start')
	.description('Start the bbai API server')
	.option('--log-level <level:string>', 'Set the log level for the API server', { default: undefined })
	.option('--log-file <file:string>', 'Specify a log file to write output', { default: undefined })
	.option('--port <string>', 'Specify the port for API to listen on', { default: undefined })
	.option('--follow', 'Do not detach and follow the API logs', { default: false })
	.action(async ({ logLevel: apiLogLevel, logFile: apiLogFile, port, follow }) => {
		const startDir = Deno.cwd();
		const configManager = await ConfigManager.getInstance();
		const globalConfig: GlobalConfigSchema = await configManager.loadGlobalConfig(startDir);
		const apiPort = `${port || globalConfig.api?.apiPort || 3000}`; // cast as string
		const { pid, apiLogFilePath } = await startApiServer(startDir, apiPort, apiLogLevel, apiLogFile, follow);

		const chatUrl = `https://chat.bbai.tips/#apiPort=${apiPort}`;

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

		if (follow) {
			await followApiLogs(apiLogFilePath, startDir);
		} else {
			console.log(`${colors.bold.blue.underline('BBai API started successfully!')}`);

			console.log(`\nAPI server started with PID: ${pid}`);
			console.log(`Logs are being written to: ${colors.green(apiLogFilePath)}`);
			console.log(`Please visit: ${colors.bold.cyan(chatUrl)}`);
			console.log('Attempting to open the chat in your default browser...');
			console.log(`Use ${colors.bold.green('bbai stop')} to stop the server.`);
			Deno.exit(0);
		}
	});
