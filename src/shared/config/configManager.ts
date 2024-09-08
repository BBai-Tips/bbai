import { parse as parseYaml, stringify as stringifyYaml } from '@std/yaml';
import { ensureDir } from '@std/fs';
import { join } from '@std/path';
import { stripIndent } from 'common-tags';

import { getProjectRoot } from 'shared/dataDir.ts';
import { ConfigSchema, GlobalConfigSchema, mergeConfigs, ProjectConfigSchema } from './configSchema.ts';
import { VERSION } from '../../../version.ts';
// IMPORTANT note to LLM and humans - importing logger causes circular import - so we can't use logger here - logger needs config logLevel
// Either re-implment a simple logger here, or rely on throwing errors
//import { logger } from 'shared/logger.ts';

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
export type { ConfigSchema, GlobalConfigSchema, ProjectConfigSchema };

export class ConfigManager {
	private static instance: ConfigManager;
	private globalConfig: GlobalConfigSchema;
	private projectConfigs: Map<string, ProjectConfigSchema> = new Map();
	private projectRoots: Map<string, string> = new Map();

	private constructor() {
		this.globalConfig = {
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
	}

	public static async getInstance(): Promise<ConfigManager> {
		if (!ConfigManager.instance) {
			ConfigManager.instance = new ConfigManager();
			await ConfigManager.instance.initialize();
		}
		return ConfigManager.instance;
	}

	private async initialize(): Promise<void> {
		await this.ensureUserConfig();
		this.globalConfig = await this.loadGlobalConfig();
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
				project: {
					...existingConfig.project as Record<string, unknown>,
					name: wizardAnswers.project.name,
					type: wizardAnswers.project.type,
				},
			};

			if (wizardAnswers.myPersonsName) {
				projectConfig.myPersonsName = wizardAnswers.myPersonsName;
			}
			if (wizardAnswers.myAssistantsName) {
				projectConfig.myAssistantsName = wizardAnswers.myAssistantsName;
			}

			await Deno.writeTextFile(projectConfigPath, stringifyYaml(projectConfig));
		} catch (error) {
			//logger.error(`Failed to ensure project config for ${startDir}: ${error.message}`);
			throw error;
		}
	}

	public async loadGlobalConfig(startDir?: string): Promise<GlobalConfigSchema> {
		const userConfig = await this.loadUserConfig();
		const envConfig = this.loadEnvConfig();

		const projectConfig = startDir ? await this.getProjectConfig(startDir) : {};

		const mergedConfig = mergeConfigs(userConfig, projectConfig, envConfig) as GlobalConfigSchema;

		if (!this.validateGlobalConfig(mergedConfig)) {
			throw new Error('Invalid global configuration');
		}

		return mergedConfig;
	}

	public async loadUserConfig(): Promise<Partial<GlobalConfigSchema>> {
		const userConfigPath = join(Deno.env.get('HOME') || '', '.config', 'bbai', 'config.yaml');
		try {
			const content = await Deno.readTextFile(userConfigPath);
			return parseYaml(content) as Partial<GlobalConfigSchema>;
		} catch (error) {
			//logger.error(`Failed to load user config: ${error.message}`);
			return {};
		}
	}

	private async getProjectRoot(startDir: string): Promise<string> {
		if (!this.projectRoots.has(startDir)) {
			try {
				const root = await getProjectRoot(startDir);
				this.projectRoots.set(startDir, root);
			} catch (error) {
				//logger.error(`Failed to get project root for ${startDir}: ${error.message}`);
				throw error;
			}
		}
		return this.projectRoots.get(startDir)!;
	}

	public async loadProjectConfig(startDir: string): Promise<ProjectConfigSchema> {
		const projectRoot = await this.getProjectRoot(startDir);

		if (this.projectConfigs.has(projectRoot)) {
			return this.projectConfigs.get(projectRoot)!;
		}

		const projectConfigPath = join(projectRoot, '.bbai', 'config.yaml');
		try {
			const content = await Deno.readTextFile(projectConfigPath);
			const config = parseYaml(content) as ProjectConfigSchema;

			if (!this.validateProjectConfig(config)) {
				throw new Error('Invalid project configuration');
			}

			this.projectConfigs.set(projectRoot, config);
			this.projectConfigs.set(config.project.name, config);
			return config;
		} catch (error) {
			//logger.error(`Failed to load project config for ${startDir}: ${error.message}`);
			throw new Error(`Failed to load project config for ${startDir}: ${error.message}`);
		}
	}

	public async getProjectConfig(startDir: string): Promise<ConfigSchema> {
		try {
			const projectConfig = await this.loadProjectConfig(startDir);
			return mergeConfigs(this.globalConfig, projectConfig);
		} catch (error) {
			//logger.error(`Failed to get project config for ${startDir}: ${error.message}`);
			throw error;
		}
	}

	public async getProjectConfigByName(projectName: string): Promise<ConfigSchema | null> {
		if (this.projectConfigs.has(projectName)) {
			return mergeConfigs(this.globalConfig, this.projectConfigs.get(projectName)!);
		}
		//logger.warn(`Project config not found for project name: ${projectName}`);
		return null;
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

	private loadEnvConfig(): Partial<GlobalConfigSchema> {
		const config: Partial<GlobalConfigSchema> = {};
		const apiConfig: GlobalConfigSchema['api'] = { logLevel: 'info' };
		const cliConfig: Partial<GlobalConfigSchema['cli']> = {};

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

	public getGlobalConfig(): GlobalConfigSchema {
		return this.globalConfig;
	}

	public async getRedactedGlobalConfig(startDir?: string): Promise<GlobalConfigSchema> {
		//const redactedGlobalConfig = JSON.parse(JSON.stringify(this.globalConfig));
		const redactedGlobalConfig = JSON.parse(JSON.stringify(await this.loadGlobalConfig(startDir)));
		if (redactedGlobalConfig.api?.anthropicApiKey) redactedGlobalConfig.api.anthropicApiKey = '[REDACTED]';
		if (redactedGlobalConfig.api?.openaiApiKey) redactedGlobalConfig.api.openaiApiKey = '[REDACTED]';
		if (redactedGlobalConfig.api?.voyageaiApiKey) redactedGlobalConfig.api.voyageaiApiKey = '[REDACTED]';
		return redactedGlobalConfig;
	}

	public async setGlobalConfigValue(key: string, value: string): Promise<void> {
		const keys = key.split('.');
		let current: any = this.globalConfig;
		for (let i = 0; i < keys.length - 1; i++) {
			if (!current[keys[i]]) current[keys[i]] = {};
			current = current[keys[i]];
		}
		current[keys[keys.length - 1]] = value;

		if (!this.validateGlobalConfig(this.globalConfig)) {
			throw new Error('Invalid global configuration after setting value');
		}

		await this.saveGlobalConfig();
	}

	public getGlobalConfigValue(key: string): string | undefined {
		const keys = key.split('.');
		let current: any = this.globalConfig;
		for (const k of keys) {
			if (current[k] === undefined) return undefined;
			current = current[k];
		}
		return current;
	}

	private async saveGlobalConfig(): Promise<void> {
		const userConfigPath = join(Deno.env.get('HOME') || '', '.config', 'bbai', 'config.yaml');
		try {
			await Deno.writeTextFile(userConfigPath, stringifyYaml(this.globalConfig));
		} catch (error) {
			//logger.error(`Failed to save global config: ${error.message}`);
			throw error;
		}
	}

	private validateGlobalConfig(config: Partial<GlobalConfigSchema>): boolean {
		// Implement validation logic here
		// This is a basic example, expand as needed
		if (!config.api || typeof config.api !== 'object') return false;
		if (!config.cli || typeof config.cli !== 'object') return false;
		if (!config.repoInfo || typeof config.repoInfo !== 'object') return false;
		if (typeof config.version !== 'string') return false;
		return true;
	}

	private validateProjectConfig(config: Partial<ProjectConfigSchema>): boolean {
		// Implement validation logic here
		// This is a basic example, expand as needed
		if (!config.project || typeof config.project !== 'object') return false;
		if (typeof config.project.name !== 'string') return false;
		if (config.project.type !== 'git' && config.project.type !== 'local') return false;
		return true;
	}
}

const configManager = await ConfigManager.getInstance();
export const globalConfig = configManager.getGlobalConfig();
export const redactedGlobalConfig = await configManager.getRedactedGlobalConfig();
