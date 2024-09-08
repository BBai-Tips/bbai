import { ensureDir, exists } from '@std/fs';
import { dirname, join, resolve } from '@std/path';
import { parse as parseYaml } from '@std/yaml';
import { ConfigManager } from 'shared/configManager.ts';

export async function getProjectRoot(startDir: string): Promise<string> {
	let currentDir = resolve(startDir);
	while (currentDir !== '/') {
		const bbaiDir = join(currentDir, '.bbai');
		if (await exists(bbaiDir)) {
			return currentDir;
		}
		currentDir = resolve(currentDir, '..');
	}
	throw new Error('No .bbai directory found in project hierarchy');
}

export async function getBbaiDir(startDir: string): Promise<string> {
	const projectRoot = await getProjectRoot(startDir);
	const bbaiDir = join(projectRoot, '.bbai');
	await ensureDir(bbaiDir);
	return bbaiDir;
}

export async function getBbaiDataDir(startDir: string): Promise<string> {
	const bbaiDir = await getBbaiDir(startDir);
	const repoCacheDir = join(bbaiDir, 'data');
	await ensureDir(repoCacheDir);
	return repoCacheDir;
}

export async function writeToBbaiDir(startDir: string, filename: string, content: string): Promise<void> {
	const bbaiDir = await getBbaiDir(startDir);
	const filePath = join(bbaiDir, filename);
	await Deno.writeTextFile(filePath, content);
}

export async function readFromBbaiDir(startDir: string, filename: string): Promise<string | null> {
	const bbaiDir = await getBbaiDir(startDir);
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

export async function removeFromBbaiDir(startDir: string, filename: string): Promise<void> {
	const bbaiDir = await getBbaiDir(startDir);
	const filePath = join(bbaiDir, filename);
	try {
		await Deno.remove(filePath);
	} catch (error) {
		if (!(error instanceof Deno.errors.NotFound)) {
			throw error;
		}
	}
}

export async function writeToBbaiDataDir(startDir: string, filename: string, content: string): Promise<void> {
	const dataDir = await getBbaiDataDir(startDir);
	const filePath = join(dataDir, filename);
	await Deno.writeTextFile(filePath, content);
}

export async function readFromBbaiDataDir(startDir: string, filename: string): Promise<string | null> {
	const dataDir = await getBbaiDataDir(startDir);
	const filePath = join(dataDir, filename);
	try {
		return await Deno.readTextFile(filePath);
	} catch (error) {
		if (error instanceof Deno.errors.NotFound) {
			return null;
		}
		throw error;
	}
}

export async function removeFromBbaiDataDir(startDir: string, filename: string): Promise<void> {
	const dataDir = await getBbaiDataDir(startDir);
	const filePath = join(dataDir, filename);
	try {
		await Deno.remove(filePath);
	} catch (error) {
		if (!(error instanceof Deno.errors.NotFound)) {
			throw error;
		}
	}
}

/*
export async function loadConfig(): Promise<Record<string, any>> {
	const configManager = await ConfigManager.getInstance();
	return configManager.getConfig();
}
 */

export async function resolveFilePath(filePath: string): Promise<string> {
	if (filePath.startsWith('/')) {
		return filePath;
	}

	const projectRoot = await getProjectRoot(dirname(filePath));
	if (projectRoot) {
		const projectPath = join(projectRoot, filePath);
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
