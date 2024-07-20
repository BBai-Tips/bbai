// import { logger } from 'shared/logger.ts';

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


// export function mergeConfigs<T>(...objects: Partial<T>[]): T {
// //   logger.debug(objects);
//   return objects.reduce((result, obj) => {
//     Object.keys(obj).forEach(key => {
//       const value = obj[key];
//       if (Array.isArray(value)) {
//         result[key] = (result[key] || []).concat(value);
//       } else if (isObject(value) && isObject(result[key])) {
//         result[key] = mergeConfigs(result[key], value);
//       } else {
//         result[key] = value;
//       }
//     });
//     return result;
//   }, {}) as T;
// }
// 
// function isObject(item: any): item is Record<string, any> {
//   return item && typeof item === 'object' && !Array.isArray(item);
// }
