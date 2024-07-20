import { Command } from "cliffy/command/mod.ts";
import { logger } from "shared/logger.ts";

export const startApi = new Command()
  .name("start-api")
  .description("Start the bbai API server")
  .action(async () => {
    logger.info("Starting bbai API server...");
    // TODO: Implement API server start logic
    // This might involve spawning a new Deno process to run the API server
    logger.info("bbai API server started successfully.");
  });
