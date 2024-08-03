import { join, relative } from '@std/path';
import globToRegExp from 'npm:glob-to-regexp';
import { exists, walk } from '@std/fs';
import { ConfigManager } from 'shared/configManager.ts';
import { logger } from 'shared/logger.ts';
import { FileHandlingErrorOptions } from '../errors/error.ts';
import { createError, ErrorType } from '../utils/error.utils.ts';
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

	let tierIdx = 0;
	for (const tier of FILE_LISTING_TIERS) {
		tierIdx++;
		logger.debug(`Generating file listing for tier: ${JSON.stringify(tier)}`);
		const listing = await generateFileListingTier(projectRoot, excludeOptions, tier.depth, tier.includeMetadata);
		const tokenCount = countTokens(listing);
		logger.info(
			`Created file listing for tier ${tierIdx} using ${tokenCount} tokens - depth: ${tier.depth} - includeMetadata: ${tier.includeMetadata}`,
		);
		if (tokenCount <= tokenLimit) {
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
	const listing = [];
	for await (const entry of walk(projectRoot, { maxDepth, includeDirs: false })) {
		const relativePath = relative(projectRoot, entry.path);
		if (shouldExclude(relativePath, excludeOptions)) continue;

		if (includeMetadata) {
			const stat = await Deno.stat(entry.path);
			const mimeType = contentType(entry.name) || 'application/octet-stream';
			listing.push(`${relativePath} (${mimeType}, ${stat.size} bytes, modified: ${stat.mtime?.toISOString()})`);
		} else {
			listing.push(`${relativePath}`);
		}
	}
	return listing.sort().join('\n');
}

function shouldExclude(path: string, excludeOptions: string[]): boolean {
	return excludeOptions.some((option) => {
		const pattern = option.replace('--exclude=', '');
		const regex = globToRegExp(pattern);
		return regex.test(path);
	});
}

async function getExcludeOptions(projectRoot: string): Promise<string[]> {
	const excludeFiles = [
		join(projectRoot, 'tags.ignore'),
		join(projectRoot, '.gitignore'),
		join(projectRoot, '.bbai', 'tags.ignore'),
	];

	const patterns = [];
	for (const file of excludeFiles) {
		if (await exists(file)) {
			const content = await Deno.readTextFile(file);
			patterns.push(
				content.split('\n')
					.map((line) => line.trim())
					.filter((line) => line && !line.startsWith('#')),
			);
		}
	}
	patterns.unshift('.bbai/*', '.git/*');

	const uniquePatterns = [...new Set(patterns)];
	const excludeOptions = [...uniquePatterns.map((pattern) => `--exclude=${pattern}`)];

	/*
	if (excludeOptions.length === 0) {
		excludeOptions.push('--exclude=.bbai/*');
	}
	 */

	return excludeOptions;
}

import { normalize, resolve } from '@std/path';

export function isPathWithinProject(projectRoot: string, filePath: string): boolean {
	const normalizedPath = normalize(filePath);
	const resolvedPath = resolve(projectRoot, normalizedPath);
	return resolvedPath.startsWith(projectRoot);
}

export async function readProjectFileContent(projectRoot: string, filePath: string): Promise<string> {
	const fullFilePath = join(projectRoot, filePath);
	logger.info(`Reading contents of File ${fullFilePath}`);
	try {
		const content = await Deno.readTextFile(fullFilePath);
		return content;
	} catch (error) {
		if (error instanceof Deno.errors.NotFound) {
			throw new Error(`File not found: ${fullFilePath}`);
		}
		throw error;
	}
}

export async function updateFile(projectRoot: string, filePath: string, _content: string): Promise<void> {
	if (!isPathWithinProject(projectRoot, filePath)) {
		throw createError(ErrorType.FileHandling, `Access denied: ${filePath} is outside the project directory`, {
			name: 'update-file',
			filePath,
			operation: 'write',
		} as FileHandlingErrorOptions);
	}

	// TODO: Implement file update logic
	logger.info(`File ${filePath} updated in the project`);
}

export async function searchFiles(
	projectRoot: string,
	pattern: string,
	filePattern?: string,
): Promise<{ files: string[]; errorMessage: string | null }> {
	const excludeOptions = await getExcludeOptions(projectRoot);
	const grepCommand = ['-r', '-l', '-E', `${pattern}`];

	if (filePattern) {
		grepCommand.push('--include', filePattern);
	}

	// Add exclude options
	grepCommand.push('--exclude=./.git*');
	for (const option of excludeOptions) {
		grepCommand.push(option.replace('--exclude=', '--exclude=./'));
	}
	grepCommand.push('.');
	logger.debug(`Search command in dir ${projectRoot}: grep `, grepCommand.join(' '));

	const command = new Deno.Command('grep', {
		args: grepCommand,
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
		return { files, errorMessage: null };
	} else {
		const errorMessage = new TextDecoder().decode(rawError).trim();
		return { files: [], errorMessage };
	}
}
