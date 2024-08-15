import { Command } from 'cliffy/command/mod.ts';
import { GitUtils } from 'shared/git.ts';
import { logger } from 'shared/logger.ts';
import {
	createBbaiDir,
	createDefaultConfig,
	createGitIgnore,
	createTagIgnore,
	getDefaultGitIgnore,
} from '../utils/init.utils.ts';
import { join } from '@std/path';

export const init = new Command()
	.name('init')
	.description('Initialize bbai in the current directory')
	.action(async () => {
		const startDir = Deno.cwd();

		try {
			await createBbaiDir(startDir);
			await createTagIgnore(startDir);
			await createDefaultConfig(startDir);

			// Check if in a git repository
			const gitRoot = await GitUtils.findGitRoot(startDir);
			if (!gitRoot) {
				// Initialize git repository
				try {
					await GitUtils.initGit(startDir);
					logger.info('Initialized git repository');
				} catch (error) {
					logger.error(`Failed to initialize git repository: ${error.message}`);
				}
			} else {
				logger.info('Git repository already initialized');
			}

			const gitIgnorePath = join(startDir, '.gitignore');
			let gitIgnoreContent = '';

			try {
				gitIgnoreContent = await Deno.readTextFile(gitIgnorePath);
				logger.info('.gitignore file already exists');
			} catch (error) {
				if (error instanceof Deno.errors.NotFound) {
					await createGitIgnore(startDir);
					gitIgnoreContent = getDefaultGitIgnore();
					await Deno.writeTextFile(gitIgnorePath, gitIgnoreContent);
					logger.info('Created .gitignore with default content');
				} else {
					throw error;
				}
			}

			if (!gitIgnoreContent.includes('.bbai/*')) {
				gitIgnoreContent += '\n.bbai/*\n';
				await Deno.writeTextFile(gitIgnorePath, gitIgnoreContent);
				logger.info('Updated .gitignore to include .bbai/*');
			} else {
				logger.info('.gitignore already includes .bbai/*');
			}

			logger.info('bbai initialization complete');
		} catch (error) {
			logger.error(`Error during bbai initialization: ${error.message}`);
		}
	});
