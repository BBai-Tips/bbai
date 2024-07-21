export interface ConfigSchema {
	api: {
		anthropicApiKey?: string;
		openaiApiKey?: string;
		environment: string;
		apiPort: number;
		ignoreLLMRequestCache?: boolean;
	};
	cli: {
	};
	logFile?: string;
	logLevel: 'debug' | 'info' | 'warn' | 'error';
}

export const defaultConfig: ConfigSchema = {
	api: {
		environment: 'local',
		apiPort: 3000,
		ignoreLLMRequestCache: false,
	},
	cli: {
	},
	logFile: 'api.log',
	logLevel: 'info',
};

export function mergeConfigs(...configs: Partial<ConfigSchema>[]): ConfigSchema {
    return configs.reduce((acc, config) => {
        const mergedConfig = { ...acc } as ConfigSchema;

        for (const [key, value] of Object.entries(config)) {
            if (value === undefined) continue;

            if (key === 'cli' || key === 'api') {
                mergedConfig[key] = {
                    ...mergedConfig[key],
                    ...(typeof value === 'object' && value !== null
                        ? Object.fromEntries(
                            Object.entries(value).filter(([_, v]) => v !== undefined)
                        )
                        : {}),
                } as ConfigSchema[typeof key];
                // Ensure required properties are set
                if (key === 'api') {
                    mergedConfig.api.environment = mergedConfig.api.environment || defaultConfig.api.environment;
                    mergedConfig.api.apiPort = mergedConfig.api.apiPort || defaultConfig.api.apiPort;
                }
                if (key === 'api' && !mergedConfig.api.environment) {
                    mergedConfig.api.environment = defaultConfig.api.environment;
                }
                if (key === 'api' && !mergedConfig.api.apiPort) {
                    mergedConfig.api.apiPort = defaultConfig.api.apiPort;
                }
            } else if (typeof value === 'object' && value !== null) {
                (mergedConfig[key as keyof ConfigSchema] as any) = {
                    ...(mergedConfig[key as keyof ConfigSchema] as object),
                    ...Object.fromEntries(
                        Object.entries(value as object).filter(([_, v]) => v !== undefined)
                    ),
                };
            } else if (key === 'logLevel' && typeof value === 'string') {
                mergedConfig.logLevel = value as 'debug' | 'info' | 'warn' | 'error';
            } else {
                (mergedConfig as any)[key] = value;
            }
        }

        return mergedConfig as ConfigSchema;
    }, { ...defaultConfig } as ConfigSchema);
}
