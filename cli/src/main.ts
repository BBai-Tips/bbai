import { Command } from "cliffy/command/mod.ts";
import { logger } from "shared/logger.ts";
import { ConfigManager } from "shared/config/configManager.ts";
import { addFiles } from "./commands/addFiles.ts";
import { removeFiles } from "./commands/removeFiles.ts";
import { listFiles } from "./commands/listFiles.ts";
import { startConversation } from "./commands/startConversation.ts";
import { continueConversation } from "./commands/continueConversation.ts";
import { clearConversation } from "./commands/clearConversation.ts";
import { requestChanges } from "./commands/requestChanges.ts";
import { undoLastChange } from "./commands/undoLastChange.ts";
import { showTokenUsage } from "./commands/showTokenUsage.ts";
import { runCommand } from "./commands/runCommand.ts";
import { loadExternalContent } from "./commands/loadExternalContent.ts";
import { viewLogs } from "./commands/viewLogs.ts";
import { persistConversation } from "./commands/persistConversation.ts";
import { resumeConversation } from "./commands/resumeConversation.ts";
import { startApi } from "./commands/startApi.ts";
import { stopApi } from "./commands/stopApi.ts";
import { apiStatus } from "./commands/apiStatus.ts";

const configManager = await ConfigManager.getInstance();
const config = configManager.getConfig();

logger.debug("CLI Config:", config.cli);

const cli = new Command()
  .name("bbai")
  .version("0.1.0")
  .description("CLI tool for bbai project")
  .command("add", addFiles)
  .command("remove", removeFiles)
  .command("list", listFiles)
  .command("start", startConversation)
  .command("continue", continueConversation)
  .command("clear", clearConversation)
  .command("request", requestChanges)
  .command("undo", undoLastChange)
  .command("usage", showTokenUsage)
  .command("run", runCommand)
  .command("load", loadExternalContent)
  .command("logs", viewLogs)
  .command("persist", persistConversation)
  .command("resume", resumeConversation)
  .command("start-api", startApi)
  .command("stop-api", stopApi)
  .command("api-status", apiStatus);

if (import.meta.main) {
  await cli.parse(Deno.args);
}
