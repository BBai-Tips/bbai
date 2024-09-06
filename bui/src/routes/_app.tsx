import { PageProps } from '$fresh/server.ts';
// Removed import of useEffect and useState
//import { config } from 'shared/configManager.ts';
import { Head } from '$fresh/runtime.ts';

export default function App({ Component, url }: PageProps) {
	const apiPort = url.hash ? new URLSearchParams(url.hash.slice(1)).get('apiPort') : null;
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
			</body>
		</html>
	);
}
