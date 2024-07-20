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
      stdout: "null",
      stderr: "null",
      stdin: "null",
    });

    const process = command.spawn();

    await savePid(process.pid);

    logger.info(`bbai API server started with PID: ${process.pid}`);
    logger.info("Use 'bbai stop-api' to stop the server.");

    // Detach the process
    Deno.unrefTimer(setTimeout(() => {}, 0));

    // Return immediately, allowing the CLI to exit
  });
