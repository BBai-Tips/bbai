import { Command } from "cliffy/command/mod.ts";
import { logger } from "shared/logger.ts";
import { isApiRunning, getPid } from "../utils/pid.utils.ts";

export const apiStatus = new Command()
  .name("api-status")
  .description("Check the status of the bbai API server")
  .action(async () => {
    const running = await isApiRunning();
    
    if (!running) {
      logger.info("bbai API server is not running.");
      return;
    }

    const pid = await getPid();
    logger.info(`bbai API server is running with PID: ${pid}`);

    try {
      const response = await fetch("http://localhost:8000/api/v1/status");
      
      if (response.ok) {
        const status = await response.json();
        logger.info(`API Status: ${status.status}`);
        logger.info(`Uptime: ${status.uptime}`);
        logger.info(`Memory Usage: ${status.memoryUsage}`);
      } else {
        logger.error(`Failed to get detailed API status: ${response.statusText}`);
      }
    } catch (error) {
      logger.error(`Error fetching detailed API status: ${error.message}`);
    }
  });
