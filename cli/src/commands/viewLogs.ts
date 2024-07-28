import { Command } from 'cliffy/command/mod.ts';
import { logger } from 'shared/logger.ts';
import { config } from 'shared/configManager.ts';
import { getBbaiDir } from 'shared/dataDir.ts';
import { join } from '@std/path';
//import { ensureDir } from '@std/fs';

export const viewLogs = new Command()
	.name('logs')
	.description('View API logs')
	.option('-n, --lines <number:number>', 'Number of lines to display (default: 20)', { default: 20 })
	.option('-f, --follow', 'Follow the log output')
	.option('--api', 'Show logs for the API server')
	.option('-i, --id <string>', 'Conversation ID to continue')
	.action(async (options) => {
		if (!options.api && !options.id) {
			logger.error('Must provide conversation id for chat logs.');
			return;
		}

		const bbaiDir = await getBbaiDir(Deno.cwd());
		const logFile = !options.api && options.id
			? join('cache', 'conversations', options.id, 'conversation.log')
			: config.logFile ?? 'api.log';
		const logFilePath = join(bbaiDir, logFile);

		try {
			const fileInfo = await Deno.stat(logFilePath);
			if (!fileInfo.isFile) {
				console.error(JSON.stringify({ error: `Log file not found: ${logFilePath}` }));
				return;
			}

			if (options.follow) {
				const command = new Deno.Command('tail', {
					args: ['-f', logFilePath],
					stdout: 'piped',
					stderr: 'piped',
				});
				const process = command.spawn();
				for await (const chunk of process.stdout) {
					await Deno.stdout.write(chunk);
				}
			} else {
				const command = new Deno.Command('tail', {
					args: ['-n', options.lines.toString(), logFilePath],
					stdout: 'piped',
					stderr: 'piped',
				});
				const { stdout, stderr } = await command.output();

				if (stderr.length > 0) {
					console.error(JSON.stringify({ error: new TextDecoder().decode(stderr) }));
				} else {
					console.log(new TextDecoder().decode(stdout));
				}
			}
		} catch (error) {
			console.error(JSON.stringify({ error: `Error reading log file: ${error.message}` }));
		}
	});
