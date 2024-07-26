import { join, relative } from '@std/path';
import { exists, walk } from '@std/fs';
import { ConfigManager } from 'shared/configManager.ts';
import { logger } from './logger.utils.ts';
import { countTokens } from 'anthropic-tokenizer';
import { contentType } from '@std/media-types';

export const FILE_LISTING_TIERS = [
	{ depth: Infinity, includeMetadata: true },
	{ depth: Infinity, includeMetadata: false },
	{ depth: 5, includeMetadata: false },
	{ depth: 3, includeMetadata: false },
	{ depth: 2, includeMetadata: false },
	{ depth: 1, includeMetadata: false },
];

export async function generateFileListing(projectRoot: string): Promise<string | null> {
	const config = await ConfigManager.getInstance();
	const repoInfoConfig = config.getConfig().repoInfo;
	const tokenLimit = repoInfoConfig?.tokenLimit || 1024;

	const excludeOptions = await getExcludeOptions(projectRoot);
	logger.debug(`Exclude options for file listing: ${JSON.stringify(excludeOptions)}`);

	for (const tier of FILE_LISTING_TIERS) {
		logger.debug(`Generating file listing for tier: ${JSON.stringify(tier)}`);
		const listing = await generateFileListingTier(projectRoot, excludeOptions, tier.depth, tier.includeMetadata);
		if (countTokens(listing) <= tokenLimit) {
			logger.info(`File listing generated successfully within token limit (${tokenLimit})`);
			return listing;
		}
	}

	logger.error(`Failed to generate file listing within token limit (${tokenLimit}) after all tiers`);
	return null;
}

async function generateFileListingTier(
	projectRoot: string,
	excludeOptions: string[],
	maxDepth: number,
	includeMetadata: boolean,
): Promise<string> {
	let listing = '';
	for await (const entry of walk(projectRoot, { maxDepth, includeDirs: false })) {
		const relativePath = relative(projectRoot, entry.path);
		if (shouldExclude(relativePath, excludeOptions)) continue;

		if (includeMetadata) {
			const stat = await Deno.stat(entry.path);
			const mimeType = contentType(entry.name) || 'application/octet-stream';
			listing += `${relativePath} (${mimeType}, ${stat.size} bytes, modified: ${stat.mtime?.toISOString()})\n`;
		} else {
			listing += `${relativePath}\n`;
		}
	}
	return listing;
}

function shouldExclude(path: string, excludeOptions: string[]): boolean {
	return excludeOptions.some((option) => {
		const pattern = option.replace('--exclude=', '').replace(/\*/g, '.*');
		return new RegExp(pattern).test(path);
	});
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
			const content = await Deno.readTextFile(file);
			const patterns = content.split('\n')
				.map((line) => line.trim())
				.filter((line) => line && !line.startsWith('#'));
			excludeOptions.push(...patterns.map((pattern) => `--exclude=${pattern}`));
		}
	}

	if (excludeOptions.length === 0) {
		excludeOptions.push('--exclude=.bbai/*');
	}

	return excludeOptions;
}

export async function searchFiles(
	projectRoot: string,
	pattern: string,
	filePattern?: string,
): Promise<{ files: string[]; error: string | null }> {
	const excludeOptions = await getExcludeOptions(projectRoot);
	let command = ['-r', '-l', pattern];

	if (filePattern) {
		command.push('--include', filePattern);
	}

	// Add exclude options
	for (const option of excludeOptions) {
		command.push(option.replace('--exclude=', '--exclude-dir='));
	}

	command.push('.');

	logger.debug(`Search command: ${command.join(' ')}`);
	logger.debug(`Exclude options for search: ${JSON.stringify(excludeOptions)}`);

	const command = new Deno.Command('grep', {
		args: command,
		cwd: projectRoot,
		stdout: 'piped',
		stderr: 'piped',
	});

	const { code, stdout, stderr } = await command.output();
	const rawOutput = stdout;
	const rawError = stderr;

	if (code === 0 || code === 1) { // grep returns 1 if no matches found, which is not an error for us
		const output = new TextDecoder().decode(rawOutput).trim();
		const files = output.split('\n').filter(Boolean);
		return { files, error: null };
	} else {
		const errorMessage = new TextDecoder().decode(rawError).trim();
		return { files: [], error: errorMessage };
	}
}
