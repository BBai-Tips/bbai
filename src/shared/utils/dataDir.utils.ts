import { ensureDir } from '@std/fs';
import { join } from '@std/path';
import { GitUtils } from './git.utils.ts';

export async function getBbaiDir(): Promise<string> {
	const gitRoot = await GitUtils.findGitRoot();
	if (!gitRoot) {
		throw new Error('Not in a git repository');
	}
	const bbaiDir = join(gitRoot, '.bbai');
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
