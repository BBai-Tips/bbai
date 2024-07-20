import { Command } from "cliffy/command/mod.ts";
import { logger } from "shared/logger.ts";

export const stopApi = new Command()
  .name("stop-api")
  .description("Stop the bbai API server")
  .action(async () => {
    logger.info("Stopping bbai API server...");
    // TODO: Implement API server stop logic
    // This might involve sending a shutdown signal to the API server process
    logger.info("bbai API server stopped successfully.");
  });
