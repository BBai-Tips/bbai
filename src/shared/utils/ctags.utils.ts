import { join } from '@std/path';
import { ensureDir, exists } from '@std/fs';
import { ConfigManager } from 'shared/configManager.ts';
import { logger } from './logger.utils.ts';
import { countTokens } from 'anthropic-tokenizer';

const TIERS = [
	{ args: ['-R', '--fields=+l', '--languages=all'] },
	{ args: ['-R', '--fields=+l', '--languages=c,cpp,javascript,typescript,python,java,go'] },
	{ args: ['-R', '--fields=+l', '--languages=c,cpp,javascript,typescript,python,java,go', '--kinds-all=-v'] },
	{ args: ['-R', '--fields=+l', '--languages=c,cpp,javascript,typescript,python,java,go', '--kinds-all=-v,-p'] },
	{ args: ['-R', '--fields=+l', '--languages=c,cpp,javascript,typescript,python,java,go', '--kinds-all=f,c,m'] },
];

async function generateCtagsTier(projectRoot: string, tagsFilePath: string, tier: number, tokenLimit: number): Promise<boolean> {
	const excludeOptions = await getExcludeOptions(projectRoot);

	const command = new Deno.Command('ctags', {
		args: [...TIERS[tier].args, '-f', tagsFilePath, ...excludeOptions, '.'],
		cwd: projectRoot,
	});

	try {
		const { code, stderr } = await command.output();
		if (code !== 0) {
			logger.error(`Failed to generate ctags: ${new TextDecoder().decode(stderr)}`);
			return false;
		}

		const content = await Deno.readTextFile(tagsFilePath);
		const tokenCount = countTokens(content);
		return tokenCount <= tokenLimit;
	} catch (error) {
		logger.error(`Error executing ctags command: ${error.message}`);
		return false;
	}
}

async function getExcludeOptions(projectRoot: string): Promise<string[]> {
	const excludeFiles = [
		join(projectRoot, 'tags.ignore'),
		join(projectRoot, '.gitignore'),
		join(projectRoot, '.bbai', 'tags.ignore'),
	];

	const excludeOptions = [];
	for (const file of excludeFiles) {
		if (await exists(file)) {
			excludeOptions.push(`--exclude=@${file}`);
		}
	}

	if (excludeOptions.length === 0) {
		excludeOptions.push('--exclude=.bbai/*');
	}

	return excludeOptions;
}

export async function generateCtags(bbaiDir: string, projectRoot: string): Promise<void> {
	const config = await ConfigManager.getInstance();
	const ctagsConfig = config.getConfig().ctags;

	if (ctagsConfig?.autoGenerate === false) {
		logger.info('Ctags auto-generation is disabled');
		return;
	}

	const tagsFilePath = ctagsConfig?.tagsFilePath ? ctagsConfig.tagsFilePath : join(bbaiDir, 'tags');
	const tokenLimit = ctagsConfig?.tokenLimit || 1024;
	logger.info(`Ctags using tags file: ${tagsFilePath}, token limit: ${tokenLimit}`);

	for (let tier = 0; tier < TIERS.length; tier++) {
		logger.info(`Attempting to generate ctags with tier ${tier}`);
		if (await generateCtagsTier(projectRoot, tagsFilePath, tier, tokenLimit)) {
			logger.info(`Ctags file generated successfully at ${tagsFilePath} using tier ${tier}`);
			return;
		}
	}

	logger.error(`Failed to generate ctags file within token limit (${tokenLimit}) after all tiers`);
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
