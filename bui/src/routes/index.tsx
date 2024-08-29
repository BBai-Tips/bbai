import { PageProps } from "$fresh/server.ts";
import Chat from "../islands/Chat.tsx";

interface HomeProps {
  apiPort: number;
}

export default function Home(props: PageProps<HomeProps>) {
  //console.log("index.tsx: props =", props);
  const { apiPort } = props.state;
  //console.log("index.tsx: apiPort =", apiPort);
  return (
    <div class="flex h-[calc(100vh-8rem)]">
      <div class="w-1/4 bg-gray-200 p-4 overflow-y-auto">
        <h2 class="text-xl font-bold mb-4">Conversations</h2>
        {/* TODO: Add conversation list component */}
        <p>Conversation list will be added here</p>
      </div>
      <div class="w-3/4 bg-white p-4">
        <Chat apiPort={apiPort} />
      </div>
    </div>
  );
}