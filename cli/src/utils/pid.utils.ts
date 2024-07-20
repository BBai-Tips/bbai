import { ensureDir } from "https://deno.land/std/fs/mod.ts";
import { join } from "https://deno.land/std/path/mod.ts";

const PID_FILE_PATH = join("..", "..", "cache", "api.pid");

export async function savePid(pid: number): Promise<void> {
  await ensureDir(join("..", "..", "cache"));
  await Deno.writeTextFile(PID_FILE_PATH, pid.toString());
}

export async function getPid(): Promise<number | null> {
  try {
    const pidString = await Deno.readTextFile(PID_FILE_PATH);
    return parseInt(pidString, 10);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return null;
    }
    throw error;
  }
}

export async function removePid(): Promise<void> {
  try {
    await Deno.remove(PID_FILE_PATH);
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) {
      throw error;
    }
  }
}

export async function isApiRunning(): Promise<boolean> {
  const pid = await getPid();
  if (pid === null) return false;
  
  try {
    Deno.kill(pid, 0);
    return true;
  } catch {
    await removePid();
    return false;
  }
}
