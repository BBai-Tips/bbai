import { Application, Router } from "oak";
import { logger } from "./utils/logger.ts";
import { LLMFactory } from "./llm/llmProvider.ts";

const app = new Application();
const router = new Router();

router.post("/api/v1/generate", async (ctx) => {
  const { prompt, provider } = await ctx.request.body().value;
  
  if (!prompt || !provider) {
    ctx.response.status = 400;
    ctx.response.body = { error: "Missing prompt or provider" };
    return;
  }

  try {
    const llmProvider = LLMFactory.getProvider(provider);
    const response = await llmProvider.generateResponse(prompt);
    ctx.response.body = response;
  } catch (error) {
    logger.error(`Error generating response: ${error.message}`);
    ctx.response.status = 500;
    ctx.response.body = { error: "Failed to generate response" };
  }
});

app.use(router.routes());
app.use(router.allowedMethods());

const port = 8000;
await app.listen({ port });
logger.info(`Server running on http://localhost:${port}`);
