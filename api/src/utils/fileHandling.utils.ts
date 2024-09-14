import { join, normalize, relative, resolve } from '@std/path';
import { TextLineStream } from '@std/streams/text-line-stream';
import { LRUCache } from 'npm:lru-cache';
import { exists, walk } from '@std/fs';
import globToRegExp from 'npm:glob-to-regexp';
//import { globToRegExp } from '@std/path';
import { countTokens } from 'anthropic-tokenizer';
import { contentType } from '@std/media-types';

import { ConfigManager } from 'shared/configManager.ts';
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
	const projectConfig = await ConfigManager.projectConfig(projectRoot);
	const repoInfoConfig = projectConfig.repoInfo;
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

const searchCache = new LRUCache<string, string[]>({ max: 100 });

interface SearchFileOptions {
		file_pattern?: string;
		date_after?: string;
		date_before?: string;
		size_min?: number;
		size_max?: number;
	};
	
export async function searchFilesContent(
	projectRoot: string,
	contentPattern: string,
	options?: SearchFileOptions,
): Promise<{ files: string[]; errorMessage: string | null }> {
	const cacheKey = `${projectRoot}:${contentPattern}:${JSON.stringify(options)}`;
	const cachedResult = searchCache.get(cacheKey);
	if (cachedResult) {
		logger.info(`Returning cached result for search: ${cacheKey}`);
		return { files: cachedResult, errorMessage: null };
	}
	const matchingFiles: string[] = [];
	logger.info(`Starting file content search in ${projectRoot} with pattern: ${contentPattern}`);
	const regex = new RegExp(contentPattern, "i");
	const excludeOptions = await getExcludeOptions(projectRoot);

	try {
		const promises = [];

		for await (const entry of walk(projectRoot, { includeDirs: false })) {
			const relativePath = relative(projectRoot, entry.path);
			if (shouldExclude(relativePath, excludeOptions)) {
				logger.debug(`Skipping excluded file: ${relativePath}`);
				continue;
			}
			if (options?.file_pattern && !isMatch(relativePath, options.file_pattern)) {
				logger.debug(`Skipping file not matching pattern: ${relativePath}`);
				continue;
			}

			promises.push(processFile(entry.path, regex, options, relativePath));
		}

		const results = await Promise.all(promises);
		matchingFiles.push(...results.filter((result): result is string => result !== null));

		logger.info(`File content search completed. Found ${matchingFiles.length} matching files.`);
		searchCache.set(cacheKey, matchingFiles);
		return { files: matchingFiles, errorMessage: null };
	} catch (error) {
		logger.error(`Error in searchFilesContent: ${error.message}`);
		return { files: [], errorMessage: error.message };
	}
}

async function processFile(
	filePath: string,
	regex: RegExp,
	options: SearchFileOptions | undefined,
	relativePath: string
): Promise<string | null> {
	logger.debug(`Processing file: ${relativePath}`);
	try {
		const stat = await Deno.stat(filePath);

		// Apply metadata filters
		if (!passesMetadataFilters(stat, options)) {
			logger.debug(`File ${relativePath} did not pass metadata filters`);
			return null;
		}

		const file = await Deno.open(filePath);
		const lineStream = file.readable
			.pipeThrough(new TextDecoderStream())
			.pipeThrough(new TextLineStream());

		const reader = lineStream.getReader();
		try {
			while (true) {
				const { done, value: line } = await reader.read();
				if (done) break;
				if (regex.test(line as string)) {
				logger.debug(`Match found in file: ${relativePath}`);
					return relativePath;
			}
		}
		} finally {
			reader.releaseLock();
			file.close();
		}
	} catch (error) {
		logger.warn(`Error processing file ${filePath}: ${error.message}`);
	}
	return null;
}

function passesMetadataFilters(stat: Deno.FileInfo, options: SearchFileOptions | undefined): boolean {
	if (!options) return true;
	if (options.date_after && stat.mtime && stat.mtime < new Date(options.date_after)) return false;
	if (options.date_before && stat.mtime && stat.mtime > new Date(options.date_before)) return false;
	if (options.size_min !== undefined && stat.size < options.size_min) return false;
	if (options.size_max !== undefined && stat.size > options.size_max) return false;
	return true;
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
