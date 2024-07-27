import { walk } from '@std/fs';

const updateVersion = async (newVersion: string) => {
	const files = ['deno.jsonc', 'cli/deno.jsonc', 'api/deno.jsonc'];

	for await (const file of files) {
		const content = await Deno.readTextFile(file);
		const json = JSON.parse(content);
		json.version = newVersion;
		await Deno.writeTextFile(file, JSON.stringify(json, null, 2));
		//deno fmt file
		const formatCommand = new Deno.Command("deno", {
			args: ["fmt", file],
			stdout: "piped",
			stderr: "piped",
		});
		await formatCommand.output();
	}

	// Update version.ts
	await Deno.writeTextFile('version.ts', `export const VERSION = "${newVersion}";`);

	// Update other files that might need the version
	for await (const entry of walk('.', { exts: ['.ts', '.rb'] })) {
		if (entry.isFile) {
			let content = await Deno.readTextFile(entry.path);
			content = content.replace(/VERSION\s*=\s*["'][\d.]+["']/, `VERSION = "${newVersion}"`);
			await Deno.writeTextFile(entry.path, content);
		}
	}

	await updateChangelog(newVersion);
};

const updateChangelog = async (newVersion: string) => {
	const changelogPath = 'CHANGELOG.md';
	const changelog = await Deno.readTextFile(changelogPath);

	// Get commit messages since last tag
	const command = new Deno.Command("git", {
		args: ["log", "$(git describe --tags --abbrev=0)..HEAD", "--pretty=format:%s"],
		stdout: "piped",
	});
	const { stdout } = await command.output();
	const commitMessages = new TextDecoder().decode(stdout).split('\n');

	// Categorize commit messages
	const categories = {
		Added: [],
		Changed: [],
		Deprecated: [],
		Removed: [],
		Fixed: [],
		Security: [],
	};

	commitMessages.forEach(msg => {
		if (msg.toLowerCase().startsWith('add')) {
			categories.Added.push(msg);
		} else if (msg.toLowerCase().startsWith('change') || msg.toLowerCase().startsWith('update')) {
			categories.Changed.push(msg);
		} else if (msg.toLowerCase().startsWith('deprecate')) {
			categories.Deprecated.push(msg);
		} else if (msg.toLowerCase().startsWith('remove')) {
			categories.Removed.push(msg);
		} else if (msg.toLowerCase().startsWith('fix')) {
			categories.Fixed.push(msg);
		} else if (msg.toLowerCase().includes('security')) {
			categories.Security.push(msg);
		} else {
			categories.Changed.push(msg);
		}
	});

	// Create new changelog entry
	let newEntry = `\n## [${newVersion}] - ${new Date().toISOString().split('T')[0]}\n`;

	for (const [category, messages] of Object.entries(categories)) {
		if (messages.length > 0) {
			newEntry += `\n### ${category}\n`;
			messages.forEach(msg => {
				newEntry += `- ${msg.charAt(0).toUpperCase() + msg.slice(1)}\n`;
			});
		}
	}

	// If there are no changes, add a placeholder message
	if (newEntry === `\n## [${newVersion}] - ${new Date().toISOString().split('T')[0]}\n`) {
		newEntry += '\n### Changed\n- No significant changes in this version\n';
	}

	const unreleasedRegex = /## \[Unreleased\]\n(?:### \w+\n(?:- .*\n)*\n?)*/;
	const unreleasedMatch = changelog.match(unreleasedRegex);

	if (unreleasedMatch) {
		const updatedChangelog = changelog.replace(
			unreleasedRegex,
			`## [Unreleased]\n\n${newEntry}`
		);
		await Deno.writeTextFile(changelogPath, updatedChangelog);
	} else {
		const updatedChangelog = changelog.replace(
			"# Changelog",
			`# Changelog\n\n## [Unreleased]\n\n${newEntry}`
		);
		await Deno.writeTextFile(changelogPath, updatedChangelog);
	}

	console.log(`Updated CHANGELOG.md with version ${newVersion}`);
};

if (import.meta.main) {
	const newVersion = Deno.args[0];
	if (!newVersion) {
		console.error('Please provide a new version number.');
		Deno.exit(1);
	}
	updateVersion(newVersion);
	console.log("Version update complete. Please review the changes in CHANGELOG.md before committing.");
}
