import { ensureDir } from '@std/fs';
import { join } from '@std/path';
//import type { WizardAnswers } from 'shared/configManager.ts';
//import { ConfigManager } from 'shared/configManager.ts';
import { logger } from 'shared/logger.ts';

export async function createBbaiDir(startDir: string): Promise<void> {
	const bbaiDir = join(startDir, '.bbai');
	try {
		await ensureDir(bbaiDir);
		//logger.info(`Created .bbai directory in ${startDir}`);
	} catch (error) {
		logger.error(`Failed to create .bbai directory: ${error.message}`);
		throw error;
	}
}

export async function createBbaiIgnore(startDir: string): Promise<void> {
	const bbaiIgnorePath = join(startDir, '.bbai', 'ignore');
	try {
		const fileInfo = await Deno.stat(bbaiIgnorePath);
		if (fileInfo.isFile) {
			logger.info('.bbai/ignore file already exists, skipping creation');
			return;
		}
	} catch (error) {
		if (!(error instanceof Deno.errors.NotFound)) {
			logger.error(`Error checking .bbai/ignore file: ${error.message}`);
			throw error;
		}
		// File doesn't exist, proceed with creation
		try {
			await Deno.writeTextFile(bbaiIgnorePath, getDefaultBbaiIgnore());
			//logger.debug('Created .bbai/ignore file');
		} catch (writeError) {
			logger.error(`Failed to create .bbai/ignore file: ${writeError.message}`);
			throw writeError;
		}
	}
}

export function getDefaultBbaiIgnore(): string {
	return `
# Ignore patterns for BBai
# Add files and directories that should be ignored by BBai here

# Ignore node_modules directory
node_modules/

# Ignore build output directories
dist/
build/
out/

# Ignore log files
*.log

# Ignore temporary files
*.tmp
*.temp

# Ignore OS-specific files
.DS_Store
Thumbs.db

# Ignore IDE and editor files
.vscode/
.idea/
*.swp
*.swo

# Ignore BBai's own directory
.bbai/

# Ignore git directory
.git/

# Add your custom ignore patterns below
`;
}

/*
export async function createDefaultConfig(startDir: string, wizardAnswers: WizardAnswers): Promise<void> {
	const configManager = await ConfigManager.getInstance();
	await configManager.ensureUserConfig();

	const projectConfig = {
		...wizardAnswers,
	};

	await configManager.ensureProjectConfig(startDir, projectConfig);
	logger.info('Created default config files');
}
 */
