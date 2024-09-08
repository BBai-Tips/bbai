import { parse as parseYaml, stringify as stringifyYaml } from '@std/yaml';
import { ensureDir } from '@std/fs';
import { join } from '@std/path';
import { stripIndent } from 'common-tags';

import { GitUtils } from '../utils/git.utils.ts';
import { ConfigSchema, mergeConfigs } from './configSchema.ts';
import { VERSION } from '../../../version.ts';

export type ProjectType = 'git' | 'local';
export interface WizardAnswers {
	project: {
		name: string;
		type: ProjectType;
	};
	anthropicApiKey?: string;
	myPersonsName?: string;
	myAssistantsName?: string;
}

export class ConfigManager {
	private static instance: ConfigManager;
	private config: Partial<ConfigSchema> = {
		project: {
			name: '',
			type: 'local',
		},
		api: {
			environment: 'local',
			apiPort: 3000,
			logLevel: 'info',
		},
		cli: {},
		repoInfo: {
			ctagsAutoGenerate: true,
		},
		version: VERSION,
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

	public async ensureUserConfig(): Promise<void> {
		const userConfigDir = join(Deno.env.get('HOME') || '', '.config', 'bbai');
		const userConfigPath = join(userConfigDir, 'config.yaml');

		try {
			await Deno.stat(userConfigPath);
		} catch (error) {
			if (error instanceof Deno.errors.NotFound) {
				await ensureDir(userConfigDir);
				const defaultConfig = stripIndent`
					# bbai Configuration File
					
					repoInfo: 
					  tokenLimit: 1024

					api:
					  # Your Anthropic API key. Uncomment and replace with your actual key.
					  # anthropicApiKey: "your-anthropic-api-key-here"
					
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
					
					  # Add any shared configuration options here
					  logLevel: info

					# Add any CLI-specific configuration options here
					cli: {}
					`;
				await Deno.writeTextFile(userConfigPath, defaultConfig);
			} else {
				throw error;
			}
		}
	}

	public async ensureProjectConfig(startDir: string, wizardAnswers: WizardAnswers): Promise<void> {
		const projectConfigPath = join(startDir, '.bbai', 'config.yaml');

		try {
			await ensureDir(join(startDir, '.bbai'));
			let existingConfig: Record<string, unknown> = {};
			try {
				const content = await Deno.readTextFile(projectConfigPath);
				existingConfig = parseYaml(content) as Record<string, unknown>;
			} catch (_) {
				// If the file doesn't exist, we'll start with an empty config
			}

			const projectConfig: Record<string, unknown> = {
				...existingConfig,
				api: {
					...existingConfig.api as Record<string, unknown>,
				},
				project: {
					...existingConfig.project as Record<string, unknown>,
					name: wizardAnswers.project.name,
					type: wizardAnswers.project.type,
				},
			};

			// Only set anthropicApiKey if it's provided in wizardAnswers
			if (wizardAnswers.anthropicApiKey) {
				(projectConfig.api as Record<string, unknown>).anthropicApiKey = wizardAnswers.anthropicApiKey;
			}

			if (wizardAnswers.myPersonsName) {
				projectConfig.myPersonsName = wizardAnswers.myPersonsName;
			}
			if (wizardAnswers.myAssistantsName) {
				projectConfig.myAssistantsName = wizardAnswers.myAssistantsName;
			}

			await Deno.writeTextFile(projectConfigPath, stringifyYaml(projectConfig));
		} catch (error) {
			throw error;
		}
	}

	public async loadUserConfig(): Promise<Partial<ConfigSchema>> {
		const userConfigPath = join(Deno.env.get('HOME') || '', '.config', 'bbai', 'config.yaml');
		try {
			const content = await Deno.readTextFile(userConfigPath);
			return parseYaml(content) as Partial<ConfigSchema>;
		} catch (_) {
			return {};
		}
	}

	public async loadProjectConfig(): Promise<Partial<ConfigSchema>> {
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

	public async getExistingProjectConfig(startDir: string): Promise<Partial<ConfigSchema>> {
		const projectConfigPath = join(startDir, '.bbai', 'config.yaml');
		try {
			const content = await Deno.readTextFile(projectConfigPath);
			return parseYaml(content) as Partial<ConfigSchema>;
		} catch (_) {
			return {};
		}
	}

	private loadEnvConfig(): Partial<ConfigSchema> {
		const config: Partial<ConfigSchema> = {};
		const apiConfig: ConfigSchema['api'] = { logLevel: 'info' };
		const cliConfig: Partial<ConfigSchema['cli']> = {};

		const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');
		if (anthropicApiKey) apiConfig.anthropicApiKey = anthropicApiKey;

		const environment = Deno.env.get('BBAI_ENVIRONMENT');
		if (environment) apiConfig.environment = environment;

		const apiPort = Deno.env.get('BBAI_API_PORT');
		if (apiPort) apiConfig.apiPort = parseInt(apiPort, 10);

		const ignoreLLMRequestCache = Deno.env.get('BBAI_IGNORE_LLM_REQUEST_CACHE');
		if (ignoreLLMRequestCache) apiConfig.ignoreLLMRequestCache = ignoreLLMRequestCache === 'true';

		const apiLogFile = Deno.env.get('BBAI_API_LOG_FILE');
		if (apiLogFile) apiConfig.logFile = apiLogFile;

		const apiLogLevel = Deno.env.get('BBAI_API_LOG_LEVEL');
		if (apiLogLevel) apiConfig.logLevel = apiLogLevel as 'debug' | 'info' | 'warn' | 'error';

		if (Object.keys(apiConfig).length > 0) {
			config.api = apiConfig;
		}

		if (Object.keys(cliConfig).length > 0) {
			config.cli = cliConfig;
		}

		return config;
	}

	public getConfig(): Partial<ConfigSchema> {
		return this.config;
	}

	public getRedactedConfig(): Partial<ConfigSchema> {
		const redactedConfig = JSON.parse(JSON.stringify(this.config));
		if (redactedConfig.api?.anthropicApiKey) redactedConfig.api.anthropicApiKey = '[REDACTED]';
		return redactedConfig;
	}

	public async setConfigValue(key: string, value: string): Promise<void> {
		const keys = key.split('.');
		let current: any = this.config;
		for (let i = 0; i < keys.length - 1; i++) {
			if (!current[keys[i]]) current[keys[i]] = {};
			current = current[keys[i]];
		}
		current[keys[keys.length - 1]] = value;
		await this.saveConfig();
	}

	public getConfigValue(key: string): string | undefined {
		const keys = key.split('.');
		let current: any = this.config;
		for (const k of keys) {
			if (current[k] === undefined) return undefined;
			current = current[k];
		}
		return current;
	}

	private async saveConfig(): Promise<void> {
		const userConfigPath = join(Deno.env.get('HOME') || '', '.config', 'bbai', 'config.yaml');
		await Deno.writeTextFile(userConfigPath, stringifyYaml(this.config));
	}
}

const configManager = await ConfigManager.getInstance();
export const config = configManager.getConfig();
export const redactedConfig = configManager.getRedactedConfig();
