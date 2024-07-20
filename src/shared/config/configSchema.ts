export interface ConfigSchema {
  api: {
    anthropicApiKey: string;
    openaiApiKey: string;
    environment: string;
    appPort: number;
    ignoreLLMRequestCache: boolean;
  };
  cli: {
    // Add CLI-specific configuration options here
  };
  // Add shared configuration options here
}

export function mergeConfigs(...configs: Partial<ConfigSchema>[]): ConfigSchema {
  return configs.reduce((acc, config) => {
    return {
      api: { ...acc.api, ...config.api },
      cli: { ...acc.cli, ...config.cli },
      ...Object.entries(config).reduce((innerAcc, [key, value]) => {
        if (key !== 'api' && key !== 'cli') {
          innerAcc[key] = value;
        }
        return innerAcc;
      }, {} as Partial<ConfigSchema>),
    };
  }, { api: {}, cli: {} } as ConfigSchema);
}
