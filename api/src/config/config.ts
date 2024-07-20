export const config = {
  CLAUDE_API_KEY: Deno.env.get("CLAUDE_API_KEY") || "",
  OPENAI_API_KEY: Deno.env.get("OPENAI_API_KEY") || "",
};
