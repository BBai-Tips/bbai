import { Command } from "cliffy/command/mod.ts";
import { logger } from "shared/logger.ts";

export const apiStatus = new Command()
  .name("api-status")
  .description("Check the status of the bbai API server")
  .action(async () => {
    try {
      const response = await fetch("http://localhost:8000/api/v1/status");
      
      if (response.ok) {
        const status = await response.json();
        logger.info(`API Status: ${status.status}`);
        logger.info(`Uptime: ${status.uptime}`);
        logger.info(`Memory Usage: ${status.memoryUsage}`);
      } else {
        logger.error(`Failed to get API status: ${response.statusText}`);
      }
    } catch (error) {
      logger.error(`Error checking API status: ${error.message}`);
      logger.info("The API server might not be running.");
    }
  });
