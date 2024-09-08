import { join, normalize, relative, resolve } from '@std/path';
import { exists, walk } from '@std/fs';
import globToRegExp from 'npm:glob-to-regexp';
//import { globToRegExp } from '@std/path';
import { countTokens } from 'anthropic-tokenizer';
import { contentType } from '@std/media-types';

import { ConfigManager, type GlobalConfigSchema } from 'shared/configManager.ts';
import { logger } from 'shared/logger.ts';
import type { FileHandlingErrorOptions } from '../errors/error.ts';
import { createError, ErrorType } from '../utils/error.utils.ts';

export const FILE_LISTING_TIERS = [
	{ depth: Infinity, includeMetadata: true },
	{ depth: Infinity, includeMetadata: false },
	{ depth: 5, includeMetadata: false },
	{ depth: 3, includeMetadata: false },
	{ depth: 2, includeMetadata: false },
	{ depth: 1, includeMetadata: false },
];

export async function generateFileListing(projectRoot: string): Promise<string | null> {
	const configManager = await ConfigManager.getInstance();
	const config: GlobalConfigSchema = await configManager.loadGlobalConfig(projectRoot);
	const repoInfoConfig = config.repoInfo;
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
	excludePatterns: string[],
	maxDepth: number,
	includeMetadata: boolean,
): Promise<string> {
	const listing = [];
	for await (const entry of walk(projectRoot, { maxDepth, includeDirs: false })) {
		const relativePath = relative(projectRoot, entry.path);
		if (shouldExclude(relativePath, excludePatterns)) continue;

		if (includeMetadata) {
			const stat = await Deno.stat(entry.path);
			const mimeType = contentType(entry.name) || 'application/octet-stream';
			listing.push(`${relativePath} (${mimeType}, ${stat.size} bytes, modified: ${stat.mtime?.toISOString()})`);
		} else {
			listing.push(relativePath);
		}
	}
	return listing.sort().join('\n');
}

function shouldExclude(path: string, excludePatterns: string[]): boolean {
	return excludePatterns.some((pattern) => {
		// Handle negation patterns
		if (pattern.startsWith('!')) {
			return !isMatch(path, pattern.slice(1));
		}
		return isMatch(path, pattern);
	});
}

function isMatch(path: string, pattern: string): boolean {
	// Handle directory patterns
	if (pattern.endsWith('/')) {
		pattern += '**';
	}

	// Handle simple wildcard patterns
	if (pattern.includes('*') && !pattern.includes('**')) {
		pattern = pattern.split('*').join('**');
	}

	// Handle bare filename (no path, no wildcards)
	if (!pattern.includes('/') && !pattern.includes('*')) {
		pattern = `**/${pattern}`;
	}

	const regex = globToRegExp(pattern, { extended: true, globstar: true });
	return regex.test(path) || regex.test(join(path, ''));
}

async function getExcludeOptions(projectRoot: string): Promise<string[]> {
	const excludeFiles = [
		join(projectRoot, 'tags.ignore'),
		join(projectRoot, '.gitignore'),
		join(projectRoot, '.bbai', 'tags.ignore'),
	];

	const patterns = ['.bbai/*', '.git/*'];
	for (const file of excludeFiles) {
		if (await exists(file)) {
			const content = await Deno.readTextFile(file);
			patterns.push(
				...content.split('\n')
					.map((line) => line.trim())
					.filter((line) => line && !line.startsWith('#'))
					.map((line) => line.replace(/^\/*/, '')), // Remove leading slashes
			);
		}
	}

	const uniquePatterns = [...new Set(patterns)];
	return uniquePatterns;
}

export async function isPathWithinProject(projectRoot: string, filePath: string): Promise<boolean> {
	const normalizedProjectRoot = normalize(projectRoot);
	const normalizedFilePath = normalize(filePath);
	const absoluteFilePath = resolve(normalizedProjectRoot, normalizedFilePath);

	try {
		// For existing files, resolve symlinks
		const resolvedPath = await Deno.realPath(absoluteFilePath);
		return resolvedPath.startsWith(await Deno.realPath(normalizedProjectRoot));
	} catch (error) {
		if (error instanceof Deno.errors.NotFound) {
			// For non-existing files, check if the absolute path is within the project root
			return absoluteFilePath.startsWith(normalizedProjectRoot);
		}
		// For other errors, re-throw
		throw error;
	}
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
	if (!await isPathWithinProject(projectRoot, filePath)) {
		throw createError(ErrorType.FileHandling, `Access denied: ${filePath} is outside the project directory`, {
			name: 'update-file',
			filePath,
			operation: 'write',
		} as FileHandlingErrorOptions);
	}

	// TODO: Implement file update logic
	logger.info(`File ${filePath} updated in the project`);
}

export async function searchFilesContent(
	projectRoot: string,
	contentPattern: string,
	options?: {
		file_pattern?: string;
		date_after?: string;
		date_before?: string;
		size_min?: number;
		size_max?: number;
	},
): Promise<{ files: string[]; errorMessage: string | null }> {
	try {
		const excludeOptions = await getExcludeOptions(projectRoot);
		// Escape special characters for grep
		//const escapedPattern = contentPattern.replace(/([.?*+^$[\]\\(){}|-])/g, "\\$1");
		// Escape backslash characters for grep
		const escapedPattern = contentPattern.replace(/(\\)/g, '\$1');
		//logger.error(`Using escaped pattern in ${projectRoot}: `, JSON.stringify(escapedPattern));
		const grepCommand = ['-r', '-l', '-E', escapedPattern];

		if (options?.file_pattern) {
			grepCommand.push('--include', `./${options.file_pattern}`);
		}

		// Add exclude options
		for (const option of excludeOptions) {
			grepCommand.push('--exclude-dir', option);
			grepCommand.push('--exclude', option);
		}
		grepCommand.push('.');
		logger.error(`Search command in dir ${projectRoot}: grep ${grepCommand.join(' ')}`);

		const command = new Deno.Command('grep', {
			args: grepCommand,
			cwd: projectRoot,
			stdout: 'piped',
			stderr: 'piped',
		});

		const { code, stdout, stderr } = await command.output();
		const rawOutput = new TextDecoder().decode(stdout).trim();
		const rawError = new TextDecoder().decode(stderr).trim();

		if (code === 0 || code === 1) { // grep returns 1 if no matches found, which is not an error for us
			let files = rawOutput.split('\n').filter(Boolean);

			// Apply additional metadata filters
			if (options) {
				files = await filterFilesByMetadata(projectRoot, files, options);
			}

			return { files, errorMessage: null };
		} else {
			return { files: [], errorMessage: rawError };
		}
	} catch (error) {
		logger.error(`Error in searchFilesContent: ${error.message}`);
		return { files: [], errorMessage: error.message };
	}
}

async function filterFilesByMetadata(
	projectRoot: string,
	files: string[],
	options: {
		file_pattern?: string;
		date_after?: string;
		date_before?: string;
		size_min?: number;
		size_max?: number;
	},
): Promise<string[]> {
	const filteredFiles: string[] = [];

	for (const file of files) {
		const fullPath = join(projectRoot, file);
		const stat = await Deno.stat(fullPath);

		// Check date range
		if (options.date_after && stat.mtime && stat.mtime < new Date(options.date_after)) continue;
		if (options.date_before && stat.mtime && stat.mtime > new Date(options.date_before)) continue;

		// Check file size
		if (options.size_min !== undefined && stat.size < options.size_min) continue;
		if (options.size_max !== undefined && stat.size > options.size_max) continue;

		filteredFiles.push(file);
	}

	return filteredFiles;
}

export async function searchFilesMetadata(
	projectRoot: string,
	options: {
		file_pattern?: string;
		date_after?: string;
		date_before?: string;
		size_min?: number;
		size_max?: number;
	},
): Promise<{ files: string[]; errorMessage: string | null }> {
	try {
		const excludeOptions = await getExcludeOptions(projectRoot);
		const matchingFiles: string[] = [];

		for await (const entry of walk(projectRoot, { includeDirs: false })) {
			const relativePath = relative(projectRoot, entry.path);
			if (shouldExclude(relativePath, excludeOptions)) continue;

			const stat = await Deno.stat(entry.path);

			// Check file pattern
			if (options.file_pattern && !isMatch(relativePath, options.file_pattern)) continue;

			// Check date range
			if (!stat.mtime) {
				console.log(`File ${relativePath} has no modification time, excluding from results`);
				continue;
			}
			if (options.date_after) {
				const afterDate = new Date(options.date_after);
				//if (stat.mtime < afterDate || stat.mtime > now) {
				if (stat.mtime < afterDate) {
					console.log(
						`File ${relativePath} modified at ${stat.mtime.toISOString()} is outside the valid range (after ${options.date_after})`,
					);
					continue;
				}
			}
			if (options.date_before) {
				const beforeDate = new Date(options.date_before);
				//if (stat.mtime >= beforeDate || stat.mtime > now) {
				if (stat.mtime >= beforeDate) {
					console.log(
						`File ${relativePath} modified at ${stat.mtime.toISOString()} is outside the valid range (before ${options.date_before})`,
					);
					continue;
				}
			}

			// Check file size
			if (options.size_min !== undefined && stat.size < options.size_min) continue;
			if (options.size_max !== undefined && stat.size > options.size_max) continue;

			console.log(`File ${relativePath} matches all criteria`);
			matchingFiles.push(relativePath);
		}

		return { files: matchingFiles, errorMessage: null };
	} catch (error) {
		logger.error(`Error in searchFilesMetadata: ${error.message}`);
		return { files: [], errorMessage: error.message };
	}
}
