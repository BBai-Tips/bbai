import { crypto } from '@std/crypto';

export function generateConversationId(): string {
	const uuid = crypto.randomUUID();
	return uuid.replace(/-/g, '').substring(0, 8);
}
