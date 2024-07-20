import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { ensureDir } from '@std/fs';
import { join } from '@std/path';
import { stripIndent } from 'common-tags';

import { GitUtils } from '../utils/git.utils.ts';
import { ConfigSchema, mergeConfigs } from './configSchema.ts';

export class ConfigManager {
	private static instance: ConfigManager;
	private config: ConfigSchema = { api: {}, cli: {} } as ConfigSchema;

	private constructor() {}

	public static async getInstance(): Promise<ConfigManager> {
		if (!ConfigManager.instance) {
			ConfigManager.instance = new ConfigManager();
			await ConfigManager.instance.initialize();
		}
		return ConfigManager.instance;
	}

	private async initialize(): Promise<void> {
		await this.ensureUserConfig();
		const userConfig = await this.loadUserConfig();
		const projectConfig = await this.loadProjectConfig();
		const envConfig = this.loadEnvConfig();

		this.config = mergeConfigs(userConfig, projectConfig, envConfig);
	}

	private async ensureUserConfig(): Promise<void> {
		const userConfigDir = join(Deno.env.get('HOME') || '', '.config', 'bbai');
		const userConfigPath = join(userConfigDir, 'config.yaml');

		try {
			await Deno.stat(userConfigPath);
		} catch (error) {
			if (error instanceof Deno.errors.NotFound) {
				await ensureDir(userConfigDir);
				const defaultConfig = stripIndent`
					# BBAI Configuration File
					
					api:
					  # Your Anthropic API key. Replace with your actual key.
					  anthropicApiKey: "your-anthropic-api-key-here"
					
					  # Your OpenAI API key. Uncomment and replace with your actual key if using OpenAI.
					  # openaiApiKey: "your-openai-api-key-here"
					
					  # The environment the application is running in. Options: localdev, development, production
					  environment: "localdev"
					
					  # The port number for the API to listen on
					  appPort: 3000
					
					  # Set to true to ignore the LLM request cache (useful for development)
					  ignoreLLMRequestCache: false
					
					cli:
					  # Add any CLI-specific configuration options here
					
					# Add any shared configuration options here
					`;
				await Deno.writeTextFile(userConfigPath, defaultConfig);
			} else {
				throw error;
			}
		}
	}

	private async loadUserConfig(): Promise<Partial<ConfigSchema>> {
		const userConfigPath = join(Deno.env.get('HOME') || '', '.config', 'bbai', 'config.yaml');
		try {
			const content = await Deno.readTextFile(userConfigPath);
			return parseYaml(content) as Partial<ConfigSchema>;
		} catch (_) {
			return {};
		}
	}

	private async loadProjectConfig(): Promise<Partial<ConfigSchema>> {
		const gitRoot = await GitUtils.findGitRoot();
		if (!gitRoot) return {};

		const projectConfigPath = `${gitRoot}/.bbai/config.yaml`;
		try {
			const content = await Deno.readTextFile(projectConfigPath);
			return parseYaml(content) as Partial<ConfigSchema>;
		} catch (_) {
			return {};
		}
	}

	private loadEnvConfig(): Partial<ConfigSchema> {
		return {
			api: {
				anthropicApiKey: Deno.env.get('ANTHROPIC_API_KEY'),
				openaiApiKey: Deno.env.get('OPENAI_API_KEY'),
				environment: Deno.env.get('ENVIRONMENT'),
				appPort: Deno.env.get('APP_PORT') ? parseInt(Deno.env.get('APP_PORT')!, 10) : undefined,
				ignoreLLMRequestCache: Deno.env.get('IGNORE_LLM_REQUEST_CACHE') === 'true',
			},
			// Add CLI-specific env variables here if needed
		};
	}

	public getConfig(): ConfigSchema {
		return this.config;
	}

	public getRedactedConfig(): ConfigSchema {
		const redactedConfig = JSON.parse(JSON.stringify(this.config));
		if (redactedConfig.api.anthropicApiKey) redactedConfig.api.anthropicApiKey = '[REDACTED]';
		if (redactedConfig.api.openaiApiKey) redactedConfig.api.openaiApiKey = '[REDACTED]';
		return redactedConfig;
	}
}
