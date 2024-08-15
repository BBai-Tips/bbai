import { crypto } from '@std/crypto';
import { ConversationId } from 'shared/types.ts';

export function generateConversationId(): ConversationId {
	const uuid = crypto.randomUUID();
	return uuid.replace(/-/g, '').substring(0, 8);
}
