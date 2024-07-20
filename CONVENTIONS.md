# `bbai` 

## IMPORTANT NOTE FOR ASSISTANT
DO NOT MAKE ANY CODE CHANGES UNTIL EXPLICITLY ASKED TO DO SO. The `bbai` assistant will prompt for code changes. Respect those instructions but wait until explicitly told to write code.

## Project Overview
- REST API and CLI tools to modify local files using LLM, inspired by the `aider` tool
- Supports vector embeddings for code/text chunks from local repo
- Implements RAG (Retrieval-Augmented Generation) for LLM
- Provides LLM tools for requesting access to files for review or edit

## Technology Stack
- Runtime: Deno with TypeScript (strict mode)
- API Framework: To be decided (a comparison of Oak, Opine, and Abc will be included in the planning stage)
- Vector Database: To be decided (a comparison of Hnswlib and other options will be provided)
- CLI Command-line Parsing: To be decided (recommendation to be provided, focusing on ease of use and feature set)
- Documentation Generator: To be decided (options to be suggested for Deno projects)

## Architecture
- API server for query handling
- CLI commands for interfacing with API
- In-memory vector storage and search functionality within the API
- LLM abstraction layer for multiple providers (initially Claude, with plans for OpenAI)
- RESTful communication between CLI and API for efficiency

## API Design
- RESTful principles
- Primary endpoints: /api/v1
- JSON request/response format
- Endpoint `handlers` call `service` objects to handle business logic
- Service objects call `pipeline` and `repository` objects for LLM and storage
- No authentication required (designed for local use only)
- Optimized for memory efficiency

Key API Endpoints:
- Add/remove files to conversation
- List files in conversation
- Start/clear/continue conversation with LLM
- Request code/text changes from LLM
- Undo last code/text change
- Show current token usage
- Run arbitrary CLI command with output added to conversation
- Load content from external web site
- Log conversations for live viewing and review using `bbai logs`
- Persist current conversation to disk with a `resume` feature for API restarts

## API Pipelines
- Abstraction for different LLM use cases such as text entity extraction and text classification
- Uses LLM `conversation` to manage calls to LLM providers
- Uses LLM tools for structured data in conversations
- Implements conversation logging for live viewing and review
- Persists current conversation to disk for resuming after API restarts

## Conversation Management
- Log all conversations for review using `bbai logs` command
- Implement a persistence mechanism to save current conversation state to disk
- Provide a `resume` feature to restore conversation state after API restarts
- Store logs in a human-readable format (e.g., Markdown or YAML)

## Project Structure
- Maintain separate directories for API and CLI
- API: `api/src/`
- CLI: `cli/src/`
- Shared: `src/shared/` for code shared between API and CLI
- Utilities: Separate utils in `api/src/utils/` and `cli/src/utils/`
- Documentation: `docs/`
- API tests: `hurl/`
- Configuration: Separate `deno.jsonc` files for `api` and `cli`

## Project Separation and Shared Code
- Maintain separation between `api` and `cli` projects where possible
- Use `src/shared/` directory for code that needs to be shared between API and CLI
- Each project should have its own set of configuration files, including `.env` files
- Shared configuration can be placed in `src/shared/config/`

## Typescript Import Rules
- Use an `import_map.json` file for both `api` and `cli` projects
- All import statements should use bare specifiers from the import map
- Avoid importing files between `cli` and `api` directories directly
- Use `src/shared/` for code that needs to be used in both API and CLI
- Maintain separate builds for API and CLI to facilitate easier deployment

## Import Map Usage
- Each project (`api` and `cli`) should have its own `import_map.json` file
- All dependencies should be listed in the `import_map.json` file
- If an import is not in the `import_map.json`, add it before using
- Example: 
  ```json
  {
    "imports": {
      "chai": "https://deno.land/x/chai@v4.3.4/mod.ts",
      "fs": "https://deno.land/std@0.177.0/fs/mod.ts",
      "path": "https://deno.land/std@0.177.0/path/mod.ts"
    }
  }
  ```
- In your TypeScript files, use bare specifiers for imports:
  ```typescript
  import { expect } from "chai";
  import { readFileSync } from "fs";
  import { join } from "path";
  ```

## API Structure
- Keep all API-related code within the `api/` directory
- Maintain API-specific configuration files in `api/` directory

## CLI Structure
- Utilities: Keep CLI-specific utilities in `cli/src/utils/`
- Main CLI process: Implement in `cli/src/main.ts`
- Implement a simple way to pass long multi-line text strings via CLI
- Include a `bbai logs` command for viewing and reviewing conversations in real-time
- Use an existing command-line parsing library for handling CLI arguments and commands

## CLI Compatibility
- Ensure `bbai` can run on any platform where Deno is supported
- Implement cross-platform compatibility checks and adjustments

## CLI Naming Conventions
- Follow the same naming conventions as the API project
- Use descriptive names for CLI-specific components (e.g., `repoExtractor.ts`, `vectorTransformer.ts`, `fileLoader.ts`)
- Prefix CLI-specific types with `CLI` (e.g., `CLIJob`, `CLIConfig`)

## Configuration
- Use `src/shared/config/config.ts` for shared configuration
- Use `api/src/config/config.ts` and `cli/src/config/config.ts` for project-specific configuration
- Use environment variables for sensitive data
- Add sensitive environment variables to the redacted config
- Use environment-specific .env files (.env.localdev, .env.staging, .env.production)
- Use .env.defaults for default values
- Use .env.example as a template for required environment variables

## CLI Error Handling & Logging
- Implement CLI-specific error types in `cli/src/utils/error.utils.ts`
- Use the custom logger in `cli/src/utils/logger.utils.ts` for CLI-specific logging
- Log CLI process steps, errors, and performance metrics

## CLI Testing
- Implement unit tests for CLI components
- Create integration tests for the entire CLI pipeline
- Store CLI-specific tests in `cli/tests/`

## Script Conventions
- All scripts should include a shebang line at the top of the file
- The shebang line should specify the runtime and any necessary flags
- Example shebang line for Deno scripts:
  ```
  #!/usr/bin/env -S deno run --allow-env --allow-read --allow-net
  ```
- When providing examples for running scripts, use the direct execution method (e.g., `./script-name.ts`) instead of explicitly calling the runtime

## File Naming Conventions
- Class files: Use camelCase for the filename (e.g., `vectorEmbedder.ts`, `apiClient.ts`)
- Script files: Use dashes to separate words (e.g., `transform-data.ts`, `extract-json.ts`)
- Utility files: Include `.utils` in the filename (e.g., `error.utils.ts`, `logger.utils.ts`)
- Type definition files: Include `.types` in the filename (e.g., `llms.types.ts`, `postgres.types.ts`)
- Repository files: Use `.repository` in the filename (e.g., `llm_conversation.repository.ts`)
- Service files: Use `.service` in the filename (e.g., `user.service.ts`)
- Controller files: Use `.controller` in the filename (e.g., `auth.controller.ts`)
- Middleware files: Use `.middleware` in the filename (e.g., `error.middleware.ts`)
- Model files: Use singular form without additional suffixes (e.g., `user.ts`, `conversation.ts`)

## Configuration
- Use `deno.jsonc` for project configuration instead of `package.json`
- Maintain separate `deno.jsonc` files for `api` and `cli`
- Use src/config/config.ts for application-specific configuration
- Use environment variables for sensitive data
- Add sensitive environment variables to the redacted config

## Error Handling & Logging
- Implement specific error types and proper async error handling
- Log errors with context, avoid exposing sensitive data
- Logging uses custom logger in respective `utils/` directories
- Always use `logger.console` when logging, e.g., `logger.console.info()` or `logger.console.error()`

## Performance & Scalability
- Implement caching for frequent queries
- Write LLM prompts with clear instructions
- Design for running as local private API server

## Security
- Use environment variables for sensitive configuration
- Data input is always sanitized and validated
- LLM only has access to files added to the conversation by `bbai`
- `bbai` should not add files that are outside the current git repo

## Testing & Documentation
- Write unit tests for new functions/classes using Deno's built-in testing functionality
- Use Hurl for API endpoint tests
- Maintain docs/ directory
- Use JSDoc comments for code documentation
- Use Swagger/OpenAPI comments for API endpoint documentation
- Create a dedicated documentation site at https://bbai.tips (documentation generator to be decided)

## AI Integration
- Use VoyageAI for code-specific embedding model and creating embeddings
- Implement a utility for chunking code prior to creating embeddings
- Use a local in-memory vector store and search within the API
- Create an abstraction layer for LLM providers (initially supporting Claude, with plans for OpenAI)
- Only implement LLM providers that support tool functionality
- Implement pipelines for handling common conversations; code analysis, code refactoring, etc
- Use embeddings for vector similarity for code chunks

## Deployment
- Aim for simple deployment process for end-users
- Support multiple package managers for installation:
  - Use `brew install bbai` for macOS
  - Implement support for other relevant package managers (e.g., npm, cargo) for cross-platform compatibility
  - Additional package managers to be recommended for comprehensive cross-platform support
- Include both CLI tools and API code in the installation
- Implement GitHub actions for building and compiling releases
- Use semantic versioning for both API and CLI, keeping them version-locked together
- Ensure compatibility with Linux systems

## Project Timeline
- Project is to be completed as soon as possible (ASAP)
- Timeline and milestones will be handled separately from this planning stage

## Performance
- Implement a lightweight performance monitoring solution
- Focus on code efficiency and optimization

When discussing the project, refer to these conventions. Code suggestions should align with the project's style, structure, and technologies. Prioritize advanced techniques and efficient solutions within the project's scope.
