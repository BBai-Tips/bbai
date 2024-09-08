import { Command } from 'cliffy/command/mod.ts';
import { config } from 'shared/configManager.ts';

import { init } from './commands/init.ts';
import { apiStart } from './commands/apiStart.ts';
import { apiStop } from './commands/apiStop.ts';
import { apiStatus } from './commands/apiStatus.ts';
import { apiRestart } from './commands/apiRestart.ts';
import { conversationChat } from './commands/conversationChat.ts';
import { conversationList } from './commands/conversationList.ts';
import { viewLogs } from './commands/viewLogs.ts';
import { config as configCommand } from './commands/config.ts';
//import { logger } from 'shared/logger.ts';

//logger.debug('CLI Config:', config.cli);

const cli = new Command()
	.name('bbai')
	.version(config.version as string)
	.description('CLI tool for BBai')
	.command('init', init)
	//
	// conversation commands
	.command('chat', conversationChat)
	.command('list', conversationList)
	// list should be sub-commnds of chat
	// but only the 'chat' command has --prompt - does Cliffy support a sub-command of `` (empty) command name to use as default??
	//
	// log commands
	.command('logs', viewLogs)
	// the api commands are all a group, but they should have top-level entries
	.command('start', apiStart)
	.command('stop', apiStop)
	.command('status', apiStatus)
	.command('restart', apiRestart)
	.command('config', configCommand);

export const main = async () => {
	await cli.parse(Deno.args);
};

if (import.meta.main) {
	main();
}
