import { simpleMerge } from '@cross/deepmerge';

export interface ConfigSchema {
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
	cli: {};
	repoInfo: {
		ctagsAutoGenerate: boolean;
		ctagsFilePath?: string;
		tokenLimit?: number;
	};
	myPersonsName?: string;
	myAssistantsName?: string;
	version: string;
}

export const defaultConfig: ConfigSchema = {
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
		//ctagsFilePath: 'tags',
		tokenLimit: 1024,
	},
	myPersonsName: Deno.env.get('USER') || 'User',
	myAssistantsName: 'Claude',
	version: 'unknown', // This will be overwritten by the actual version from version.ts
};

export function mergeConfigs(...configs: Partial<ConfigSchema>[]): ConfigSchema {
	const mergedConfig = simpleMerge(defaultConfig, ...configs);
	return mergedConfig as ConfigSchema;
}
