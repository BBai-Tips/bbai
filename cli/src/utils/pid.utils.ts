import { readFromBbaiDir, removeFromBbaiDir, writeToBbaiDir } from 'shared/dataDir.ts';

const PID_FILE_NAME = 'api.pid';

export async function savePid(pid: number): Promise<void> {
	await writeToBbaiDir(PID_FILE_NAME, pid.toString());
}

export async function getPid(): Promise<number | null> {
	const pidString = await readFromBbaiDir(PID_FILE_NAME);
	return pidString ? parseInt(pidString, 10) : null;
}

export async function removePid(): Promise<void> {
	await removeFromBbaiDir(PID_FILE_NAME);
}

export async function isApiRunning(): Promise<boolean> {
	const pid = await getPid();
	if (pid === null) return false;

	try {
		Deno.kill(pid, 'SIGCONT');
		return true;
	} catch {
		await removePid();
		return false;
	}
}
