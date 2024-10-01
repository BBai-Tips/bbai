import { simpleMerge } from '@cross/deepmerge';

export interface ApiConfigSchema {
	anthropicApiKey?: string;
	openaiApiKey?: string;
	voyageaiApiKey?: string;
	environment?: string;
	apiHostname?: string;
	apiPort?: number;
	apiUseTls?: boolean;
	tlsKeyFile?: string;
	tlsCertFile?: string;
	tlsRootCaFile?: string;
	tlsKeyPem?: string;
	tlsCertPem?: string;
	tlsRootCaPem?: string;
	ignoreLLMRequestCache?: boolean;
	usePromptCaching?: boolean;
	logFile?: string;
	logLevel: 'debug' | 'info' | 'warn' | 'error';
}
export interface BuiConfigSchema {
	environment?: string;
	buiHostname?: string;
	buiPort?: number;
	buiUseTls?: boolean;
	tlsKeyFile?: string;
	tlsCertFile?: string;
	tlsRootCaFile?: string;
	tlsKeyPem?: string;
	tlsCertPem?: string;
	tlsRootCaPem?: string;
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
	bui: BuiConfigSchema;
	cli: Record<string, unknown>;
	project: ProjectDataConfigSchema;
	repoInfo: RepoInfoConfigSchema;
	version: string;
	bbaiExeName: string;
	bbaiApiExeName: string;
}

export interface ProjectConfigSchema {
	myPersonsName?: string;
	myAssistantsName?: string;
	noBrowser?: boolean;
	project: ProjectDataConfigSchema;
	repoInfo: RepoInfoConfigSchema;
	api: ApiConfigSchema;
	bui: BuiConfigSchema;
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
		apiUseTls: true,
		ignoreLLMRequestCache: false,
		usePromptCaching: true,
		logFile: 'api.log',
		logLevel: 'info',
	},
	bui: {
		environment: 'local',
		buiHostname: 'localhost',
		buiPort: 8000,
		buiUseTls: true,
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
	version: 'unknown', // This will be overwritten by the actual version from version.ts
	bbaiExeName: 'bbai', // This will be overwritten by the correct exe name when creating globalConfig
	bbaiApiExeName: 'bbai-api', // This will be overwritten by the correct exe name when creating globalConfig
};

export const defaultProjectConfig: ProjectConfigSchema = {
	myPersonsName: Deno.env.get('USER') || 'User',
	myAssistantsName: 'Claude',
	noBrowser: false,
	api: {
		environment: 'local',
		apiHostname: 'localhost',
		apiPort: 3000,
		apiUseTls: true,
		ignoreLLMRequestCache: false,
		usePromptCaching: true,
		logFile: 'api.log',
		logLevel: 'info',
	},
	bui: {
		environment: 'local',
		buiHostname: 'localhost',
		buiPort: 8000,
		buiUseTls: true,
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
