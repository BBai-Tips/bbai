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
      args: ["run", "--allow-read", "--allow-write", "--allow-env", "--allow-net", "../api/src/main.ts"],
      cwd: "../api",
      stdout: "null",
      stderr: "null",
      stdin: "null",
    });

    const process = command.spawn();

    // Wait a short time to ensure the process has started
    await new Promise(resolve => setTimeout(resolve, 1000));

    const pid = process.pid;
    await savePid(pid);

    logger.info(`bbai API server started with PID: ${pid}`);
    logger.info("Use 'bbai stop-api' to stop the server.");

    // Detach the process and return immediately
    Deno.unrefTimer(setTimeout(() => {}, 0));
  });
