import { getBbaiDir } from 'shared/dataDir.ts';
import { ensureFile } from '@std/fs';
import { join } from '@std/path';

const HISTORY_FILE = 'prompt_history.json';
const MAX_HISTORY_SIZE = 100;

export async function getPromptHistory(bbaiDir: string): Promise<string[]> {
	const historyPath = join(bbaiDir, HISTORY_FILE);
	await ensureFile(historyPath);

	try {
		const content = await Deno.readTextFile(historyPath);
		return JSON.parse(content);
	} catch {
		return [];
	}
}

export async function addToPromptHistory(bbaiDir: string, prompt: string): Promise<void> {
	const historyPath = join(bbaiDir, HISTORY_FILE);
	await ensureFile(historyPath);

	let history = await getPromptHistory(bbaiDir);

	// Remove duplicate if exists
	history = history.filter((item) => item !== prompt);

	// Add new prompt to the beginning
	history.unshift(prompt);

	// Limit history size
	history = history.slice(0, MAX_HISTORY_SIZE);

	await Deno.writeTextFile(historyPath, JSON.stringify(history, null, 2));
}
