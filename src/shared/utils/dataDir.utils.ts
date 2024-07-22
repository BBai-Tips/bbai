import { ensureDir, exists } from '@std/fs';
import { join, resolve } from '@std/path';
import { parse as parseYaml } from "yaml";
import { GitUtils } from './git.utils.ts';
import { ConfigManager } from 'shared/configManager.ts';

export async function getProjectRoot(cwd: string): Promise<string> {
    const gitRoot = await GitUtils.findGitRoot(cwd);
    if (!gitRoot) {
        throw new Error('Not in a git repository');
    }
    return gitRoot;
}

export async function getBbaiDir(): Promise<string> {
    const projectRoot = await getProjectRoot();
    const bbaiDir = join(projectRoot, '.bbai');
    await ensureDir(bbaiDir);
    return bbaiDir;
}

export async function getBbaiCacheDir(): Promise<string> {
	const bbaiDir = await getBbaiDir();
	const repoCacheDir = join(bbaiDir, 'cache');
	await ensureDir(repoCacheDir);
	return repoCacheDir;
}

export async function writeToBbaiDir(filename: string, content: string): Promise<void> {
	const bbaiDir = await getBbaiDir();
	const filePath = join(bbaiDir, filename);
	await Deno.writeTextFile(filePath, content);
}

export async function readFromBbaiDir(filename: string): Promise<string | null> {
	const bbaiDir = await getBbaiDir();
	const filePath = join(bbaiDir, filename);
	try {
		return await Deno.readTextFile(filePath);
	} catch (error) {
		if (error instanceof Deno.errors.NotFound) {
			return null;
		}
		throw error;
	}
}

export async function removeFromBbaiDir(filename: string): Promise<void> {
	const bbaiDir = await getBbaiDir();
	const filePath = join(bbaiDir, filename);
	try {
		await Deno.remove(filePath);
	} catch (error) {
		if (!(error instanceof Deno.errors.NotFound)) {
			throw error;
		}
	}
}

export async function writeToBbaiCacheDir(filename: string, content: string): Promise<void> {
	const cacheDir = await getBbaiCacheDir();
	const filePath = join(cacheDir, filename);
	await Deno.writeTextFile(filePath, content);
}

export async function readFromBbaiCacheDir(filename: string): Promise<string | null> {
	const cacheDir = await getBbaiCacheDir();
	const filePath = join(cacheDir, filename);
	try {
		return await Deno.readTextFile(filePath);
	} catch (error) {
		if (error instanceof Deno.errors.NotFound) {
			return null;
		}
		throw error;
	}
}

export async function removeFromBbaiCacheDir(filename: string): Promise<void> {
	const cacheDir = await getBbaiCacheDir();
	const filePath = join(cacheDir, filename);
	try {
		await Deno.remove(filePath);
	} catch (error) {
		if (!(error instanceof Deno.errors.NotFound)) {
			throw error;
		}
	}
}

export async function loadConfig(): Promise<Record<string, any>> {
	const configManager = await ConfigManager.getInstance();
	return configManager.getConfig();
}

export async function resolveFilePath(filePath: string): Promise<string> {
	if (filePath.startsWith('/')) {
		return filePath;
	}

	const gitRoot = await GitUtils.findGitRoot();
	if (gitRoot) {
		const projectPath = join(gitRoot, filePath);
		if (await exists(projectPath)) {
			return projectPath;
		}
	}

	const homePath = join(Deno.env.get('HOME') || '', filePath);
	if (await exists(homePath)) {
		return homePath;
	}

	throw new Error(`File not found: ${filePath}`);
}

export async function readFileContent(filePath: string): Promise<string | null> {
	if (await exists(filePath)) {
		return await Deno.readTextFile(filePath);
	}
	return null;
}
