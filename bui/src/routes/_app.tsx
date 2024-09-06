import { PageProps } from '$fresh/server.ts';
import { useEffect, useState } from 'preact/hooks';
import { config } from 'shared/configManager.ts';
import { Head } from '$fresh/runtime.ts';

export default function App({ Component }: PageProps) {
	const [apiPort, setApiPort] = useState(8000); // Default to 8000

	useEffect(() => {
		const hash = window.location.hash;
		const params = new URLSearchParams(hash.slice(1)); // Remove the '#' character
		const portFromUrl = params.get('apiPort');
		if (portFromUrl) {
			setApiPort(parseInt(portFromUrl, 10));
		}
		console.log('_app.tsx: apiPort =', apiPort);
	}, []);
	return (
		<html>
			<Head>
				<meta charset='utf-8' />
				<meta name='viewport' content='width=device-width, initial-scale=1.0' />
				<title>BBai - Be Better with code and docs</title>
				<link rel='stylesheet' href='/styles.css' />
			</Head>
			<body>
				<Component apiPort={apiPort} />
			</body>
		</html>
	);
}
