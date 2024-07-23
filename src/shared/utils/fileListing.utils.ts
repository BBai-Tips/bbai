import { join, relative } from '@std/path';
import { walk } from '@std/fs';
import { ConfigManager } from 'shared/configManager.ts';
import { logger } from './logger.utils.ts';
import { countTokens } from 'anthropic-tokenizer';
import { contentType } from '@std/media-types';

const FILE_LISTING_TIERS = [
	{ depth: Infinity, includeMetadata: true },
	{ depth: Infinity, includeMetadata: false },
	{ depth: 5, includeMetadata: false },
	{ depth: 3, includeMetadata: false },
	{ depth: 2, includeMetadata: false },
	{ depth: 1, includeMetadata: false },
];

export async function generateFileListing(projectRoot: string): Promise<string | null> {
	const config = await ConfigManager.getInstance();
	const ctagsConfig = config.getConfig().ctags;
	const tokenLimit = ctagsConfig?.tokenLimit || 1024;

	const excludeOptions = await getExcludeOptions(projectRoot);
	
	for (const tier of FILE_LISTING_TIERS) {
		const listing = await generateFileListingTier(projectRoot, excludeOptions, tier.depth, tier.includeMetadata);
		if (countTokens(listing) <= tokenLimit) {
			return listing;
		}
	}

	logger.error(`Failed to generate file listing within token limit (${tokenLimit}) after all tiers`);
	return null;
}

async function generateFileListingTier(projectRoot: string, excludeOptions: string[], maxDepth: number, includeMetadata: boolean): Promise<string> {
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
	return excludeOptions.some(option => {
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
			excludeOptions.push(`--exclude=@${file}`);
		}
	}

	if (excludeOptions.length === 0) {
		excludeOptions.push('--exclude=.bbai/*');
	}

	return excludeOptions;
}
