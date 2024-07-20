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
    const mergedConfig: ConfigSchema = { ...acc };

    for (const [key, value] of Object.entries(config)) {
      if (typeof value === 'object' && value !== null) {
        mergedConfig[key] = {
          ...(mergedConfig[key] || {}),
          ...value,
        };
      } else {
        mergedConfig[key] = value;
      }
    }

    return mergedConfig;
  }, { api: {}, cli: {} } as ConfigSchema);
}
