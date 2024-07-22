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
	ctags: {
		autoGenerate: boolean;
		tagsFilePath?: string;
	};
	logFile?: string;
	logLevel: 'debug' | 'info' | 'warn' | 'error';
	myPersonsName?: string;
}

export const defaultConfig: ConfigSchema = {
	api: {
		environment: 'local',
		apiPort: 3000,
		ignoreLLMRequestCache: false,
	},
	cli: {},
	ctags: {
		autoGenerate: true,
		//tagsFilePath: 'tags',
	},
	logFile: 'api.log',
	logLevel: 'info',
};

export function mergeConfigs(...configs: Partial<ConfigSchema>[]): ConfigSchema {
	const mergedConfig = simpleMerge(defaultConfig, ...configs);
	return mergedConfig as ConfigSchema;
}
