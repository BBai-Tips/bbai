import { simpleGit, SimpleGit } from 'simple-git';

export class GitUtils {
  static async findGitRoot(startPath: string = Deno.cwd()): Promise<string | null> {
    const git: SimpleGit = simpleGit(startPath);
    
    try {
      const result = await git.revparse(['--show-toplevel']);
      return result.trim();
    } catch (_) {
      return null; // Git root not found
    }
  }
}
