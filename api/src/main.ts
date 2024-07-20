import { Application } from "oak";
import { logger } from "./utils/logger.ts";

const app = new Application();

app.use((ctx) => {
  ctx.response.body = "Hello World!";
});

const port = 8000;
await app.listen({ port });
logger.info(`Server running on http://localhost:${port}`);
