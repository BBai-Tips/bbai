import { join, relative } from '@std/path';
import { ensureDir, exists, walk } from '@std/fs';
import { ConfigManager } from 'shared/configManager.ts';
import { logger } from './logger.utils.ts';
import { countTokens } from 'anthropic-tokenizer';
import { getMimeType } from 'mime';

const TIERS = [
	{ args: ['-R', '--fields=+l', '--languages=all'] },
	{ args: ['-R', '--fields=+l', '--languages=c,cpp,javascript,typescript,python,java,go'] },
	{ args: ['-R', '--fields=+l', '--languages=c,cpp,javascript,typescript,python,java,go', '--kinds-all=-v'] },
	{ args: ['-R', '--fields=+l', '--languages=c,cpp,javascript,typescript,python,java,go', '--kinds-all=-v,-p'] },
	{ args: ['-R', '--fields=+l', '--languages=c,cpp,javascript,typescript,python,java,go', '--kinds-all=f,c,m'] },
];

const FILE_LISTING_TIERS = [
	{ depth: Infinity, includeMetadata: true },
	{ depth: Infinity, includeMetadata: false },
	{ depth: 5, includeMetadata: false },
	{ depth: 3, includeMetadata: false },
	{ depth: 2, includeMetadata: false },
	{ depth: 1, includeMetadata: false },
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

export async function generateCtags(bbaiDir: string, projectRoot: string): Promise<string> {
	const config = await ConfigManager.getInstance();
	const ctagsConfig = config.getConfig().ctags;

	if (ctagsConfig?.autoGenerate === false) {
		logger.info('Ctags auto-generation is disabled');
		return '';
	}

	const tagsFilePath = ctagsConfig?.tagsFilePath ? ctagsConfig.tagsFilePath : join(bbaiDir, 'tags');
	const tokenLimit = ctagsConfig?.tokenLimit || 1024;
	logger.info(`Ctags using tags file: ${tagsFilePath}, token limit: ${tokenLimit}`);

	for (let tier = 0; tier < TIERS.length; tier++) {
		logger.info(`Attempting to generate ctags with tier ${tier}`);
		if (await generateCtagsTier(projectRoot, tagsFilePath, tier, tokenLimit)) {
			logger.info(`Ctags file generated successfully at ${tagsFilePath} using tier ${tier}`);
			return `<ctags>\n${await Deno.readTextFile(tagsFilePath)}\n</ctags>`;
		}
	}

	logger.warn(`Failed to generate ctags file within token limit (${tokenLimit}) after all tiers. Falling back to file listing.`);
	return await generateFileListing(projectRoot, tokenLimit);
}

async function generateFileListing(projectRoot: string, tokenLimit: number): Promise<string> {
	const excludeOptions = await getExcludeOptions(projectRoot);
	
	for (const tier of FILE_LISTING_TIERS) {
		const listing = await generateFileListingTier(projectRoot, excludeOptions, tier.depth, tier.includeMetadata);
		if (countTokens(listing) <= tokenLimit) {
			return `<file-listing>\n${listing}\n</file-listing>`;
		}
	}

	logger.error(`Failed to generate file listing within token limit (${tokenLimit}) after all tiers`);
	return `<file-listing>\nProject file listing exceeds token limit.\n</file-listing>`;
}

async function generateFileListingTier(projectRoot: string, excludeOptions: string[], maxDepth: number, includeMetadata: boolean): Promise<string> {
	let listing = '';
	for await (const entry of walk(projectRoot, { maxDepth, includeDirs: false })) {
		const relativePath = relative(projectRoot, entry.path);
		if (shouldExclude(relativePath, excludeOptions)) continue;

		if (includeMetadata) {
			const stat = await Deno.stat(entry.path);
			const mimeType = getMimeType(entry.path) || 'application/octet-stream';
			listing += `${relativePath} (${mimeType}, ${stat.size} bytes, modified: ${stat.mtime?.toISOString()})\n`;
		} else {
			listing += `${relativePath}\n`;
		}
	}
	return listing;
}

function shouldExclude(path: string, excludeOptions: string[]): boolean {
	return excludeOptions.some(option => {
		const pattern = option.replace('--exclude=', '').replace(/\*/g, '.*');
		return new RegExp(pattern).test(path);
	});
}

export async function readCtagsOrFileListing(bbaiDir: string, projectRoot: string): Promise<string | null> {
	const config = await ConfigManager.getInstance();
	const ctagsConfig = config.getConfig().ctags;

	const tagsFilePath = ctagsConfig?.tagsFilePath ? join(bbaiDir, ctagsConfig.tagsFilePath) : join(bbaiDir, 'tags');

	if (await exists(tagsFilePath)) {
		try {
			const content = await Deno.readTextFile(tagsFilePath);
			return `<ctags>\n${content}\n</ctags>`;
		} catch (error) {
			logger.error(`Error reading ctags file: ${error.message}`);
		}
	} else {
		logger.warn(`Ctags file not found at ${tagsFilePath}. Generating file listing.`);
		return await generateCtags(bbaiDir, projectRoot);
	}

	return null;
}
