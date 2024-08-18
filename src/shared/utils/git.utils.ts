import { SimpleGit, simpleGit } from 'simple-git';
import { normalize, resolve } from '@std/path';

//import { logger } from './logger.utils.ts';

export class GitUtils {
	private static gitInstances: SimpleGit[] = [];

	private static getGit(path: string): SimpleGit {
		const git = simpleGit(path);
		this.gitInstances.push(git);
		return git;
	}

	static async cleanup(): Promise<void> {
		for (const git of this.gitInstances) {
			await git.clean('f', ['-d']);
		}
		this.gitInstances = [];
	}
	static async findGitRoot(startPath: string = Deno.cwd()): Promise<string | null> {
		const git: SimpleGit = this.getGit(startPath);

		try {
			const result = await git.revparse(['--show-toplevel']);
			const normalizedPath = normalize(result.trim());
			const resolvedGitRoot = await Deno.realPath(resolve(normalizedPath));
			return resolvedGitRoot;
		} catch (_) {
			return null; // Git root not found
		}
	}

	static async initGit(repoPath: string): Promise<void> {
		const git: SimpleGit = this.getGit(repoPath);

		try {
			await git.init();
		} catch (error) {
			throw new Error(`Failed to init git repo: ${error.message}`);
		}
	}

	static async stageAndCommit(repoPath: string, files: string[], commitMessage: string): Promise<string> {
		const git: SimpleGit = this.getGit(repoPath);

		try {
			// Stage the specified files
			await git.add(files);

			// Commit the staged changes
			await git.commit(commitMessage);

			return `Changes committed successfully: ${commitMessage}`;
		} catch (error) {
			throw new Error(`Failed to stage and commit changes: ${error.message}`);
		}
	}

	static async getCurrentCommit(repoPath: string): Promise<string | null> {
		const git: SimpleGit = this.getGit(repoPath);

		try {
			const result = await git.revparse(['HEAD']);
			return result.trim();
		} catch (error) {
			throw new Error(`Failed to get current commit: ${error.message}`);
		}
	}

	static async getLastCommitForFile(repoPath: string, filePath: string): Promise<string | null> {
		const git: SimpleGit = this.getGit(repoPath);

		try {
			const result = await git.log({ file: filePath, maxCount: 1 });
			if (result.latest) {
				return result.latest.hash;
			}
			return null;
		} catch (error) {
			throw new Error(`Failed to get last commit for file ${filePath}: ${error.message}`);
		}
	}
}
