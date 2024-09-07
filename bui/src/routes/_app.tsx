import { PageProps } from '$fresh/server.ts';
// Removed import of useEffect and useState
//import { config } from 'shared/configManager.ts';
import { Head } from '$fresh/runtime.ts';

export default function App({ Component, url }: PageProps) {
	/*
	console.log('_app.tsx: URL object:', url);
	if (typeof window !== 'undefined') {
		//console.log('_app.tsx: window.location.href:', window.location.href);
		//console.log('_app.tsx: window.location.hash:', window.location.hash);
	}
	console.log('_app.tsx: URL hash:', url.hash);
	let apiPort = null;
	if (typeof window !== 'undefined') {
		// Client-side parsing
		const hash = window.location.hash.slice(1); // Remove the '#'
		const params = new URLSearchParams(hash);
		apiPort = params.get('apiPort');
	} else {
		// Server-side parsing
		apiPort = url.hash ? new URLSearchParams(url.hash.slice(1)).get('apiPort') : null;
	}
	console.log('_app.tsx: Parsed apiPort:', apiPort);
	console.log(`_app.tsx: Parsed apiPort: ${apiPort}`);

	// Log on both server and client side
	if (typeof window !== 'undefined') {
		console.log('_app.tsx (Client): Using apiPort:', apiPort);
	} else {
		console.log('_app.tsx (Server): Using apiPort:', apiPort);
	}
 */
	return (
		<html>
			<Head>
				<meta charset='utf-8' />
				<meta name='viewport' content='width=device-width, initial-scale=1.0' />
				<title>BBai - Be Better with code and docs</title>
				<link rel='stylesheet' href='/styles.css' />
			</Head>
			<body>
				<Component />
			</body>
		</html>
	);
}
