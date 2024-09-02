import { Command } from 'cliffy/command/mod.ts';
import { logger } from 'shared/logger.ts';
//import { config } from 'shared/configManager.ts';
//import { getBbaiDir } from 'shared/dataDir.ts';
import { getLogFilePath, viewLastLines, watchLogs } from 'shared/logViewer.ts';
//import { join } from '@std/path';
//import { ensureDir } from '@std/fs';
import { displayFormattedLogs } from 'shared/conversationLogFormatter.ts';

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

		const logFilePath = await getLogFilePath(Deno.cwd(), !!options.api, options.id);
		console.log(`Viewing logs from: ${logFilePath}`);

		try {
			const fileInfo = await Deno.stat(logFilePath);
			if (!fileInfo.isFile) {
				console.error(JSON.stringify({ error: `Log file not found: ${logFilePath}` }));
				return;
			}

			if (options.follow) {
				if (!options.api && options.id) {
					// Use the ConversationLogFormatter for conversation logs
					await displayFormattedLogs(
						options.id,
						(formattedEntry) => {
							console.log(formattedEntry);
						},
						true,
					);
				} else {
					// Use watchLogs for API logs
					await watchLogs(logFilePath, (content: string) => {
						console.log(content);
					});
				}
			} else {
				// View last lines for both API and conversation logs
				const lastLines = await viewLastLines(logFilePath, options.lines);
				console.log(lastLines);
			}
		} catch (error) {
			console.error(JSON.stringify({ error: `Error reading log file: ${error.message}` }));
		}
	});
