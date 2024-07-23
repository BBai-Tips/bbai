import { Command } from 'cliffy/command/mod.ts';
import { getPid, isApiRunning } from '../utils/pid.utils.ts';
import { config } from 'shared/configManager.ts';

export const apiStatus = new Command()
	.name('status')
	.description('Check the status of the bbai API server')
	.option('--text', 'Return plain text instead of JSON')
	.action(async (options) => {
		const apiPort = config.api?.apiPort || 3000;
		const cwd = Deno.cwd();
		const isRunning = await isApiRunning(cwd);
		const status: {
			running: boolean;
			pid?: number;
			apiUrl?: string;
			apiStatus?: unknown;
			error?: string;
		} = { running: isRunning };

		if (isRunning) {
			const pid = await getPid(cwd);
			status.pid = pid;
			status.apiUrl = `http://localhost:${apiPort}`;

			try {
				const response = await fetch(`http://localhost:${apiPort}/api/v1/status`);
				if (response.ok) {
					const apiStatus = await response.json();
					status.apiStatus = apiStatus;
				} else {
					status.error = `Error fetching API status: ${response.statusText}`;
				}
			} catch (error) {
				status.error = `Error connecting to API: ${error instanceof Error ? error.message : String(error)}`;
			}
		}

		if (options.text) {
			console.log(JSON.stringify(status, null, 2));
		} else {
			console.log(JSON.stringify(status));
		}
	});
