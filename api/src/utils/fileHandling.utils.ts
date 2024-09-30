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
	logger.debug(`FileHandlingUtil: Exclude options for file listing: ${JSON.stringify(excludeOptions)}`);

	let tierIdx = 0;
	for (const tier of FILE_LISTING_TIERS) {
		tierIdx++;
		logger.debug(`FileHandlingUtil: Generating file listing for tier: ${JSON.stringify(tier)}`);
		const listing = await generateFileListingTier(projectRoot, excludeOptions, tier.depth, tier.includeMetadata);
		const tokenCount = countTokens(listing);
		logger.info(
			`FileHandlingUtil: Created file listing for tier ${tierIdx} using ${tokenCount} tokens - depth: ${tier.depth} - includeMetadata: ${tier.includeMetadata}`,
		);
		if (tokenCount <= tokenLimit) {
			logger.info(`FileHandlingUtil: File listing generated successfully within token limit (${tokenLimit})`);
			return listing;
		}
	}

	logger.error(
		`FileHandlingUtil: Failed to generate file listing within token limit (${tokenLimit}) after all tiers`,
	);
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
		// we were just changing '*' to '**' - why was that needed (it wasn't working to match subdirectories)
		// [TODO] add more tests to search_project test to check for more complex file patterns with deeply nested sub directories
		// pattern = pattern.split('*').join('**');
		pattern = `**/${pattern}`;
	}

	// Handle bare filename (no path, no wildcards)
	if (!pattern.includes('/') && !pattern.includes('*')) {
		pattern = `**/${pattern}`;
	}

	const regex = globToRegExp(pattern, { extended: true, globstar: true });
	//logger.debug(`FileHandlingUtil: Regex for pattern: ${pattern}`, regex);
	return regex.test(path); // || regex.test(join(path, ''));
}

async function getExcludeOptions(projectRoot: string): Promise<string[]> {
	const excludeFiles = [
		join(projectRoot, 'tags.ignore'),
		join(projectRoot, '.gitignore'),
		join(projectRoot, '.bbai', 'ignore'),
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
	//logger.debug(`FileHandlingUtil: Exclude patterns for project: ${projectRoot}`, uniquePatterns);
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

export async function existsWithinProject(projectRoot: string, filePath: string): Promise<boolean> {
	const normalizedProjectRoot = normalize(projectRoot);
	const normalizedFilePath = normalize(filePath);
	const absoluteFilePath = resolve(normalizedProjectRoot, normalizedFilePath);

	return await exists(absoluteFilePath);
	// [TODO] Using isReadable is causing tests to fail - is it a real error or some other problem
	//return await exists(absoluteFilePath, { isReadable: true });
}

export async function readProjectFileContent(projectRoot: string, filePath: string): Promise<string> {
	const fullFilePath = join(projectRoot, filePath);
	logger.info(`FileHandlingUtil: Reading contents of File ${fullFilePath}`);
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
	logger.info(`FileHandlingUtil: File ${filePath} updated in the project`);
}

const searchCache = new LRUCache<string, string[]>({ max: 100 });

interface SearchFileOptions {
	filePattern?: string;
	dateAfter?: string;
	dateBefore?: string;
	sizeMin?: number;
	sizeMax?: number;
}

const MAX_CONCURRENT = 20; // Adjust based on system capabilities

export async function searchFilesContent(
	projectRoot: string,
	contentPattern: string,
	caseSensitive: boolean,
	searchFileOptions?: SearchFileOptions,
): Promise<{ files: string[]; errorMessage: string | null }> {
	const cacheKey = `${projectRoot}:${contentPattern}:${caseSensitive ? 'caseSensitive' : 'caseInsensitive'}:${
		JSON.stringify(searchFileOptions)
	}`;
	const cachedResult = searchCache.get(cacheKey);
	if (cachedResult) {
		logger.info(`FileHandlingUtil: Returning cached result for search: ${cacheKey}`);
		return { files: cachedResult, errorMessage: null };
	}
	const matchingFiles: string[] = [];
	logger.info(`FileHandlingUtil: Starting file content search in ${projectRoot} with pattern: ${contentPattern}`);

	let regex: RegExp;
	try {
		// We're only supporting 'g' and 'i' flags at present - there are a few more we can support if needed
		// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_expressions#advanced_searching_with_flags
		//const regexFlags = `${!caseSensitive ? 'i' : ''}${replaceAll ? 'g' : ''}`;
		const regexFlags = `${caseSensitive ? '' : 'i'}`;
		regex = new RegExp(contentPattern, regexFlags);
	} catch (error) {
		logger.error(`FileHandlingUtil: Invalid regular expression: ${contentPattern}`);
		return { files: [], errorMessage: `Invalid regular expression: ${error.message}` };
	}

	const excludeOptions = await getExcludeOptions(projectRoot);

	try {
		const filesToProcess = [];
		for await (const entry of walk(projectRoot, { includeDirs: false })) {
			const relativePath = relative(projectRoot, entry.path);
			if (shouldExclude(relativePath, excludeOptions)) {
				logger.debug(`FileHandlingUtil: Skipping excluded file: ${relativePath}`);
				continue;
			}
			if (searchFileOptions?.filePattern && !isMatch(relativePath, searchFileOptions.filePattern)) {
				logger.debug(`FileHandlingUtil: Skipping file not matching pattern: ${relativePath}`);
				continue;
			}

			filesToProcess.push({ path: entry.path, relativePath });
		}

		const results = await Promise.all(
			chunk(filesToProcess, MAX_CONCURRENT).map(async (batch) =>
				Promise.all(
					batch.map(({ path, relativePath }) => processFile(path, regex, searchFileOptions, relativePath)),
				)
			),
		);

		matchingFiles.push(...results.flat().filter((result): result is string => result !== null));

		logger.info(`FileHandlingUtil: File content search completed. Found ${matchingFiles.length} matching files.`);
		searchCache.set(cacheKey, matchingFiles);
		return { files: matchingFiles, errorMessage: null };
	} catch (error) {
		logger.error(`FileHandlingUtil: Error in searchFilesContent: ${error.message}`);
		return { files: [], errorMessage: error.message };
	}
}

function chunk<T>(array: T[], size: number): T[][] {
	return Array.from({ length: Math.ceil(array.length / size) }, (_, i) => array.slice(i * size, i * size + size));
}

/*
async function processFileManualBuffer(
	filePath: string,
	regex: RegExp,
	searchFileOptions: SearchFileOptions | undefined,
	relativePath: string,
): Promise<string | null> {
	logger.debug(`FileHandlingUtil: Starting to process file: ${relativePath}`);
	let file: Deno.FsFile | null = null;
	try {
		const stat = await Deno.stat(filePath);

		if (!passesMetadataFilters(stat, searchFileOptions)) {
			logger.debug(`FileHandlingUtil: File ${relativePath} did not pass metadata filters`);
			return null;
		}

		file = await Deno.open(filePath);
		logger.debug(`FileHandlingUtil: File opened successfully: ${relativePath}`);

		const decoder = new TextDecoder();
		const buffer = new Uint8Array(1024); // Adjust buffer size as needed
		let leftover = '';

		while (true) {
			const bytesRead = await file.read(buffer);
			if (bytesRead === null) break; // End of file

			const chunk = decoder.decode(buffer.subarray(0, bytesRead), { stream: true });
			const lines = (leftover + chunk).split('\n');
			leftover = lines.pop() || '';

			for (const line of lines) {
				if (regex.test(line)) {
					logger.debug(`FileHandlingUtil: Match found in file: ${relativePath}`);
					return relativePath;
				}
			}
		}

		// Check the last line
		if (leftover && regex.test(leftover)) {
			logger.debug(`FileHandlingUtil: Match found in file: ${relativePath}`);
			return relativePath;
		}

		logger.debug(`FileHandlingUtil: No match found in file: ${relativePath}`);
		return null;
	} catch (error) {
		logger.warn(`FileHandlingUtil: Error processing file ${filePath}: ${error.message}`);
		return null;
	} finally {
		logger.debug(`FileHandlingUtil: Entering finally block for file: ${relativePath}`);
		if (file) {
			try {
				file.close();
				logger.debug(`FileHandlingUtil: File closed successfully: ${relativePath}`);
			} catch (closeError) {
				logger.warn(`FileHandlingUtil: Error closing file ${filePath}: ${closeError.message}`);
			}
		}
		logger.debug(`FileHandlingUtil: Exiting finally block for file: ${relativePath}`);
	}
}

async function processFileStreamLines(
	filePath: string,
	regex: RegExp,
	searchFileOptions: SearchFileOptions | undefined,
	relativePath: string,
): Promise<string | null> {
	logger.debug(`FileHandlingUtil: Starting to process file: ${relativePath}`);
	let file: Deno.FsFile | null = null;
	let reader: ReadableStreamDefaultReader<string> | null = null;
	try {
		const stat = await Deno.stat(filePath);

		if (!passesMetadataFilters(stat, searchFileOptions)) {
			logger.debug(`FileHandlingUtil: File ${relativePath} did not pass metadata filters`);
			return null;
		}

		file = await Deno.open(filePath);
		logger.debug(`FileHandlingUtil: File opened successfully: ${relativePath}`);
		const lineStream = file.readable
			.pipeThrough(new TextDecoderStream())
			.pipeThrough(new TextLineStream());

		reader = lineStream.getReader();
		while (true) {
			const { done, value: line } = await reader.read();
			if (done) {
				logger.debug(`FileHandlingUtil: Finished reading file: ${relativePath}`);
				break;
			}
			if (regex.test(line)) {
				logger.debug(`FileHandlingUtil: Match found in file: ${relativePath}`);
				return relativePath;
			}
		}
		return null;
	} catch (error) {
		logger.warn(`FileHandlingUtil: Error processing file ${filePath}: ${error.message}`);
		return null;
	} finally {
		logger.debug(`FileHandlingUtil: Entering finally block for file: ${relativePath}`);
		if (reader) {
			try {
				await reader.cancel();
				logger.debug(`FileHandlingUtil: Reader cancelled for file: ${relativePath}`);
			} catch (cancelError) {
				logger.warn(`FileHandlingUtil: Error cancelling reader for ${filePath}: ${cancelError.message}`);
			}
			reader.releaseLock();
			logger.debug(`FileHandlingUtil: Reader lock released for file: ${relativePath}`);
		}
		if (file) {
			try {
				file.close();
				logger.debug(`FileHandlingUtil: File closed successfully: ${relativePath}`);
			} catch (closeError) {
				if (closeError instanceof Deno.errors.BadResource) {
					logger.debug(`FileHandlingUtil: File was already closed: ${relativePath}`);
				} else {
					logger.warn(`FileHandlingUtil: Error closing file ${filePath}: ${closeError.message}`);
				}
			}
		}
		logger.debug(`FileHandlingUtil: Exiting finally block for file: ${relativePath}`);
	}
}

async function processFileStreamBuffer(
	filePath: string,
	regex: RegExp,
	searchFileOptions: SearchFileOptions | undefined,
	relativePath: string,
): Promise<string | null> {
	logger.debug(`FileHandlingUtil: Starting to process file: ${relativePath}`);
	let file: Deno.FsFile | null = null;
	let reader: ReadableStreamDefaultReader<string> | null = null;
	try {
		const stat = await Deno.stat(filePath);
		if (!passesMetadataFilters(stat, searchFileOptions)) {
			return null;
		}

		file = await Deno.open(filePath);
		const textStream = file.readable
			.pipeThrough(new TextDecoderStream());

		reader = textStream.getReader();
		let buffer = '';
		const maxBufferSize = 1024 * 1024; // 1MB, adjust as needed

		while (true) {
			const { done, value } = await reader.read();
			if (done) break;

			buffer += value;

			// Check for matches
			if (regex.test(buffer)) {
				return relativePath;
			}

			// Trim buffer if it gets too large
			if (buffer.length > maxBufferSize) {
				buffer = buffer.slice(-maxBufferSize);
			}
		}

		// Final check on remaining buffer
		if (regex.test(buffer)) {
			return relativePath;
		}

		return null;
	} catch (error) {
		logger.warn(`FileHandlingUtil: Error processing file ${filePath}: ${error.message}`);
		return null;
	} finally {
		if (reader) {
			try {
				await reader.cancel();
				reader.releaseLock();
			} catch (cancelError) {
				logger.warn(`FileHandlingUtil: Error cancelling reader for ${filePath}: ${cancelError.message}`);
			}
		}
		if (file) {
			try {
				file.close();
			} catch (closeError) {
				if (closeError instanceof Deno.errors.BadResource) {
					logger.debug(`FileHandlingUtil: File was already closed: ${relativePath}`);
				} else {
					logger.warn(`FileHandlingUtil: Error closing file ${filePath}: ${closeError.message}`);
				}
			}
		}
	}
}
 */

async function processFile(
	filePath: string,
	regex: RegExp,
	searchFileOptions: SearchFileOptions | undefined,
	relativePath: string,
): Promise<string | null> {
	logger.debug(`FileHandlingUtil: Starting to process file: ${relativePath}`);
	let file: Deno.FsFile | null = null;
	let reader: ReadableStreamDefaultReader<string> | null = null;
	try {
		const stat = await Deno.stat(filePath);
		if (!passesMetadataFilters(stat, searchFileOptions)) {
			return null;
		}

		file = await Deno.open(filePath);
		const textStream = file.readable
			.pipeThrough(new TextDecoderStream());

		reader = textStream.getReader();
		let buffer = '';
		const maxBufferSize = 1024 * 1024; // 1MB, adjust as needed
		const overlapSize = 1024; // Size of overlap between buffers, adjust based on expected pattern size

		while (true) {
			const { done, value } = await reader.read();
			if (done) break;

			buffer += value;

			// Check for matches
			if (regex.test(buffer)) {
				return relativePath;
			}

			// Trim buffer if it gets too large, keeping overlap
			if (buffer.length > maxBufferSize) {
				buffer = buffer.slice(-maxBufferSize - overlapSize);
			}
		}

		// Final check on remaining buffer
		if (regex.test(buffer)) {
			return relativePath;
		}

		return null;
	} catch (error) {
		logger.warn(`FileHandlingUtil: Error processing file ${filePath}: ${error.message}`);
		return null;
	} finally {
		if (reader) {
			try {
				await reader.cancel();
				reader.releaseLock();
			} catch (cancelError) {
				logger.warn(`FileHandlingUtil: Error cancelling reader for ${filePath}: ${cancelError.message}`);
			}
		}
		if (file) {
			try {
				file.close();
			} catch (closeError) {
				if (closeError instanceof Deno.errors.BadResource) {
					logger.debug(`FileHandlingUtil: File was already closed: ${relativePath}`);
				} else {
					logger.warn(`FileHandlingUtil: Error closing file ${filePath}: ${closeError.message}`);
				}
			}
		}
	}
}

function passesMetadataFilters(stat: Deno.FileInfo, searchFileOptions: SearchFileOptions | undefined): boolean {
	if (!searchFileOptions) return true;
	if (searchFileOptions.dateAfter && stat.mtime && stat.mtime < new Date(searchFileOptions.dateAfter)) return false;
	if (searchFileOptions.dateBefore && stat.mtime && stat.mtime > new Date(searchFileOptions.dateBefore)) return false;
	if (searchFileOptions.sizeMin !== undefined && stat.size < searchFileOptions.sizeMin) return false;
	if (searchFileOptions.sizeMax !== undefined && stat.size > searchFileOptions.sizeMax) return false;
	return true;
}

export async function searchFilesMetadata(
	projectRoot: string,
	searchFileOptions: {
		filePattern?: string;
		dateAfter?: string;
		dateBefore?: string;
		sizeMin?: number;
		sizeMax?: number;
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
			if (searchFileOptions.filePattern && !isMatch(relativePath, searchFileOptions.filePattern)) continue;

			// Check date range
			if (!stat.mtime) {
				console.log(`File ${relativePath} has no modification time, excluding from results`);
				continue;
			}
			if (searchFileOptions.dateAfter) {
				const afterDate = new Date(searchFileOptions.dateAfter);
				//if (stat.mtime < afterDate || stat.mtime > now) {
				if (stat.mtime < afterDate) {
					console.log(
						`File ${relativePath} modified at ${stat.mtime.toISOString()} is outside the valid range (after ${searchFileOptions.dateAfter})`,
					);
					continue;
				}
			}
			if (searchFileOptions.dateBefore) {
				const beforeDate = new Date(searchFileOptions.dateBefore);
				//if (stat.mtime >= beforeDate || stat.mtime > now) {
				if (stat.mtime >= beforeDate) {
					console.log(
						`File ${relativePath} modified at ${stat.mtime.toISOString()} is outside the valid range (before ${searchFileOptions.dateBefore})`,
					);
					continue;
				}
			}

			// Check file size
			if (searchFileOptions.sizeMin !== undefined && stat.size < searchFileOptions.sizeMin) continue;
			if (searchFileOptions.sizeMax !== undefined && stat.size > searchFileOptions.sizeMax) continue;

			console.log(`File ${relativePath} matches all criteria`);
			matchingFiles.push(relativePath);
		}

		return { files: matchingFiles, errorMessage: null };
	} catch (error) {
		logger.error(`FileHandlingUtil: Error in searchFilesMetadata: ${error.message}`);
		return { files: [], errorMessage: error.message };
	}
}
