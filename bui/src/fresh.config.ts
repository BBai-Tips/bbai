import { defineConfig } from '$fresh/server.ts';
import tailwind from '$fresh/plugins/tailwind.ts';
import { readFromBbaiDir, readFromGlobalConfigDir } from 'shared/dataDir.ts';
import { ConfigManager } from 'shared/configManager.ts';

// CWD is set by `bbai` in Deno.Command, or implicitly set by user if calling bbai-api directly
const startDir = Deno.cwd();
const fullConfig = await ConfigManager.fullConfig(startDir);
const redactedFullConfig = await ConfigManager.redactedFullConfig(startDir);
const { buiHostname, buiPort, buiUseTls } = fullConfig.bui;

// it appears that Deno Fresh doesn't honour the `hostname` option - it's always 'localhost'
let listenOpts: Deno.ListenOptions = { hostname: buiHostname, port: buiPort || 8000 };

if (buiUseTls) {
	const cert = fullConfig.bui.tlsCertPem ||
		await readFromBbaiDir(startDir, fullConfig.bui.tlsCertFile || 'localhost.pem') ||
		await readFromGlobalConfigDir(fullConfig.bui.tlsCertFile || 'localhost.pem') || '';
	const key = fullConfig.bui.tlsKeyPem ||
		await readFromBbaiDir(startDir, fullConfig.bui.tlsKeyFile || 'localhost-key.pem') ||
		await readFromGlobalConfigDir(fullConfig.bui.tlsKeyFile || 'localhost-key.pem') || '';

	listenOpts = { ...listenOpts, secure: true, cert, key } as Deno.TcpListenOptions;
}

export default defineConfig({
	plugins: [tailwind()],
	...listenOpts,
});
