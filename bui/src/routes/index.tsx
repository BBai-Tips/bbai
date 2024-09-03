import { PageProps } from '$fresh/server.ts';
// Remove useState import as it's not needed in this file
import Chat from '../islands/Chat.tsx';
// Removed import for ConversationsList

interface HomeProps {
	apiPort: number;
}

export default function Home(props: PageProps<HomeProps>) {
	// Remove state management from this component
	//console.log("index.tsx: props =", props);
	const { apiPort } = props.state;
	//console.log("index.tsx: apiPort =", apiPort);
	return (
		<div class='h-screen bg-gray-100'>
			<Chat apiPort={Number(apiPort)} />
		</div>
	);
}
