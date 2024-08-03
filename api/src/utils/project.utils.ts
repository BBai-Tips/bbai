import { logger } from 'shared/logger.ts';

export async function runFormatCommand(projectRoot: string, formatCommand: string): Promise<void> {
	try {
		const process = Deno.run({
			cmd: formatCommand.split(' '),
			cwd: projectRoot,
		});
		const status = await process.status();
		if (!status.success) {
			throw new Error(`Format command exited with status ${status.code}`);
		}
	} catch (error) {
		logger.error(`Failed to run format command: ${error.message}`);
	}
}
