import { ConfigManager } from 'shared/configManager.ts';

const logLevels = ["debug", "info", "warn", "error"] as const;
type LogLevel = typeof logLevels[number];

class Logger {
  private level: LogLevel;

  constructor() {
    this.level = this.getLogLevel();
  }

  private getLogLevel(): LogLevel {
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

  private log(level: LogLevel, message: string, ...args: unknown[]) {
    if (logLevels.indexOf(level) >= logLevels.indexOf(this.level)) {
      console[level](message, ...args);
    }
  }

  debug(message: string, ...args: unknown[]) {
    this.log("debug", message, ...args);
  }

  info(message: string, ...args: unknown[]) {
    this.log("info", message, ...args);
  }

  warn(message: string, ...args: unknown[]) {
    this.log("warn", message, ...args);
  }

  error(message: string, ...args: unknown[]) {
    this.log("error", message, ...args);
  }
}

export const logger = new Logger();
