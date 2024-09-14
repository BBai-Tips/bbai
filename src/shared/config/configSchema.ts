import { simpleMerge } from '@cross/deepmerge';

export interface ApiConfigSchema {
	anthropicApiKey?: string;
	openaiApiKey?: string;
	voyageaiApiKey?: string;
	environment?: string;
	apiHostname?: string;
	apiPort?: number;
	ignoreLLMRequestCache?: boolean;
	logFile?: string;
	logLevel: 'debug' | 'info' | 'warn' | 'error';
}
export interface RepoInfoConfigSchema {
	ctagsAutoGenerate: boolean;
	ctagsFilePath?: string;
	tokenLimit?: number;
}
export interface ProjectDataConfigSchema {
	name: string;
	type: 'local' | 'git';
	llmGuidelinesFile?: string;
}

export interface GlobalConfigSchema {
	myPersonsName?: string;
	myAssistantsName?: string;
	noBrowser?: boolean;
	api: ApiConfigSchema;
	cli: Record<string, unknown>;
	repoInfo: RepoInfoConfigSchema;
	version: string;
}

export interface ProjectConfigSchema {
	myPersonsName?: string;
	myAssistantsName?: string;
	noBrowser?: boolean;
	project: ProjectDataConfigSchema;
	repoInfo: RepoInfoConfigSchema;
	api: ApiConfigSchema;
	cli: Record<string, unknown>;
}

export interface FullConfigSchema extends GlobalConfigSchema, ProjectConfigSchema {}

export const defaultGlobalConfig: GlobalConfigSchema = {
	myPersonsName: Deno.env.get('USER') || 'User',
	myAssistantsName: 'Claude',
	noBrowser: false,
	api: {
		environment: 'local',
		apiHostname: 'localhost',
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
	myPersonsName: Deno.env.get('USER') || 'User',
	myAssistantsName: 'Claude',
	noBrowser: false,
	api: {
		environment: 'local',
		apiHostname: 'localhost',
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
	project: {
		name: Deno.cwd(),
		type: 'local',
	},
};

export function mergeConfigs(...configs: Partial<FullConfigSchema>[]): FullConfigSchema {
	const mergedConfig = simpleMerge(defaultGlobalConfig as unknown, defaultProjectConfig, ...configs);
	return mergedConfig as FullConfigSchema;
}
