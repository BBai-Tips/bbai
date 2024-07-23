import { Command } from 'cliffy/command/mod.ts';
import { logger } from 'shared/logger.ts';
import { config } from 'shared/configManager.ts';

import { apiStart } from './commands/apiStart.ts';
import { apiStop } from './commands/apiStop.ts';
import { apiStatus } from './commands/apiStatus.ts';
import { conversationStart } from './commands/conversationStart.ts';
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
import { init } from './commands/init.ts';

//logger.debug('CLI Config:', config.cli);

const cli = new Command()
	.name('bbai')
	.version('0.1.0')
	.description('CLI tool for bbai project')
	.command('init', init)
	.command('add', filesAdd)
	.command('remove', filesRemove)
	.command('list', filesList)
	.command('chat', conversationStart)
	.alias('c')
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

// Add this function to handle the conversation output
function handleConversationOutput(response: any, options: any) {
	const isNewConversation = !options.id;
	const conversationId = response.conversationId;
	const statementCount = response.statementCount;
	const turnCount = response.turnCount;
	const totalTurnCount = response.totalTurnCount;

	if (options.json) {
		console.log(JSON.stringify({
			...response,
			isNewConversation,
			conversationId,
			statementCount,
			turnCount,
			totalTurnCount
		}, null, 2));
	} else {
		console.log(response.response.answerContent[0].text);
		
		console.log(`\nConversation ID: ${conversationId}`);
		console.log(`Statement Count: ${statementCount}`);
		console.log(`Turn Count: ${turnCount}`);
		console.log(`Total Turn Count: ${totalTurnCount}`);
		
		if (isNewConversation) {
			console.log(`\nNew conversation started.`);
			console.log(`To continue this conversation, use:`);
			console.log(`bbai chat -i ${conversationId} -p "Your next question"`);
		}
	}
}
