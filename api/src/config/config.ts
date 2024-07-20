export const config = {
	anthropicApiKey: Deno.env.get('ANTHROPIC_API_KEY') || '',
	openaiApiKey: Deno.env.get('OPENAI_API_KEY') || '',
	environment: Deno.env.get('ENVIRONMENT') || 'development',
	appPort: parseInt(Deno.env.get('APP_PORT') || '8000', 10),
	ignoreLLMRequestCache: Deno.env.get('IGNORE_LLM_REQUEST_CACHE') === 'true',
	envPath: Deno.env.get('ENV_PATH') || '.env',
};

export const configRedacted = {
	...config,
	anthropicApiKey: config.anthropicApiKey ? '[REDACTED]' : '',
	openaiApiKey: config.openaiApiKey ? '[REDACTED]' : '',
};
