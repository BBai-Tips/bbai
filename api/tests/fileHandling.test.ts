import { assertEquals, assertStringIncludes } from './deps.ts';
import { join } from '@std/path';

import { generateFileListing, searchFiles } from '../src/utils/fileHandling.utils.ts';
import { GitUtils } from 'shared/git.ts';

const testProjectRoot = Deno.makeTempDirSync();

function cleanupTestDirectory() {
	for (const entry of Deno.readDirSync(testProjectRoot)) {
		Deno.removeSync(join(testProjectRoot, entry.name), { recursive: true });
	}
}

Deno.test({
	name: 'generateFileListing - empty directory',
	fn: async () => {
		cleanupTestDirectory();
		try {
			// Test body
			const listing = await generateFileListing(testProjectRoot);
			assertEquals(listing, '');
		} finally {
			await GitUtils.cleanup();
		}
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'generateFileListing - correct paths',
	fn: async () => {
		cleanupTestDirectory();
		try {
			Deno.writeTextFileSync(join(testProjectRoot, 'file1.txt'), 'content');
			Deno.mkdirSync(join(testProjectRoot, 'subdir'));
			Deno.writeTextFileSync(join(testProjectRoot, 'subdir', 'file2.txt'), 'content');

			const listing = await generateFileListing(testProjectRoot);
			assertStringIncludes(listing!, 'file1.txt');
			assertStringIncludes(listing!, join('subdir', 'file2.txt'));
		} finally {
			await GitUtils.cleanup();
		}
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'generateFileListing - exclude files based on .gitignore patterns',
	fn: async () => {
		cleanupTestDirectory();
		try {
			Deno.writeTextFileSync(join(testProjectRoot, '.gitignore'), '*.log\nnode_modules/');
			Deno.writeTextFileSync(join(testProjectRoot, 'file1.txt'), 'content');
			Deno.writeTextFileSync(join(testProjectRoot, 'debug.log'), 'log content');
			Deno.mkdirSync(join(testProjectRoot, 'node_modules'));
			Deno.writeTextFileSync(join(testProjectRoot, 'node_modules', 'package.json'), '{}');

			const listing = await generateFileListing(testProjectRoot);
			assertStringIncludes(listing!, 'file1.txt');
			assertEquals(listing!.includes('debug.log'), false);
			assertEquals(listing!.includes('node_modules'), false);
		} finally {
			await GitUtils.cleanup();
		}
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'searchFiles - find files matching the search pattern',
	fn: async () => {
		cleanupTestDirectory();
		try {
			Deno.writeTextFileSync(join(testProjectRoot, 'file1.txt'), 'Hello, world!');
			Deno.writeTextFileSync(join(testProjectRoot, 'file2.txt'), 'Goodbye, world!');

			const result = await searchFiles(testProjectRoot, 'Hello');
			assertEquals(result.files, ['./file1.txt']);
			assertEquals(result.errorMessage, null);
		} finally {
			await GitUtils.cleanup();
		}
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'searchFiles - return an empty array when no files match',
	fn: async () => {
		cleanupTestDirectory();
		try {
			Deno.writeTextFileSync(join(testProjectRoot, 'file1.txt'), 'Hello, world!');

			const result = await searchFiles(testProjectRoot, 'Nonexistent');
			assertEquals(result.files, []);
			assertEquals(result.errorMessage, null);
		} finally {
			await GitUtils.cleanup();
		}
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'searchFiles - respect file pattern when provided',
	fn: async () => {
		cleanupTestDirectory();
		try {
			Deno.writeTextFileSync(join(testProjectRoot, 'file1.txt'), 'Hello, world!');
			Deno.writeTextFileSync(join(testProjectRoot, 'file2.md'), 'Hello, markdown!');

			const result = await searchFiles(testProjectRoot, 'Hello', '*.md');
			assertEquals(result.files, ['./file2.md']);
			assertEquals(result.errorMessage, null);
		} finally {
			await GitUtils.cleanup();
		}
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'searchFiles - handle errors gracefully',
	fn: async () => {
		cleanupTestDirectory();
		try {
			// This test simulates an error by searching in a non-existent directory
			const nonExistentDir = join(testProjectRoot, 'nonexistent');
			const result = await searchFiles(nonExistentDir, 'pattern');
			assertEquals(result.files, []);
			assertStringIncludes(result.errorMessage!, "Failed to spawn 'grep': No such cwd");
		} finally {
			await GitUtils.cleanup();
		}
	},
	sanitizeResources: false,
	sanitizeOps: false,
});
