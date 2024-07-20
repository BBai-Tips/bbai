export const config = {
	CLAUDE_API_KEY: Deno.env.get('CLAUDE_API_KEY') || '',
	OPENAI_API_KEY: Deno.env.get('OPENAI_API_KEY') || '',
	environment: Deno.env.get('ENVIRONMENT') || 'development',
	appPort: parseInt(Deno.env.get('APP_PORT') || '8000', 10),
	ignoreLLMRequestCache: Deno.env.get('IGNORE_LLM_REQUEST_CACHE') === 'true',
	envPath: Deno.env.get('ENV_PATH') || '.env',
};

export const configRedacted = {
	...config,
	CLAUDE_API_KEY: config.CLAUDE_API_KEY ? '[REDACTED]' : '',
	OPENAI_API_KEY: config.OPENAI_API_KEY ? '[REDACTED]' : '',
};
