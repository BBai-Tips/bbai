import { walk } from "https://deno.land/std/fs/mod.ts";

export class GitUtils {
  static async findGitRoot(startPath: string = Deno.cwd()): Promise<string | null> {
    let currentPath = startPath;

    while (currentPath !== '/') {
      try {
        const gitDir = await Deno.stat(`${currentPath}/.git`);
        if (gitDir.isDirectory) {
          return currentPath;
        }
      } catch (_) {
        // .git directory not found, continue searching
      }

      currentPath = Deno.realPathSync(Deno.joinPath(currentPath, '..'));
    }

    return null; // Git root not found
  }
}
