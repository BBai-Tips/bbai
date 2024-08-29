import { PageProps } from "$fresh/server.ts";
import { config } from "shared/configManager.ts";
import { Head } from "$fresh/runtime.ts";

export default function App({ Component, state }: PageProps) {
  const apiPort = config.api.apiPort;
  state.apiPort = apiPort;
  console.log("_app.tsx: apiPort =", state.apiPort);
  return (
    <html>
      <Head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>BBai - Be Better with code and docs</title>
        <link rel="stylesheet" href="/styles.css" />
      </Head>
      <body>
        <Component />
      </body>
    </html>
  );
}