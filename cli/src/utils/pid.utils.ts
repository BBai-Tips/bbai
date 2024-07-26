import { readFromBbaiDir, removeFromBbaiDir, writeToBbaiDir } from 'shared/dataDir.ts';

const PID_FILE_NAME = 'api.pid';

export async function savePid(startDir: string, pid: number): Promise<void> {
	await writeToBbaiDir(startDir, PID_FILE_NAME, pid.toString());
}

export async function getPid(startDir: string): Promise<number | null> {
	const pidString = await readFromBbaiDir(startDir, PID_FILE_NAME);
	return pidString ? parseInt(pidString, 10) : null;
}

export async function removePid(startDir: string): Promise<void> {
	await removeFromBbaiDir(startDir, PID_FILE_NAME);
}

export async function isApiRunning(startDir: string): Promise<boolean> {
	const pid = await getPid(startDir);
	if (pid === null) return false;

	try {
		Deno.kill(pid, 'SIGCONT');
		return true;
	} catch {
		await removePid(startDir);
		return false;
	}
}
