import { Command } from "cliffy/command/mod.ts";
import { logger } from "shared/logger.ts";

export const startApi = new Command()
  .name("start-api")
  .description("Start the bbai API server")
  .action(async () => {
    logger.info("Starting bbai API server...");
    
    const process = Deno.run({
      cmd: ["deno", "task", "start"],
      cwd: "../api",
      stdout: "piped",
      stderr: "piped",
    });

    const { code } = await process.status();

    if (code === 0) {
      logger.info("bbai API server started successfully.");
    } else {
      const rawError = await process.stderrOutput();
      const errorString = new TextDecoder().decode(rawError);
      logger.error(`Failed to start bbai API server: ${errorString}`);
    }

    process.close();
  });
