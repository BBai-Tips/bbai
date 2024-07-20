const logLevels = ["debug", "info", "warn", "error"] as const;
type LogLevel = typeof logLevels[number];

class Logger {
  private level: LogLevel = "info";

  setLevel(level: LogLevel) {
    this.level = level;
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
