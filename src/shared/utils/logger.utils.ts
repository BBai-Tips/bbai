import { ConfigManager } from 'shared/configManager.ts';

const logLevels = ["debug", "info", "warn", "error"] as const;
type LogLevel = typeof logLevels[number];

function getLogLevel(): LogLevel {
  const envLogLevel = Deno.env.get("LOG_LEVEL");
  if (envLogLevel && logLevels.includes(envLogLevel as LogLevel)) {
    return envLogLevel as LogLevel;
  }

  const configManager = ConfigManager.getInstance();
  const config = configManager.getConfig();
  if (config.logLevel && logLevels.includes(config.logLevel as LogLevel)) {
    return config.logLevel as LogLevel;
  }

  return "info";
}

const currentLogLevel = getLogLevel();

export const logger = {
  debug: (message: string, ...args: unknown[]) => {
    if (logLevels.indexOf("debug") >= logLevels.indexOf(currentLogLevel)) {
      console.debug(message, ...args);
    }
  },
  info: (message: string, ...args: unknown[]) => {
    if (logLevels.indexOf("info") >= logLevels.indexOf(currentLogLevel)) {
      console.info(message, ...args);
    }
  },
  warn: (message: string, ...args: unknown[]) => {
    if (logLevels.indexOf("warn") >= logLevels.indexOf(currentLogLevel)) {
      console.warn(message, ...args);
    }
  },
  error: (message: string, ...args: unknown[]) => {
    if (logLevels.indexOf("error") >= logLevels.indexOf(currentLogLevel)) {
      console.error(message, ...args);
    }
  },
};
