import { PageProps } from '$fresh/server.ts';
import Chat from '../islands/Chat.tsx';

interface HomeProps {
	//apiHostname: string;
	//apiPort: number;
}

export default function Home(props: PageProps<HomeProps>) {
	//console.log("index.tsx: props =", props);
	//const { apiHostname, apiPort } = props.state;
	//console.log("index.tsx: apiHostname:apiPort =", apiHostname, apiPort);
	return (
		<div class='h-screen bg-gray-100'>
			<Chat />
		</div>
	);
}
