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
    const mergedConfig = { ...acc } as ConfigSchema;

    for (const [key, value] of Object.entries(config)) {
      if (value !== undefined) {
        if (typeof value === 'object' && value !== null) {
          mergedConfig[key] = {
            ...(mergedConfig[key] || {}),
            ...Object.fromEntries(
              Object.entries(value).filter(([_, v]) => v !== undefined)
            ),
          };
        } else {
          mergedConfig[key] = value;
        }
      }
    }

    return mergedConfig;
  }, { api: {}, cli: {} } as ConfigSchema);
}

