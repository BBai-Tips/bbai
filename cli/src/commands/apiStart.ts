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
    
    const process = Deno.run({
      cmd: ["deno", "task", "start"],
      cwd: "../api",
      stdout: "piped",
      stderr: "piped",
    });

    await savePid(process.pid);

    logger.info(`bbai API server started with PID: ${process.pid}`);
    logger.info("Use 'bbai stop-api' to stop the server.");

    // We don't wait for the process to complete
    // Instead, we detach it and let it run in the background
    process.stdout.pipeTo(Deno.stdout.writable);
    process.stderr.pipeTo(Deno.stderr.writable);
  });
