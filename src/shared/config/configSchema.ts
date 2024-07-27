import { simpleMerge } from '@cross/deepmerge';

export interface ConfigSchema {
	api: {
		anthropicApiKey?: string;
		openaiApiKey?: string;
		voyageaiApiKey?: string;
		environment?: string;
		apiPort?: number;
		ignoreLLMRequestCache?: boolean;
	};
	cli: {};
	repoInfo: {
		ctagsAutoGenerate: boolean;
		ctagsFilePath?: string;
		tokenLimit?: number;
	};
	logFile?: string;
	logLevel: 'debug' | 'info' | 'warn' | 'error';
	myPersonsName?: string;
	version: string;
}

export const defaultConfig: ConfigSchema = {
	api: {
		environment: 'local',
		apiPort: 3000,
		ignoreLLMRequestCache: false,
	},
	cli: {},
	repoInfo: {
		ctagsAutoGenerate: true,
		//ctagsFilePath: 'tags',
		tokenLimit: 1024,
	},
	logFile: 'api.log',
	logLevel: 'info',
	version: 'unknown', // This will be overwritten by the actual version from version.ts
};

export function mergeConfigs(...configs: Partial<ConfigSchema>[]): ConfigSchema {
	const mergedConfig = simpleMerge(defaultConfig, ...configs);
	return mergedConfig as ConfigSchema;
}
