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
      args: ["run", "--allow-read", "--allow-write", "--allow-env", "--allow-net", "--allow-run", "../api/src/main.ts"],
      cwd: "../api",
      stdout: "piped",
      stderr: "piped",
      stdin: "null",
      detached: true,
    });

    const process = command.spawn();

    // Redirect stdout and stderr to the log file
    const logStream = await Deno.open(logFile, { write: true, create: true, append: true });
    const encoder = new TextEncoder();
    
    (async () => {
      for await (const chunk of process.stdout) {
        await logStream.write(chunk);
      }
    })();

    (async () => {
      for await (const chunk of process.stderr) {
        await logStream.write(encoder.encode(`[ERROR] ${new TextDecoder().decode(chunk)}`));
      }
    })();

    // Wait a short time to ensure the process has started
    await new Promise(resolve => setTimeout(resolve, 1000));

    const pid = process.pid;
    await savePid(pid);

    logger.info(`bbai API server started with PID: ${pid}`);
    logger.info(`Logs are being written to: ${logFile}`);
    logger.info("Use 'bbai stop-api' to stop the server.");
  });
