import { ensureDir, ensureFile } from '@std/fs';
import { join } from '@std/path';
import { ConfigManager } from 'shared/configManager.ts';
import { logger } from 'shared/logger.ts';
import { stringify as stringifyYaml } from 'yaml';

export async function createBbaiDir(cwd: string): Promise<void> {
  const bbaiDir = join(cwd, '.bbai');
  try {
    await ensureDir(bbaiDir);
    logger.info(`Created .bbai directory in ${cwd}`);
  } catch (error) {
    logger.error(`Failed to create .bbai directory: ${error.message}`);
    throw error;
  }
}

export async function createTagIgnore(cwd: string): Promise<void> {
  const tagIgnorePath = join(cwd, '.bbai', 'tags.ignore');
  try {
    await ensureFile(tagIgnorePath);
    await Deno.writeTextFile(tagIgnorePath, '.bbai/*');
    logger.info('Created tag.ignore file');
  } catch (error) {
    logger.error(`Failed to create tag.ignore file: ${error.message}`);
    throw error;
  }
}

export async function createGitIgnore(cwd: string): Promise<void> {
  const gitIgnorePath = join(cwd, '.gitignore');
  try {
    await ensureFile(gitIgnorePath);
    await Deno.writeTextFile(gitIgnorePath, '.bbai/*\n');
    logger.info('Created or updated .gitignore file');
  } catch (error) {
    logger.error(`Failed to create or update .gitignore file: ${error.message}`);
    throw error;
  }
}

export function getDefaultGitIgnore(): string {
  return `
# Deno
/.deno/
/.vscode/
*.orig
*.pyc
*.swp

# Dependencies
/node_modules/
/npm-debug.log

# Build output
/dist/
/build/

# Environment variables
.env
.env.local
.env.*.local

# IDE files
.idea/
*.sublime-project
*.sublime-workspace

# Logs
logs
*.log
npm-debug.log*

# OS generated files
.DS_Store
.DS_Store?
._*
.Spotlight-V100
.Trashes
ehthumbs.db
Thumbs.db

# bbai specific
.bbai/*
`;
}

export async function createDefaultConfig(cwd: string): Promise<void> {
  const configManager = await ConfigManager.getInstance();
  await configManager.ensureUserConfig(cwd);
  await configManager.ensureProjectConfig(cwd);
  logger.info('Created default config files');
}
