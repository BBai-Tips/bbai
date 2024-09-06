import { PageProps } from '$fresh/server.ts';
// Removed import of useEffect and useState
//import { config } from 'shared/configManager.ts';
import { Head } from '$fresh/runtime.ts';

export default function App({ Component, url }: PageProps) {
	console.log('_app.tsx: URL object:', url);
	console.log('_app.tsx: URL hash:', url.hash);
	const apiPort = url.hash ? new URLSearchParams(url.hash.slice(1)).get('apiPort') : null;
	console.log(`_app.tsx: Parsed apiPort: ${apiPort}`);

	// Log on both server and client side
	if (typeof window !== 'undefined') {
		console.log('_app.tsx (Client): Using apiPort:', apiPort);
	} else {
		console.log('_app.tsx (Server): Using apiPort:', apiPort);
	}
	return (
		<html>
			<Head>
				<meta charset='utf-8' />
				<meta name='viewport' content='width=device-width, initial-scale=1.0' />
				<title>BBai - Be Better with code and docs</title>
				<link rel='stylesheet' href='/styles.css' />
			</Head>
			<body>
				<Component apiPort={apiPort ? parseInt(apiPort, 10) : undefined} />
				{/* Add a script to log apiPort on the client side */}
				<script dangerouslySetInnerHTML={{ __html: `
					console.log('Inline script: apiPort from URL:', ${JSON.stringify(apiPort)});
				`}} />
			</body>
		</html>
	);
}
