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
		const mergedConfig = { ...acc };

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
				};
			} else if (typeof value === 'object' && value !== null) {
				mergedConfig[key as keyof ConfigSchema] = {
					...mergedConfig[key as keyof ConfigSchema],
					...Object.fromEntries(
						Object.entries(value).filter(([_, v]) => v !== undefined)
					),
				};
			} else {
				mergedConfig[key as keyof ConfigSchema] = value;
			}
		}

		return mergedConfig;
	}, defaultConfig);
}
