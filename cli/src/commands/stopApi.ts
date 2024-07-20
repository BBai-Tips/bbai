import { Command } from "cliffy/command/mod.ts";
import { logger } from "shared/logger.ts";

export const stopApi = new Command()
  .name("stop-api")
  .description("Stop the bbai API server")
  .action(async () => {
    logger.info("Stopping bbai API server...");
    
    try {
      const response = await fetch("http://localhost:8000/api/v1/shutdown", {
        method: "POST",
      });

      if (response.ok) {
        logger.info("bbai API server stopped successfully.");
      } else {
        logger.error(`Failed to stop bbai API server: ${response.statusText}`);
      }
    } catch (error) {
      logger.error(`Error stopping bbai API server: ${error.message}`);
    }
  });
