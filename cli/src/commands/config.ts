import { Command } from 'cliffy/command/mod.ts';
import { ConfigManager } from 'shared/configManager.ts';
import { logger } from 'shared/logger.ts';
//import { join } from '@std/path';

export const config = new Command()
	.name('config')
	.description('View or update bbai configuration')
	.action(async () => {
		const configManager = await ConfigManager.getInstance();
		const currentConfig = configManager.getRedactedConfig();
		console.log('Current configuration:');
		console.log(JSON.stringify(currentConfig, null, 2));
	})
	.command('set', 'Set a configuration value')
	.arguments('<key:string> <value:string>')
	.action(async (_, key, value) => {
		const configManager = await ConfigManager.getInstance();
		await configManager.setConfigValue(key, value);
		logger.info(`Configuration updated: ${key} = ${value}`);
	})
	.command('get', 'Get a configuration value')
	.arguments('<key:string>')
	.action(async (_, key) => {
		const configManager = await ConfigManager.getInstance();
		const value = configManager.getConfigValue(key);
		console.log(`${key}: ${value}`);
	});

// Add this command to the main.ts file
