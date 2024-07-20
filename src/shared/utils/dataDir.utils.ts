import { ensureDir, join } from "https://deno.land/std/fs/mod.ts";

export async function getDataDir(): Promise<string> {
  const homeDir = Deno.env.get("HOME") || Deno.env.get("USERPROFILE") || "";
  const dataDir = join(homeDir, ".bbai");
  await ensureDir(dataDir);
  return dataDir;
}

export async function getRepoCacheDir(): Promise<string> {
  const dataDir = await getDataDir();
  const cwd = Deno.cwd();
  const repoName = cwd.split("/").pop() || "default";
  const repoCacheDir = join(dataDir, "repos", repoName);
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
