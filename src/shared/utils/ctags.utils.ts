import { join } from '@std/path';
import { ensureDir, exists } from '@std/fs';
import { ConfigManager } from 'shared/configManager.ts';
import { logger } from './logger.utils.ts';

export async function generateCtags(bbaiDir: string, projectRoot: string): Promise<void> {
	const config = await ConfigManager.getInstance();
	const ctagsConfig = config.getConfig().ctags;

	if (ctagsConfig?.autoGenerate === false) {
		logger.info('Ctags auto-generation is disabled');
		return;
	}

	const tagsFilePath = ctagsConfig?.tagsFilePath ? ctagsConfig.tagsFilePath : join(bbaiDir, 'tags');
	logger.info('Ctags using tags file: ', tagsFilePath);

	// Check for tags.ignore or .gitignore
	let ignoreFile = join(projectRoot, 'tags.ignore');
	if (!await exists(ignoreFile)) {
		ignoreFile = join(projectRoot, '.gitignore');
	}

	// If neither file exists, create .bbai/tags.ignore
	if (!await exists(ignoreFile)) {
		ignoreFile = join(bbaiDir, 'tags.ignore');
		await ensureDir(bbaiDir);
		await Deno.writeTextFile(ignoreFile, '.bbai/*\n');
	} else {
		// Check if .bbai/* is in the ignore file, add if missing
		const ignoreContent = await Deno.readTextFile(ignoreFile);
		if (!ignoreContent.includes('.bbai/*')) {
			await Deno.writeTextFile(ignoreFile, ignoreContent + '\n.bbai/*\n');
		}
	}

	const command = new Deno.Command('ctags', {
		args: ['-R', '--fields=+l', '--languages=all', '-f', tagsFilePath, '--exclude=@' + ignoreFile, '.'],
		cwd: projectRoot,
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

export async function readCtagsFile(bbaiDir: string): Promise<string | null> {
	const config = await ConfigManager.getInstance();
	const ctagsConfig = config.getConfig().ctags;

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
