# `bbai` Project Conventions

## Project Overview
`bbai` is a project that provides REST API and CLI tools to modify local files using LLM, inspired by the `aider` tool. It supports vector embeddings for code/text chunks from local repositories, implements RAG (Retrieval-Augmented Generation) for LLM, and provides LLM tools for requesting access to files for review or edit.

## Technology Stack
- Runtime: Deno with TypeScript (strict mode)
- API Framework: Oak
- Vector Database: In-memory vector store using Hnswlib-ts
- CLI Command-line Parsing: Cliffy
- Documentation Generator: TypeDoc

## Architecture
- API server for query handling
- CLI commands for interfacing with API
- In-memory vector storage and search functionality within the API
- LLM abstraction layer for multiple providers (initially Claude, with plans for OpenAI)
- RESTful communication between CLI and API for efficiency

## Project Structure
- API: `api/src/`
- CLI: `cli/src/`
- Shared: `src/shared/` for code shared between API and CLI
- Utilities: Separate utils in `api/src/utils/` and `cli/src/utils/`
- Documentation: `docs/`
- API tests: `hurl/`
- Configuration: Separate `deno.jsonc` files for `api` and `cli`

## API Design
- RESTful principles with primary endpoints at /api/v1
- JSON request/response format
- No authentication required (designed for local use only)
- Optimized for memory efficiency

Key API Endpoints:
- Manage files in conversation (add/remove/list)
- Manage LLM conversations (start/clear/continue)
- Request code/text changes from LLM
- Undo last code/text change
- Show current token usage
- Run arbitrary CLI command with output added to conversation
- Load content from external web site
- Log conversations for live viewing and review
- Persist current conversation to disk with a `resume` feature

## API Pipelines
- Abstraction for different LLM use cases
- Uses LLM `conversation` to manage calls to LLM providers
- Implements conversation logging and persistence

## Conversation Management
- Log all conversations for review using `bbai logs` command
- Implement persistence mechanism for conversation state
- Provide `resume` feature for API restarts
- Store logs in human-readable format (e.g., Markdown or YAML)

## TypeScript and Import Conventions
- Use `import_map.json` for both `api` and `cli` projects
- Use bare specifiers for imports
- Maintain separate builds for API and CLI
- Use `src/shared/` for code shared between API and CLI

## CLI Structure and Conventions
- Main CLI process in `cli/src/main.ts`
- Include `bbai logs` command for viewing conversations
- Ensure cross-platform compatibility
- Use descriptive names for CLI-specific components
- Prefix CLI-specific types with `CLI`

## Configuration
- Use `deno.jsonc` for project configuration
- Maintain separate config files for `api` and `cli`
- Use environment variables for sensitive data
- Implement environment-specific .env files

## Error Handling & Logging
- Implement specific error types and proper async error handling
- Use custom logger in respective `utils/` directories
- Always use `logger.console` for logging

## File Naming Conventions
- Class files: camelCase (e.g., `vectorEmbedder.ts`)
- Script files: dash-separated (e.g., `transform-data.ts`)
- Utility files: include `.utils` (e.g., `error.utils.ts`)
- Type definition files: include `.types` (e.g., `llms.types.ts`)
- Service files: use `.service` (e.g., `user.service.ts`)
- Controller files: use `.controller` (e.g., `auth.controller.ts`)
- Middleware files: use `.middleware` (e.g., `error.middleware.ts`)
- Model files: singular form without suffixes (e.g., `user.ts`)

## Script Conventions
- Include shebang line for Deno scripts
- Use direct execution method in examples

## Security
- Use environment variables for sensitive configuration
- Sanitize and validate all data input
- Restrict LLM access to files added to conversation by `bbai`
- Prevent `bbai` from adding files outside the current git repo

## Testing & Documentation
- Write unit tests using Deno's built-in testing functionality
- Use Hurl for API endpoint tests
- Use JSDoc comments for code documentation
- Use Swagger/OpenAPI comments for API endpoints
- Create documentation site at https://bbai.tips

## AI Integration
- Use VoyageAI for code-specific embedding model
- Implement code chunking utility
- Use local in-memory vector store and search
- Create LLM provider abstraction layer
- Implement pipelines for common conversations
- Use embeddings for vector similarity for code chunks

## Deployment
- Support multiple package managers (brew, npm, cargo)
- Include both CLI tools and API code in installation
- Use GitHub actions for building and compiling releases
- Use semantic versioning for API and CLI
- Ensure Linux compatibility

## Performance
- Implement lightweight performance monitoring using Deno's built-in performance API
- Focus on code efficiency and optimization
- Use Deno.Metrics() for runtime metrics
- Implement custom timing functions
- Create PerformanceMonitor class
- Log performance metrics at intervals
- Implement /metrics API endpoint

When discussing the project, refer to these conventions. Code suggestions should align with the project's style, structure, and technologies. Prioritize advanced techniques and efficient solutions within the project's scope.
