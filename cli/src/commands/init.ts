import { Command } from 'cliffy/command/mod.ts';
import { Input, prompt } from 'cliffy/prompt/mod.ts';
import { colors } from 'cliffy/ansi/colors.ts';
import { logger } from 'shared/logger.ts';
import { createBbaiDir, createBbaiIgnore } from '../utils/init.utils.ts';
import { basename } from '@std/path';
import { GitUtils } from 'shared/git.ts';
import type { ProjectType, WizardAnswers } from 'shared/configManager.ts';
import { ConfigManager } from 'shared/configManager.ts';
//import { validateAnthropicApiKey } from '../utils/api.utils.ts';

async function runWizard(startDir: string): Promise<WizardAnswers> {
	const configManager = await ConfigManager.getInstance();
	const existingProjectConfig = await configManager.getExistingProjectConfig(startDir);
	const userConfig = await configManager.loadUserConfig();

	const defaultProjectName = existingProjectConfig.project?.name || basename(startDir);
	const defaultPersonName = existingProjectConfig.myPersonsName || Deno.env.get('USER') || Deno.env.get('USERNAME') ||
		'';
	const defaultAssistantName = existingProjectConfig.myAssistantsName || 'Claude';
	const existingApiKey = existingProjectConfig.api?.anthropicApiKey || '';
	const isApiKeyRequired = !userConfig.api?.anthropicApiKey;

	const answers = await prompt([
		{
			name: 'projectName',
			message: 'Enter your project name:',
			type: Input,
			default: defaultProjectName,
		},
		{
			name: 'myPersonsName',
			message: 'Enter your name:',
			type: Input,
			default: defaultPersonName,
			hint: 'Used in conversation display',
		},
		{
			name: 'myAssistantsName',
			message: "Enter your assistant's name:",
			type: Input,
			default: defaultAssistantName,
			hint: 'Used in conversation display',
		},
		{
			name: 'anthropicApiKey',
			message: isApiKeyRequired ? 'Enter your Anthropic API key:' : 'Enter your Anthropic API key (optional):',
			type: Input,
			default: existingApiKey,
			hideDefault: true,
			after: async ({ anthropicApiKey }, next) => {
				//console.log('anthropicApiKey-anthropicApiKey:', anthropicApiKey);
				let continuePrompt = true;
				if (anthropicApiKey?.length === 0) {
					if (isApiKeyRequired) {
						console.warn('API key is required');
						continuePrompt = false;
					}
				} else {
					const { isValid, message } = validateAnthropicApiKey(anthropicApiKey || '');
					if (!isValid) {
						console.warn(message);
						continuePrompt = false;
					}
				}
				if (continuePrompt) {
					await next();
				} else {
					await next('anthropicApiKey');
				}
			},
		},
	]);

	// Detect project type
	const projectType = existingProjectConfig.project?.type || await detectProjectType(startDir);

	// Remove empty values
	const filteredAnswers: WizardAnswers = {
		project: {
			name: answers.projectName?.trim() || startDir,
			type: projectType,
		},
	};

	if (answers.anthropicApiKey && answers.anthropicApiKey.trim() !== '') {
		filteredAnswers.anthropicApiKey = answers.anthropicApiKey.trim();
	}

	if (answers.myPersonsName && answers.myPersonsName.trim() !== '') {
		filteredAnswers.myPersonsName = answers.myPersonsName.trim();
	}
	if (answers.myAssistantsName && answers.myAssistantsName.trim() !== '') {
		filteredAnswers.myAssistantsName = answers.myAssistantsName.trim();
	}
	console.log(filteredAnswers);

	return filteredAnswers;
}

async function detectProjectType(startDir: string): Promise<ProjectType> {
	const gitRoot = await GitUtils.findGitRoot(startDir);
	return gitRoot ? 'git' : 'local';
}

function printProjectDetails(projectName: string, projectType: string, wizardAnswers: WizardAnswers) {
	console.log(`\n${colors.bold.blue.underline('BBai Project Details:')}`);
	console.log(`  ${colors.bold('Name:')} ${colors.green(projectName)}`);
	console.log(`  ${colors.bold('Type:')} ${colors.green(projectType)}`);
	console.log(`  ${colors.bold('Your Name:')} ${colors.green(wizardAnswers.myPersonsName || 'Not set')}`);
	console.log(`  ${colors.bold('Assistant Name:')} ${colors.green(wizardAnswers.myAssistantsName || 'Not set')}`);
	console.log(
		`  ${colors.bold('API Key:')} ${
			colors.green(wizardAnswers.anthropicApiKey ? 'Set in project config' : 'Not set in project config')
		}`,
	);

	console.log(`\n${colors.bold('Configuration Instructions:')}`);
	console.log('1. To modify project-level config:');
	console.log('   Edit the .bbai/config.yaml file in your project directory');
	console.log('2. To modify system/user level config:');
	console.log('   Edit the config.yaml file in your user home directory');
	console.log('   (usually ~/.config/bbai/config.yaml on Unix-like systems)');
	console.log(
		`\n${
			colors.bold('Note:')
		} Your Anthropic API key is stored in configuration. Ensure to keep your config files secure.`,
	);
	console.log(
		`\nTo start using BBai, try running: ${colors.bold.green('bbai start')} or ${colors.bold.green('bbai chat')}`,
	);
}

//async function validateAnthropicApiKey(key: string): Promise<{ isValid: boolean; message: string }> {
function validateAnthropicApiKey(key: string): { isValid: boolean; message: string } {
	//logger.debug('Validating Anthropic API key...');

	// Basic format check (this is a placeholder and may not reflect actual Anthropic API key format)
	const keyRegex = /^sk-[-_a-zA-Z0-9]{48,}$/;

	if (!key.match(keyRegex)) {
		//logger.debug('API key validation failed: Invalid format');
		return {
			isValid: false,
			message: 'Invalid API key format. It should start with "sk-" followed by alphanumeric characters.',
		};
	}

	// TODO: Implement actual API call to validate the key
	// For now, we'll assume the key is valid if it matches the format
	//logger.debug('API key validation passed (placeholder)');
	return {
		isValid: true,
		message: 'API key format is valid. Note: Actual validation against Anthropic API is not implemented yet.',
	};
}

export const init = new Command()
	.name('init')
	.description('Initialize bbai in the current directory')
	.action(async () => {
		const startDir = Deno.cwd();

		try {
			await createBbaiDir(startDir);

			// Run the wizard
			const wizardAnswers = await runWizard(startDir);

			// Create or update config with wizard answers and project info
			const configManager = await ConfigManager.getInstance();
			await configManager.ensureUserConfig();
			await configManager.ensureProjectConfig(startDir, wizardAnswers);

			// Verify that API key is set either in user config or project config
			const finalUserConfig = await configManager.loadUserConfig();
			const finalProjectConfig = await configManager.getExistingProjectConfig(startDir);
			if (!finalUserConfig.api?.anthropicApiKey && !finalProjectConfig.api?.anthropicApiKey) {
				throw new Error(
					'Anthropic API key is required. Please set it in either user or project configuration.',
				);
			}

			// Create .bbai/ignore file
			await createBbaiIgnore(startDir);

			logger.debug('Printing project details...');

			// Print project details and instructions
			printProjectDetails(wizardAnswers.project.name, wizardAnswers.project.type, wizardAnswers);

			//logger.info('bbai initialization complete');
		} catch (error) {
			logger.error(`Error during bbai initialization: ${error.message}`);
			if (error instanceof Deno.errors.PermissionDenied) {
				console.error('Error: Permission denied. Please check your file system permissions and try again.');
			} else if (error instanceof Deno.errors.NotFound) {
				console.error(
					"Error: File or directory not found. Please ensure you're in the correct directory and try again.",
				);
			} else if (error instanceof Error && error.message.includes('API key')) {
				console.error('Error: Invalid API key. Please check your Anthropic API key and try again.');
			} else {
				console.error('An unexpected error occurred. Please check the logs for more information.');
			}
			Deno.exit(1);
		}
	});
