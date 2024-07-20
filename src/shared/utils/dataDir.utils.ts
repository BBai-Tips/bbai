import { ensureDir, join } from "@std/fs";
import { GitUtils } from "./git.utils.ts";


export async function getRepoCacheDir(): Promise<string> {
  const gitRoot = await GitUtils.findGitRoot();
  if (!gitRoot) {
    throw new Error("Not in a git repository");
  }
  const repoCacheDir = join(gitRoot, ".bbai");
  await ensureDir(repoCacheDir);
  return repoCacheDir;
}

export async function writeToCache(filename: string, content: string): Promise<void> {
  const cacheDir = await getRepoCacheDir();
  const filePath = join(cacheDir, filename);
  await Deno.writeTextFile(filePath, content);
}

export async function readFromCache(filename: string): Promise<string | null> {
  const cacheDir = await getRepoCacheDir();
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

export async function removeFromCache(filename: string): Promise<void> {
  const cacheDir = await getRepoCacheDir();
  const filePath = join(cacheDir, filename);
  try {
    await Deno.remove(filePath);
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) {
      throw error;
    }
  }
}
