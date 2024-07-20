import { Command } from "cliffy/command/mod.ts";
import { logger } from "shared/logger.ts";
import { savePid, isApiRunning } from "../utils/pid.utils.ts";
import { getBbaiDir } from "shared/dataDir.ts";
import { join } from "@std/path";

export const apiStart = new Command()
  .name("start-api")
  .description("Start the bbai API server")
  .action(async () => {
    if (await isApiRunning()) {
      logger.info("bbai API server is already running.");
      return;
    }

    logger.info("Starting bbai API server...");
    
    const bbaiDir = await getBbaiDir();
    const logFile = join(bbaiDir, "api.log");

    const command = new Deno.Command("deno", {
      args: ["run", "--allow-read", "--allow-write", "--allow-env", "--allow-net", "--allow-run", "../api/src/main.ts", logFile],
      cwd: "../api",
      stdout: "null",
      stderr: "null",
      stdin: "null",
      detached: true,
    });

    const process = command.spawn();

    // Wait a short time to ensure the process has started
    await new Promise(resolve => setTimeout(resolve, 1000));

    const pid = process.pid;
    await savePid(pid);

    logger.info(`bbai API server started with PID: ${pid}`);
    logger.info(`Logs are being written to: ${logFile}`);
    logger.info("Use 'bbai stop-api' to stop the server.");
  });
