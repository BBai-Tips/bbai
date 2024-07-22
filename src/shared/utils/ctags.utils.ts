import { join } from '@std/path';
import { exists } from '@std/fs';
import { ConfigManager } from 'shared/configManager.ts';
import { getBbaiDir } from './dataDir.utils.ts';
import { logger } from './logger.utils.ts';

export async function generateCtags(): Promise<void> {
	const config = await ConfigManager.getInstance();
	const ctagsConfig = config.getConfig().ctags;

	if (ctagsConfig?.autoGenerate === false) {
		logger.info('Ctags auto-generation is disabled');
		return;
	}

	const bbaiDir = await getBbaiDir();
	const tagsFilePath = ctagsConfig?.tagsFilePath ? ctagsConfig.tagsFilePath : join(bbaiDir, 'tags');
	logger.info('Ctags using tags file: ', tagsFilePath);

	const command = new Deno.Command('ctags', {
		args: ['-R', '--fields=+l', '--languages=all', '-f', tagsFilePath, '.'],
	});

	try {
		const { code, stdout, stderr } = await command.output();
		if (code === 0) {
			logger.info(`Ctags file generated successfully at ${tagsFilePath}`);
		} else {
			logger.error(`Failed to generate ctags: ${new TextDecoder().decode(stderr)}`);
		}
	} catch (error) {
		logger.error(`Error executing ctags command: ${error.message}`);
	}
}

export async function readCtagsFile(): Promise<string | null> {
	const config = await ConfigManager.getInstance();
	const ctagsConfig = config.getConfig().ctags;

	const bbaiDir = await getBbaiDir();
	const tagsFilePath = ctagsConfig?.tagsFilePath ? join(bbaiDir, ctagsConfig.tagsFilePath) : join(bbaiDir, 'tags');

	if (await exists(tagsFilePath)) {
		try {
			const content = await Deno.readTextFile(tagsFilePath);
			return content;
		} catch (error) {
			logger.error(`Error reading ctags file: ${error.message}`);
		}
	} else {
		logger.warn(`Ctags file not found at ${tagsFilePath}`);
	}

	return null;
}
