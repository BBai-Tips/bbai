import { readFromBbaiDir, removeFromBbaiDir, writeToBbaiDir } from 'shared/dataDir.ts';

const PID_FILE_NAME = 'api.pid';

export async function savePid(cwd: string, pid: number): Promise<void> {
	await writeToBbaiDir(cwd, PID_FILE_NAME, pid.toString());
}

export async function getPid(cwd: string): Promise<number | null> {
	const pidString = await readFromBbaiDir(cwd, PID_FILE_NAME);
	return pidString ? parseInt(pidString, 10) : null;
}

export async function removePid(cwd: string): Promise<void> {
	await removeFromBbaiDir(cwd, PID_FILE_NAME);
}

export async function isApiRunning(cwd: string): Promise<boolean> {
	const pid = await getPid(cwd);
	if (pid === null) return false;

	try {
		Deno.kill(pid, 'SIGCONT');
		return true;
	} catch {
		await removePid(cwd);
		return false;
	}
}
