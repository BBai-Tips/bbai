import { Context } from '@oak/oak';
import { join, resolve } from '@std/path';

export const addFile = async (
	{ response }: { response: Context['response'] },
) => {
	// Add file to conversation
	response.body = { message: 'File added to conversation' };
};

export const removeFile = async (
	{ params, response }: { params: { id: string }; response: Context['response'] },
) => {
	// Remove file from conversation
	response.body = { message: `File ${params.id} removed from conversation` };
};

export const listFiles = async (
	{ response }: { response: Context['response'] },
) => {
	// List files in conversation
	response.body = { message: 'Files in conversation listed' };
};

export const resolvePath = async (
	{ request, response }: { request: Context['request']; response: Context['response'] },
) => {
	const { partialPath } = await request.body.json();

	if (!partialPath) {
		response.status = 400;
		response.body = { error: 'Partial path is required' };
		return;
	}

	// Resolve the path relative to the user's home directory
	const homeDir = Deno.env.get('HOME') || Deno.env.get('USERPROFILE') || '';
	if (!homeDir) {
		response.status = 500;
		response.body = { error: 'Unable to determine user home directory' };
		return;
	}
	const fullPath = resolve(join(homeDir, partialPath));

	response.body = { fullPath };
};
