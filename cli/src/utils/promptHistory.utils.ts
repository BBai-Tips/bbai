import { getBbaiDir } from 'shared/utils/dataDir.utils.ts';
import { ensureFile } from 'std/fs/ensure_file.ts';
import { join } from 'std/path/mod.ts';

const HISTORY_FILE = 'chat_history.json';
const MAX_HISTORY_SIZE = 100;

export async function getPromptHistory(startDir: string): Promise<string[]> {
	const bbaiDir = await getBbaiDir(startDir);
	const historyPath = join(bbaiDir, HISTORY_FILE);
	await ensureFile(historyPath);

	try {
		const content = await Deno.readTextFile(historyPath);
		return JSON.parse(content);
	} catch {
		return [];
	}
}

export async function addToPromptHistory(startDir: string, prompt: string): Promise<void> {
	const bbaiDir = await getBbaiDir(startDir);
	const historyPath = join(bbaiDir, HISTORY_FILE);
	await ensureFile(historyPath);

	let history = await getPromptHistory(startDir);

	// Remove duplicate if exists
	history = history.filter((item) => item !== prompt);

	// Add new prompt to the beginning
	history.unshift(prompt);

	// Limit history size
	history = history.slice(0, MAX_HISTORY_SIZE);

	await Deno.writeTextFile(historyPath, JSON.stringify(history, null, 2));
}
