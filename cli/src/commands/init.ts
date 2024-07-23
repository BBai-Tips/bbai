import { Command } from 'cliffy/command/mod.ts';
import { ensureDir } from '@std/fs';
import { join } from '@std/path';
import { GitUtils } from 'shared/utils/git.utils.ts';
import { logger } from 'shared/logger.ts';

export const init = new Command()
  .name('init')
  .description('Initialize bbai in the current directory')
  .action(async () => {
    const cwd = Deno.cwd();

    // Create .bbai directory
    const bbaiDir = join(cwd, '.bbai');
    try {
      await ensureDir(bbaiDir);
      logger.info(`Created .bbai directory in ${cwd}`);
    } catch (error) {
      logger.error(`Failed to create .bbai directory: ${error.message}`);
      return;
    }

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

    logger.info('bbai initialization complete');
  });
