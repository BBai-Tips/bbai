import { parse as parseYaml, stringify as stringifyYaml } from '@std/yaml';
import { ensureDir } from '@std/fs';
import { join, resolve } from '@std/path';
import { stripIndent } from 'common-tags';

import { getBbaiDir, getGlobalConfigDir, getProjectRoot } from 'shared/dataDir.ts';
import {
	defaultGlobalConfig,
	defaultProjectConfig,
	FullConfigSchema,
	GlobalConfigSchema,
	mergeConfigs,
	ProjectConfigSchema,
	ProjectDataConfigSchema,
} from './configSchema.ts';
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
export type { FullConfigSchema, GlobalConfigSchema, ProjectConfigSchema };

export class ConfigManager {
	private static instance: ConfigManager;
	private defaultGlobalConfig: GlobalConfigSchema = defaultGlobalConfig;
	private globalConfig!: GlobalConfigSchema;
	private projectConfigs: Map<string, ProjectConfigSchema> = new Map();
	private projectRoots: Map<string, string> = new Map();

	private constructor() {
		this.defaultGlobalConfig.version = VERSION;
		this.defaultGlobalConfig.bbaiExeName = Deno.build.os === 'windows' ? 'bbai.exe' : 'bbai';
		this.defaultGlobalConfig.bbaiApiExeName = Deno.build.os === 'windows' ? 'bbai-api.exe' : 'bbai-api';
	}

	public static async getInstance(): Promise<ConfigManager> {
		if (!ConfigManager.instance) {
			ConfigManager.instance = new ConfigManager();
		}
		return ConfigManager.instance;
	}

	public static async fullConfig(startDir: string): Promise<FullConfigSchema> {
		const configManager = await ConfigManager.getInstance();
		const fullConfig = await configManager.getFullConfig(startDir);
		return fullConfig;
	}

	public static async redactedFullConfig(startDir: string): Promise<FullConfigSchema> {
		const configManager = await ConfigManager.getInstance();
		const redactedFullConfig = await configManager.getRedactedFullConfig(startDir);
		return redactedFullConfig;
	}

	public static async globalConfig(): Promise<GlobalConfigSchema> {
		const configManager = await ConfigManager.getInstance();
		const globalConfig = await configManager.getGlobalConfig();
		return globalConfig;
	}

	public static async projectConfig(startDir: string): Promise<ProjectConfigSchema> {
		const configManager = await ConfigManager.getInstance();
		const projectConfig = await configManager.getProjectConfig(startDir);
		return projectConfig;
	}

	public async ensureGlobalConfig(): Promise<void> {
		const globalConfigDir = await getGlobalConfigDir();
		const globalConfigPath = join(globalConfigDir, 'config.yaml');

		try {
			await Deno.stat(globalConfigPath);
		} catch (error) {
			if (error instanceof Deno.errors.NotFound) {
				await ensureDir(globalConfigDir);
				const defaultConfig = stripIndent`
                    # BBai Configuration File
                    
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
                    
                      # The hostname for the API to listen on
                      apiHostname: localhost
                    
                      # The port number for the API to listen on
                      apiPort: 3000

                      # Whether the API listens with TLS
                      apiUseTls: true
                    
                      # Set to true to ignore the LLM request cache (useful for development)
                      ignoreLLMRequestCache: false
                    
                      # Set to true to enable prompt caching (default: true)
                      usePromptCaching: true
                    
                      # Add any shared configuration options here
                      logLevel: info

					  # Tool-specific congiguration
					  toolConfigs: {}

					  # Directory for user-created tools
					  userToolDirectories: 
						- ./tools

                    # Add any CLI-specific configuration options here
                    cli: {}

                    `;
				await Deno.writeTextFile(globalConfigPath, defaultConfig);
			} else {
				throw error;
			}
		}
	}

	public async ensureProjectConfig(startDir: string, wizardAnswers: WizardAnswers): Promise<void> {
		const projectConfigPath = join(startDir, '.bbai', 'config.yaml');

		try {
			await ensureDir(join(startDir, '.bbai'));
			let existingConfig: ProjectConfigSchema = defaultProjectConfig;
			try {
				const content = await Deno.readTextFile(projectConfigPath);
				existingConfig = parseYaml(content) as ProjectConfigSchema;
			} catch (_) {
				// If the file doesn't exist, we'll start with an empty config
			}

			const projectConfig: ProjectConfigSchema = {
				...existingConfig,
				project: {
					...existingConfig.project as ProjectDataConfigSchema,
					name: wizardAnswers.project.name,
					type: wizardAnswers.project.type,
				},
			};

			if (wizardAnswers.anthropicApiKey) {
				if (!projectConfig.api) {
					projectConfig.api = { logLevel: 'error', userToolDirectories: [], toolConfigs: {} };
				}
				projectConfig.api.anthropicApiKey = wizardAnswers.anthropicApiKey;
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

	public async loadFullConfig(startDir: string): Promise<FullConfigSchema> {
		const globalConfig = await this.loadGlobalConfig();
		const projectConfig = await this.getProjectConfig(startDir);
		const envConfig = this.loadEnvConfig();

		// Merge configs
		const mergedConfig = mergeConfigs(globalConfig, projectConfig, envConfig) as FullConfigSchema;

		// handle resolving and merging userToolDirectories from default, project and global configs
		const globalConfigDir = await getGlobalConfigDir();
		const projectConfigDir = await getBbaiDir(startDir);

		// Resolve global tool directories - use default values if user hasn't set a value
		const resolvedGlobalToolDirs = this.resolveToolDirectories(
			globalConfig.api.userToolDirectories,
			defaultGlobalConfig.api.userToolDirectories,
			globalConfigDir,
		);

		// Resolve project tool directories - use default values if user hasn't set a value
		const resolvedProjectToolDirs = this.resolveToolDirectories(
			projectConfig.api.userToolDirectories,
			defaultProjectConfig.api.userToolDirectories,
			projectConfigDir,
		);

		// Merge and deduplicate resolved tool directories
		mergedConfig.api.userToolDirectories = [
			...new Set([
				...resolvedProjectToolDirs,
				...resolvedGlobalToolDirs,
			]),
		];

		if (!this.validateFullConfig(mergedConfig)) {
			throw new Error('Invalid full configuration');
		}

		return mergedConfig;
	}

	private resolveToolDirectories(
		userDirs: string[] | undefined,
		defaultDirs: string[],
		baseDir: string,
	): string[] {
		const dirsToResolve = userDirs && userDirs.length > 0 ? userDirs : defaultDirs;
		return dirsToResolve.map((dir) => this.resolveConfigPath(dir, baseDir));
	}

	private resolveConfigPath(path: string, baseDir: string): string {
		return path.startsWith('./') || !path.startsWith('/') ? resolve(baseDir, path) : path;
	}

	public async loadGlobalConfig(): Promise<GlobalConfigSchema> {
		const globalConfigPath = await getGlobalConfigDir();
		try {
			const content = await Deno.readTextFile(globalConfigPath);
			const globalConfig = parseYaml(content) as GlobalConfigSchema;
			globalConfig.version = VERSION;
			globalConfig.bbaiExeName = Deno.build.os === 'windows' ? 'bbai.exe' : 'bbai';
			globalConfig.bbaiApiExeName = Deno.build.os === 'windows' ? 'bbai-api.exe' : 'bbai-api';

			if (!this.validateGlobalConfig(globalConfig)) {
				throw new Error('Invalid global configuration');
			}

			return globalConfig;
		} catch (error) {
			return this.defaultGlobalConfig;
		}
	}

	public async loadProjectConfig(startDir: string): Promise<ProjectConfigSchema> {
		const projectRoot = await this.getProjectRoot(startDir);

		if (this.projectConfigs.has(projectRoot)) {
			return this.projectConfigs.get(projectRoot)!;
		}

		const projectConfigPath = join(projectRoot, '.bbai', 'config.yaml');
		try {
			const content = await Deno.readTextFile(projectConfigPath);
			const projectConfig = parseYaml(content) as ProjectConfigSchema;

			if (!this.validateProjectConfig(projectConfig)) {
				throw new Error('Invalid project configuration');
			}

			this.projectConfigs.set(projectRoot, projectConfig);
			this.projectConfigs.set(projectConfig.project.name, projectConfig);
			return projectConfig;
		} catch (error) {
			throw new Error(`Failed to load project config for ${startDir}: ${error.message}`);
		}
	}

	public async getFullConfig(startDir: string): Promise<FullConfigSchema> {
		return await this.loadFullConfig(startDir);
	}

	public async getGlobalConfig(): Promise<GlobalConfigSchema> {
		if (this.globalConfig) return this.globalConfig;
		this.globalConfig = await this.loadGlobalConfig();
		return this.globalConfig;
	}

	public async getProjectConfig(startDir: string): Promise<ProjectConfigSchema> {
		return await this.loadProjectConfig(startDir);
	}

	public async getProjectConfigByName(projectName: string): Promise<ProjectConfigSchema | null> {
		if (this.projectConfigs.has(projectName)) {
			return this.projectConfigs.get(projectName)!;
		}
		return null;
	}

	public async getExistingProjectConfig(startDir: string): Promise<Partial<ProjectConfigSchema>> {
		const projectConfigPath = join(startDir, '.bbai', 'config.yaml');
		try {
			const content = await Deno.readTextFile(projectConfigPath);
			return parseYaml(content) as ProjectConfigSchema;
		} catch (_) {
			return {};
		}
	}

	private async getProjectRoot(startDir: string): Promise<string> {
		if (!this.projectRoots.has(startDir)) {
			try {
				const root = await getProjectRoot(startDir);
				this.projectRoots.set(startDir, root);
			} catch (error) {
				throw error;
			}
		}
		return this.projectRoots.get(startDir)!;
	}

	private loadEnvConfig(): Partial<FullConfigSchema> {
		const envConfig: Partial<FullConfigSchema> = {};
		// 		const apiConfig: Partial<FullConfigSchema['api']> = { logLevel: 'info', usePromptCaching: true };// , userToolDirectories: [], toolConfigs: {}
		const apiConfig: FullConfigSchema['api'] = {
			logLevel: 'info',
			usePromptCaching: true,
			userToolDirectories: [],
			toolConfigs: {},
		};
		const buiConfig: FullConfigSchema['bui'] = {};
		const cliConfig: Partial<FullConfigSchema['cli']> = {};

		// API config options
		const environment = Deno.env.get('BBAI_ENVIRONMENT');
		if (environment) apiConfig.environment = environment;

		const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');
		if (anthropicApiKey) apiConfig.anthropicApiKey = anthropicApiKey;

		const apiHostname = Deno.env.get('BBAI_API_HOSTNAME');
		if (apiHostname) apiConfig.apiHostname = apiHostname;

		const apiPort = Deno.env.get('BBAI_API_PORT');
		if (apiPort) apiConfig.apiPort = parseInt(apiPort, 10);

		const apiUseTls = Deno.env.get('BBAI_API_USE_TLS');
		if (apiUseTls) apiConfig.apiUseTls = !!apiUseTls;

		const ignoreLLMRequestCache = Deno.env.get('BBAI_IGNORE_LLM_REQUEST_CACHE');
		if (ignoreLLMRequestCache) apiConfig.ignoreLLMRequestCache = ignoreLLMRequestCache === 'true';

		const apiLogFile = Deno.env.get('BBAI_API_LOG_FILE');
		if (apiLogFile) apiConfig.logFile = apiLogFile;

		const apiLogLevel = Deno.env.get('BBAI_API_LOG_LEVEL');
		if (apiLogLevel) apiConfig.logLevel = apiLogLevel as 'debug' | 'info' | 'warn' | 'error';

		const usePromptCaching = Deno.env.get('BBAI_USE_PROMPT_CACHING');
		if (usePromptCaching) apiConfig.usePromptCaching = usePromptCaching === 'true';

		// BUI config options
		if (environment) buiConfig.environment = environment;

		const buiHostname = Deno.env.get('BBAI_BUI_HOSTNAME');
		if (buiHostname) buiConfig.buiHostname = buiHostname;

		const buiPort = Deno.env.get('BBAI_BUI_PORT');
		if (buiPort) buiConfig.buiPort = parseInt(buiPort, 10);

		const buiUseTls = Deno.env.get('BBAI_BUI_USE_TLS');
		if (buiUseTls) buiConfig.buiUseTls = !!buiUseTls;

		// CLI config options
		if (environment) cliConfig.environment = environment;

		if (Object.keys(apiConfig).length > 0) {
			envConfig.api = apiConfig;
		}

		if (Object.keys(buiConfig).length > 0) {
			envConfig.bui = buiConfig;
		}

		if (Object.keys(cliConfig).length > 0) {
			envConfig.cli = cliConfig;
		}

		return envConfig;
	}

	public async getRedactedFullConfig(startDir: string): Promise<FullConfigSchema> {
		const fullConfig = await this.loadFullConfig(startDir);
		//const fullConfig = JSON.parse(JSON.stringify(await this.loadFullConfig(startDir)));
		const redactedConfig = this.redactSensitiveInfo(fullConfig);
		return redactedConfig as FullConfigSchema;
	}

	private redactSensitiveInfo(obj: Record<string, any>): Record<string, any> {
		const redactedObj: Record<string, any> = {};

		for (const [key, value] of Object.entries(obj)) {
			if (typeof value === 'object' && value !== null) {
				redactedObj[key] = this.redactSensitiveInfo(value as Record<string, unknown>);
			} else if (typeof value === 'string' && this.isSensitiveKey(key)) {
				redactedObj[key] = '[REDACTED]';
			} else {
				redactedObj[key] = value;
			}
		}

		return redactedObj;
	}

	private isSensitiveKey(key: string): boolean {
		const sensitivePatterns = [
			/api[_-]?key/i,
			/secret/i,
			/password/i,
			/token/i,
			/credential/i,
		];
		return sensitivePatterns.some((pattern) => pattern.test(key));
	}

	public async setGlobalConfigValue(key: string, value: string): Promise<void> {
		const keys = key.split('.');
		let current: any = await this.loadGlobalConfig();
		for (let i = 0; i < keys.length - 1; i++) {
			if (!current[keys[i]]) current[keys[i]] = {};
			current = current[keys[i]];
		}
		current[keys[keys.length - 1]] = value;

		if (!this.validateGlobalConfig(current)) {
			throw new Error('Invalid global configuration after setting value');
		}

		await this.saveGlobalConfig(current);
	}

	public async getGlobalConfigValue(key: string): Promise<string | undefined> {
		const keys = key.split('.');
		let current: any = await this.loadGlobalConfig();
		for (const k of keys) {
			if (current[k] === undefined) return undefined;
			current = current[k];
		}
		return current;
	}

	private async saveGlobalConfig(fullConfig: GlobalConfigSchema): Promise<void> {
		const globalConfigPath = join(Deno.env.get('HOME') || '', '.config', 'bbai', 'config.yaml');
		try {
			await Deno.writeTextFile(globalConfigPath, stringifyYaml(fullConfig));
		} catch (error) {
			throw error;
		}
	}

	private validateFullConfig(config: Partial<FullConfigSchema>): boolean {
		if (!this.validateGlobalConfig(config)) return false;
		if (!this.validateProjectConfig(config)) return false;
		if (!Array.isArray(config.api?.userToolDirectories)) return false;
		return true;
	}

	private validateGlobalConfig(globalConfig: Partial<GlobalConfigSchema>): boolean {
		if (!globalConfig.api || typeof globalConfig.api !== 'object') return false;
		if (!globalConfig.cli || typeof globalConfig.cli !== 'object') return false;
		if (typeof globalConfig.version !== 'string') return false;
		if (globalConfig.api.usePromptCaching !== undefined && typeof globalConfig.api.usePromptCaching !== 'boolean') {
			return false;
		}
		//if (!Array.isArray(globalConfig.api.userToolDirectories)) return false;
		return true;
	}

	private validateProjectConfig(projectConfig: Partial<ProjectConfigSchema>): boolean {
		if (!projectConfig.project || typeof projectConfig.project !== 'object') return false;
		if (typeof projectConfig.project.name !== 'string') return false;
		if (projectConfig.project.type !== 'git' && projectConfig.project.type !== 'local') return false;
		//if (!Array.isArray(projectConfig.api.userToolDirectories)) return false;
		return true;
	}
}
