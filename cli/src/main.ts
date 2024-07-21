import { Command } from 'cliffy/command/mod.ts';
import { logger } from 'shared/logger.ts';
import { config } from 'shared/configManager.ts';

import { apiStart } from './commands/apiStart.ts';
import { apiStop } from './commands/apiStop.ts';
import { apiStatus } from './commands/apiStatus.ts';
import { conversationStart } from './commands/conversationStart.ts';
import { conversationContinue } from './commands/conversationContinue.ts';
import { conversationClear } from './commands/conversationClear.ts';
import { conversationPersist } from './commands/conversationPersist.ts';
import { conversationResume } from './commands/conversationResume.ts';
import { filesAdd } from './commands/filesAdd.ts';
import { filesRemove } from './commands/filesRemove.ts';
import { filesList } from './commands/filesList.ts';
import { requestChanges } from './commands/requestChanges.ts';
import { undoLastChange } from './commands/undoLastChange.ts';
import { showTokenUsage } from './commands/showTokenUsage.ts';
import { runCommand } from './commands/runCommand.ts';
import { loadExternalContent } from './commands/loadExternalContent.ts';
import { viewLogs } from './commands/viewLogs.ts';

//logger.debug('CLI Config:', config.cli);

const cli = new Command()
	.name('bbai')
	.version('0.1.0')
	.description('CLI tool for bbai project')
	.command('add', filesAdd)
	.command('remove', filesRemove)
	.command('list', filesList)
	.command('chat', conversationStart)
	.command('continue', conversationContinue)
	.command('clear', conversationClear)
	.command('request', requestChanges)
	.command('undo', undoLastChange)
	.command('usage', showTokenUsage)
	.command('run', runCommand)
	.command('load', loadExternalContent)
	.command('logs', viewLogs)
	.command('persist', conversationPersist)
	.command('resume', conversationResume)
	.command('start', apiStart)
	.command('stop', apiStop)
	.command('status', apiStatus);

export const main = async () => {
	await cli.parse(Deno.args);
};

if (import.meta.main) {
	main();
}
