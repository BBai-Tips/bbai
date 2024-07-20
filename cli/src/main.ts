import { Command } from "cliffy/command/mod.ts";
import { logger } from "./utils/logger.ts";

const cli = new Command()
  .name("bbai")
  .version("0.1.0")
  .description("CLI tool for bbai project")
  .action(() => {
    logger.info("Hello from bbai CLI!");
  });

await cli.parse(Deno.args);
