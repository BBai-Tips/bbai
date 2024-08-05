import { Command } from 'cliffy/command/mod.ts';
//import { logger } from 'shared/logger.ts';
import { config } from 'shared/configManager.ts';

import { apiStart } from './commands/apiStart.ts';
import { apiStop } from './commands/apiStop.ts';
import { apiStatus } from './commands/apiStatus.ts';
import { apiRestart } from './commands/apiRestart.ts';
import { conversationStart } from './commands/conversationStart.ts';
//import { undoLastChange } from './commands/undoLastChange.ts';
//import { requestChanges } from './commands/requestChanges.ts';
//import { conversationClear } from './commands/conversationClear.ts';
//import { showTokenUsage } from './commands/showTokenUsage.ts';
//import { runCommand } from './commands/runCommand.ts';
//import { loadExternalContent } from './commands/loadExternalContent.ts';
//import { filesAdd } from './commands/filesAdd.ts';
//import { filesRemove } from './commands/filesRemove.ts';
//import { filesList } from './commands/filesList.ts';
import { viewLogs } from './commands/viewLogs.ts';
import { init } from './commands/init.ts';

//logger.debug('CLI Config:', config.cli);

const cli = new Command()
	.name('bbai')
	.version(config.version as string)
	.description('CLI tool for BBai')
	.command('init', init)
	.command('chat', conversationStart)
	// usage, clear, request, run and load should be sub-commnds of chat
	// but only the 'chat' command has --prompt - does Cliffy support a sub-command of `` (empty) command name to use as default??
	//.command('usage', showTokenUsage)
	//.command('clear', conversationClear)
	//.command('request', requestChanges)
	//.command('undo', undoLastChange)
	//.command('run', runCommand)
	//.command('load', loadExternalContent)

	//.command('files', filesAdd)
	// add, remove and list should be sub-commnds of files
	//.command('add', filesAdd)
	//.command('remove', filesRemove)
	//.command('list', filesList)
	.command('logs', viewLogs)
	// the api commands are all a group, but they should have top-level entries
	.command('start', apiStart)
	.command('stop', apiStop)
	.command('status', apiStatus)
	.command('restart', apiRestart);

export const main = async () => {
	await cli.parse(Deno.args);
};

if (import.meta.main) {
	main();
}
