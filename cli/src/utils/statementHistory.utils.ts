import { ensureFile } from '@std/fs';
import { join } from '@std/path';

const HISTORY_FILE = 'statement_history.json';
const MAX_HISTORY_SIZE = 100;

export async function getStatementHistory(bbaiDir: string): Promise<string[]> {
	const historyPath = join(bbaiDir, HISTORY_FILE);
	await ensureFile(historyPath);

	try {
		const content = await Deno.readTextFile(historyPath);
		return JSON.parse(content);
	} catch {
		return [];
	}
}

export async function addToStatementHistory(bbaiDir: string, statement: string): Promise<void> {
	const historyPath = join(bbaiDir, HISTORY_FILE);
	await ensureFile(historyPath);

	let history = await getStatementHistory(bbaiDir);

	// Remove duplicate if exists
	history = history.filter((item) => item !== statement);

	// Add new statement to the beginning
	history.unshift(statement);

	// Limit history size
	history = history.slice(0, MAX_HISTORY_SIZE);

	await Deno.writeTextFile(historyPath, JSON.stringify(history, null, 2));
}
