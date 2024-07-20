import { Command } from 'cliffy/command/mod.ts';
import { logger } from 'shared/logger.ts';
import { getBbaiDir } from 'shared/dataDir.ts';
import { join } from '@std/path';

export const viewLogs = new Command()
	.name('logs')
	.description('View API logs')
	.option('-n, --lines <number:number>', 'Number of lines to display (default: 20)', { default: 20 })
	.option('-f, --follow', 'Follow the log output')
	.action(async (options) => {
		const bbaiDir = await getBbaiDir();
		const logFile = join(bbaiDir, 'api.log');

		try {
			const fileInfo = await Deno.stat(logFile);
			if (!fileInfo.isFile) {
				logger.error(`Log file not found: ${logFile}`);
				return;
			}

			if (options.follow) {
				const command = new Deno.Command('tail', {
					args: ['-f', logFile],
					stdout: 'piped',
					stderr: 'piped',
				});
				const process = command.spawn();
				for await (const chunk of process.stdout) {
					await Deno.stdout.write(chunk);
				}
			} else {
				const command = new Deno.Command('tail', {
					args: ['-n', options.lines.toString(), logFile],
					stdout: 'piped',
					stderr: 'piped',
				});
				const { stdout, stderr } = await command.output();
				
				if (stderr.length > 0) {
					logger.error(new TextDecoder().decode(stderr));
				} else {
					console.log(new TextDecoder().decode(stdout));
				}
			}
		} catch (error) {
			logger.error(`Error reading log file: ${error.message}`);
		}
	});
