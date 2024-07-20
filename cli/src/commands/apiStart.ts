import { Command } from "cliffy/command/mod.ts";
import { logger } from "shared/logger.ts";
import { savePid, isApiRunning } from "../utils/pid.utils.ts";

export const apiStart = new Command()
  .name("start-api")
  .description("Start the bbai API server")
  .action(async () => {
    if (await isApiRunning()) {
      logger.info("bbai API server is already running.");
      return;
    }

    logger.info("Starting bbai API server...");
    
    const command = new Deno.Command("deno", {
      args: ["task", "start"],
      cwd: "../api",
      stdout: "piped",
      stderr: "piped",
    });

    const process = command.spawn();

    await savePid(process.pid);

    logger.info(`bbai API server started with PID: ${process.pid}`);
    logger.info("Use 'bbai stop-api' to stop the server.");

    // Start a background task to handle output
    (async () => {
      const output = await process.output();
      if (output.success) {
        logger.info("API server exited successfully");
      } else {
        logger.error("API server exited with an error");
      }
    })();

    // Return immediately, allowing the CLI to exit
  });
