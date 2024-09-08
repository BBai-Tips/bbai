import { simpleMerge } from '@cross/deepmerge';

export interface GlobalConfigSchema {
	myPersonsName?: string;
	myAssistantsName?: string;
	api: {
		anthropicApiKey?: string;
		openaiApiKey?: string;
		voyageaiApiKey?: string;
		environment?: string;
		apiPort?: number;
		ignoreLLMRequestCache?: boolean;
		logFile?: string;
		logLevel: 'debug' | 'info' | 'warn' | 'error';
	};
	cli: Record<string, unknown>;
	repoInfo: {
		ctagsAutoGenerate: boolean;
		ctagsFilePath?: string;
		tokenLimit?: number;
	};
	version: string;
}

export interface ProjectConfigSchema {
	project: {
		name: string;
		type: 'local' | 'git';
		llmGuidelinesFile?: string;
	};
}

export interface ConfigSchema extends GlobalConfigSchema, ProjectConfigSchema {}

export const defaultGlobalConfig: GlobalConfigSchema = {
	myPersonsName: Deno.env.get('USER') || 'User',
	myAssistantsName: 'Claude',
	api: {
		environment: 'local',
		apiPort: 3000,
		ignoreLLMRequestCache: false,
		logFile: 'api.log',
		logLevel: 'info',
	},
	cli: {},
	repoInfo: {
		ctagsAutoGenerate: true,
		tokenLimit: 1024,
	},
	version: 'unknown', // This will be overwritten by the actual version from version.ts
};

export const defaultProjectConfig: ProjectConfigSchema = {
	project: {
		name: Deno.cwd(),
		type: 'local',
	},
};

export function mergeConfigs(...configs: Partial<ConfigSchema>[]): ConfigSchema {
	const mergedConfig = simpleMerge(defaultGlobalConfig as unknown, defaultProjectConfig, ...configs);
	return mergedConfig as ConfigSchema;
}
