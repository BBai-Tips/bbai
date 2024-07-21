import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { ensureDir } from '@std/fs';
import { join } from '@std/path';
import { stripIndent } from 'common-tags';

import { GitUtils } from '../utils/git.utils.ts';
import { ConfigSchema, mergeConfigs } from './configSchema.ts';

export class ConfigManager {
	private static instance: ConfigManager;
	private config: Partial<ConfigSchema> = {
		api: {
			environment: 'local',
			apiPort: 3000,
		},
		cli: {},
		ctags: {
			autoGenerate: true,
			tagsFilePath: '.bbai/tags',
		},
	};

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
					# bbai Configuration File
					
					api:
					  # Your Anthropic API key. Replace with your actual key.
					  anthropicApiKey: "your-anthropic-api-key-here"
					
					  # Your OpenAI API key. Uncomment and replace with your actual key if using OpenAI.
					  # openaiApiKey: "your-openai-api-key-here"

					  # Your VoyageAI API key. Uncomment and replace with your actual key if using VoyageAI.
					  # voyageaiApiKey: "your-voyageai-api-key-here"
					
					  # The environment the application is running in. Options: local, remote
					  environment: "local"
					
					  # The port number for the API to listen on
					  apiPort: 3000
					
					  # Set to true to ignore the LLM request cache (useful for development)
					  ignoreLLMRequestCache: false
					
					# Add any CLI-specific configuration options here
					cli: {}
					
					# Add any shared configuration options here
					logLevel: info
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
		const config: Partial<ConfigSchema> = {};
		const apiConfig: Partial<ConfigSchema['api']> = {};
		const cliConfig: Partial<ConfigSchema['cli']> = {};

		const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');
		if (anthropicApiKey) apiConfig.anthropicApiKey = anthropicApiKey;

		const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
		if (openaiApiKey) apiConfig.openaiApiKey = openaiApiKey;

		const voyageaiApiKey = Deno.env.get('VOYAGEAI_API_KEY');
		if (voyageaiApiKey) apiConfig.voyageaiApiKey = voyageaiApiKey;

		const environment = Deno.env.get('BBAI_ENVIRONMENT');
		if (environment) apiConfig.environment = environment;

		const apiPort = Deno.env.get('BBAI_API_PORT');
		if (apiPort) apiConfig.apiPort = parseInt(apiPort, 10);

		const ignoreLLMRequestCache = Deno.env.get('BBAI_IGNORE_LLM_REQUEST_CACHE');
		if (ignoreLLMRequestCache) apiConfig.ignoreLLMRequestCache = ignoreLLMRequestCache === 'true';

		// Add CLI-specific env variables here if needed

		if (Object.keys(apiConfig).length > 0) {
			config.api = apiConfig;
		}

		if (Object.keys(cliConfig).length > 0) {
			config.cli = cliConfig;
		}

		const logFile = Deno.env.get('BBAI_LOG_FILE');
		if (logFile) config.logFile = logFile;

		const logLevel = Deno.env.get('BBAI_LOG_LEVEL');
		if (logLevel) config.logLevel = logLevel as 'debug' | 'info' | 'warn' | 'error';

		return config;
	}

	public getConfig(): Partial<ConfigSchema> {
		return this.config;
	}

	public getRedactedConfig(): Partial<ConfigSchema> {
		const redactedConfig = JSON.parse(JSON.stringify(this.config));
		if (redactedConfig.api.anthropicApiKey) redactedConfig.api.anthropicApiKey = '[REDACTED]';
		if (redactedConfig.api.openaiApiKey) redactedConfig.api.openaiApiKey = '[REDACTED]';
		return redactedConfig;
	}
}

const configManager = await ConfigManager.getInstance();
export const config = configManager.getConfig();
export const redactedConfig = configManager.getRedactedConfig();
