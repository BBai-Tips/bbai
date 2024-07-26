import { join, relative } from '@std/path';
import { ensureDir, exists, walk } from '@std/fs';
import { ConfigManager } from 'shared/configManager.ts';
import { logger } from './logger.utils.ts';
import { countTokens } from 'anthropic-tokenizer';
import { contentType } from '@std/media-types';

const TIERS = [
	{ args: ['-R', '--fields=+l', '--languages=all'] },
	{ args: ['-R', '--fields=+l', '--languages=c,c++,javascript,typescript,python,java,go'] },
	{
		args: [
			'-R',
			'--fields=+l',
			'--languages=c,c++,javascript,typescript,python,java,go',
			'--kinds-c-=-v',
			'--kinds-c++=-v',
			'--kinds-javascript=-v',
			'--kinds-typescript=-v',
			'--kinds-python=-v',
			'--kinds-java=-v',
			'--kinds-go=-v',
		],
	},
	{
		args: [
			'-R',
			'--fields=+l',
			'--languages=c,c++,javascript,typescript,python,java,go',
			'--kinds-c-=-v,-p',
			'--kinds-c++=-v,-p',
			'--kinds-javascript=-v,-p',
			'--kinds-typescript=-v,-p',
			'--kinds-python=-v,-p',
			'--kinds-java=-v,-p',
			'--kinds-go=-v,-p',
		],
	},
	{
		args: [
			'-R',
			'--fields=+l',
			'--languages=c,c++,javascript,typescript,python,java,go',
			'--kinds-c-=f,c,m',
			'--kinds-c++=f,c,m',
			'--kinds-javascript=f,c,m',
			'--kinds-typescript=f,c,m',
			'--kinds-python=f,c,m',
			'--kinds-java=f,c,m',
			'--kinds-go=f,c,m',
		],
	},
];

const FILE_LISTING_TIERS = [
	{ depth: Infinity, includeMetadata: true },
	{ depth: Infinity, includeMetadata: false },
	{ depth: 5, includeMetadata: false },
	{ depth: 3, includeMetadata: false },
	{ depth: 2, includeMetadata: false },
	{ depth: 1, includeMetadata: false },
];

async function generateCtagsTier(
	projectRoot: string,
	ctagsFilePath: string,
	tier: number,
	tokenLimit: number,
): Promise<boolean> {
	const excludeOptions = await getExcludeOptions(projectRoot);

	const command = new Deno.Command('ctags', {
		args: [...TIERS[tier].args, '-f', ctagsFilePath, ...excludeOptions, '.'],
		cwd: projectRoot,
	});

	try {
		const { code, stderr } = await command.output();
		if (code !== 0) {
			logger.error(`Failed to generate ctags: ${new TextDecoder().decode(stderr)}`);
			return false;
		}

		const content = await Deno.readTextFile(ctagsFilePath);
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

export async function generateCtags(bbaiDir: string, projectRoot: string): Promise<string | null> {
	const config = await ConfigManager.getInstance();
	const repoInfoConfig = config.getConfig().repoInfo;

	if (repoInfoConfig?.ctagsAutoGenerate === false) {
		logger.info('Ctags auto-generation is disabled');
		return null;
	}

	const ctagsFilePath = repoInfoConfig?.ctagsFilePath ? repoInfoConfig.ctagsFilePath : join(bbaiDir, 'tags');
	const tokenLimit = repoInfoConfig?.tokenLimit || 1024;
	logger.info(`Ctags using tags file: ${ctagsFilePath}, token limit: ${tokenLimit}`);

	for (let tier = 0; tier < TIERS.length; tier++) {
		logger.info(`Attempting to generate ctags with tier ${tier}`);
		if (await generateCtagsTier(projectRoot, ctagsFilePath, tier, tokenLimit)) {
			logger.info(`Ctags file generated successfully at ${ctagsFilePath} using tier ${tier}`);
			return await Deno.readTextFile(ctagsFilePath);
		}
	}

	logger.warn(`Failed to generate ctags file within token limit (${tokenLimit}) after all tiers.`);
	return null;
}

export async function readCtagsFile(bbaiDir: string): Promise<string | null> {
	const config = await ConfigManager.getInstance();
	const repoInfoConfig = config.getConfig().repoInfo;

	const ctagsFilePath = repoInfoConfig?.ctagsFilePath ? join(bbaiDir, repoInfoConfig.ctagsFilePath) : join(bbaiDir, 'tags');

	if (await exists(ctagsFilePath)) {
		try {
			return await Deno.readTextFile(ctagsFilePath);
		} catch (error) {
			logger.error(`Error reading ctags file: ${error.message}`);
		}
	}

	return null;
}
