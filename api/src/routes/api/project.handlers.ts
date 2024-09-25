import type { Context } from '@oak/oak';
import { join, resolve } from '@std/path';
import { ensureDir } from '@std/fs';

export const setupProject = async (
	{ request, response }: { request: Context['request']; response: Context['response'] },
) => {
	const { fullPath } = await request.body.json();
	console.log('Received fullPath:', fullPath);

	if (!fullPath) {
		response.status = 400;
		response.body = { error: 'Full path is required' };
		return;
	}

	// Resolve the path relative to the user's home directory
	const homeDir = Deno.env.get('HOME') || Deno.env.get('USERPROFILE') || '';
	if (!homeDir) {
		response.status = 500;
		response.body = { error: 'Unable to determine user home directory' };
		return;
	}
	// Ensure the provided path is absolute
	if (!resolve(fullPath).startsWith(homeDir)) {
		response.status = 403;
		response.body = { error: 'Selected directory must be within the home directory' };
		return;
	}

	console.log('Validated fullPath:', fullPath);

	try {
		// Ensure the directory exists
		await ensureDir(fullPath);

		// Path has already been validated

		// Check if .bbai directory exists
		const bbaiDir = join(fullPath, '.bbai');
		const isBbaiProject = await Deno.stat(bbaiDir).then(() => true).catch(() => false);

		if (!isBbaiProject) {
			// Initialize the project
			await ensureDir(bbaiDir);
			await Deno.writeTextFile(
				join(bbaiDir, 'config.json'),
				JSON.stringify(
					{
						version: '1.0.0',
						created_at: new Date().toISOString(),
					},
					null,
					2,
				),
			);
		}

		response.body = { fullPath, initialized: !isBbaiProject };
	} catch (error) {
		console.error('Error setting up project:', error);
		response.status = 500;
		response.body = { error: 'Failed to set up project' };
	}
};
