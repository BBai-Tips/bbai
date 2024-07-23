import { Command } from 'cliffy/command/mod.ts';
import { GitUtils } from 'shared/utils/git.utils.ts';
import { logger } from 'shared/logger.ts';
import { createBbaiDir, createTagIgnore, createGitIgnore, getDefaultGitIgnore } from '../utils/init.utils.ts';

export const init = new Command()
  .name('init')
  .description('Initialize bbai in the current directory')
  .action(async () => {
    const cwd = Deno.cwd();

    try {
      await createBbaiDir(cwd);
      await createTagIgnore(cwd);

      // Check if in a git repository
      const gitRoot = await GitUtils.findGitRoot(cwd);
      if (!gitRoot) {
        // Initialize git repository
        const git = Deno.run({
          cmd: ['git', 'init'],
          cwd: cwd,
        });
        const status = await git.status();
        if (status.success) {
          logger.info('Initialized git repository');
        } else {
          logger.error('Failed to initialize git repository');
        }
      } else {
        logger.info('Git repository already initialized');
      }

      await createGitIgnore(cwd);

      // Populate .gitignore with default content
      const gitIgnorePath = join(cwd, '.gitignore');
      const defaultGitIgnore = getDefaultGitIgnore();
      await Deno.writeTextFile(gitIgnorePath, defaultGitIgnore, { append: true });
      logger.info('Updated .gitignore with default content');

      logger.info('bbai initialization complete');
    } catch (error) {
      logger.error(`Error during bbai initialization: ${error.message}`);
    }
  });
