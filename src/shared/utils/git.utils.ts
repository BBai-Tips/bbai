import { SimpleGit, simpleGit } from 'simple-git';

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

	static async stageAndCommit(repoPath: string, files: string[], commitMessage: string): Promise<void> {
		const git: SimpleGit = simpleGit(repoPath);

		try {
			// Stage the specified files
			await git.add(files);

			// Commit the staged changes
			await git.commit(commitMessage);

			console.log(`Changes committed successfully: ${commitMessage}`);
		} catch (error) {
			throw new Error(`Failed to stage and commit changes: ${error.message}`);
		}
	}

	static async getCurrentCommit(repoPath: string): Promise<string | null> {
		const git: SimpleGit = simpleGit(repoPath);

		try {
			const result = await git.revparse(['HEAD']);
			return result.trim();
		} catch (error) {
			throw new Error(`Failed to get current commit: ${error.message}`);
		}
	}
}
