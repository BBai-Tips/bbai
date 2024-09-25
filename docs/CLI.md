# BBai CLI Documentation

`bbai` is a command-line interface tool for interacting with the BBai API and managing AI-assisted conversations for various text-based projects.

## Installation

For detailed installation instructions, please refer to the [INSTALL.md](../INSTALL.md) file.

For Windows users, we provide an MSI installer and batch files for easy setup and usage. Please see our [Windows User Guide](WINDOWS_GUIDE.md) for more information.

## Usage

```
bbai [command] [options]
```

On Windows, you can also use the provided batch files:
- `bbai_init.bat`: Initialize BBai in your project directory.
- `bbai_start.bat`: Start BBai and open the browser interface.

## Available Commands

### General

- `bbai --version`: Display the version of the BBai CLI tool.
- `bbai --help`: Show help information for the BBai CLI tool.

### Project Initialization

- `bbai init`: Initialize BBai in the current directory.
  - On Windows, you can also double-click `bbai_init.bat` in your project directory.

### API Management

- `bbai start`: Start the BBai API server and open the browser interface.
  - On Windows, you can also double-click `bbai_start.bat` in your project directory.
  - Options:
    - `--log-level <level>`: Set the log level for the API server.
    - `--log-file <file>`: Specify a log file to write output.
- `bbai stop`: Stop the BBai API server.
- `bbai status`: Check the status of the BBai API server.
  - Options:
    - `--text`: Return plain text instead of JSON.

### Conversation Management

- `bbai chat` (alias: `c`): Start a new conversation or continue an existing one.
  - Options:
    - `-p, --prompt <string>`: Prompt to start or continue the conversation.
    - `-i, --id <string>`: Conversation ID to continue.
    - `-m, --model <string>`: LLM model to use for the conversation.
    - `--text`: Return plain text instead of JSON.

### File Management

- `bbai add`: Add files to the conversation (not implemented).
- `bbai remove`: Remove files from the conversation (not implemented).
- `bbai list`: List files in the conversation (not implemented).

### Conversation Actions

- `bbai clear`: Clear the current conversation (not implemented).
- `bbai request`: Request changes from the LLM (not implemented).
- `bbai undo`: Undo the last change (not implemented).

### Utility Commands

- `bbai usage`: Show current token usage (not implemented).
- `bbai run`: Run an arbitrary CLI command (not implemented).
- `bbai load`: Load content from an external web site (not implemented).
- `bbai logs`: View chat conversation logs (default).
  - Options:
    - `-n, --lines <number>`: Number of lines to display (default: 20).
    - `-f, --follow`: Follow the log output in real-time with color-enabled display for chat conversations.
    - `--api`: Show logs for the API server instead of chat conversations.
    - `-i, --id <string>`: Conversation ID to view logs for.

### Persistence

- `bbai persist`: Persist the current conversation to disk (not implemented).
- `bbai resume`: Resume a persisted conversation (not implemented).

## Examples

1. Initialize BBai in your project:
   ```
   bbai init
   ```
   On Windows, double-click `bbai_init.bat` in your project directory.

2. Start the BBai API server and open the browser interface:
   ```
   bbai start
   ```
   On Windows, double-click `bbai_start.bat` in your project directory.

3. Start a new conversation:
   ```
   bbai chat -p "Hello, I'd like to start a new project."
   ```

4. Continue an existing conversation:
   ```
   bbai chat -i <conversation-id> -p "Can you explain the last change?"
   ```

5. View chat conversation logs in real-time with color-enabled display:
   ```
   bbai logs -f
   ```

6. View API logs:
   ```
   bbai logs --api
   ```

7. Check the status of the API server:
   ```
   bbai status
   ```

8. Stop the API server:
   ```
   bbai stop
   ```

9. View API server logs:
   ```
   bbai logs --api
   ```

Note: Many commands are currently not implemented and will be added in future updates.

## Windows-Specific Usage

For detailed instructions on using BBai on Windows, including how to use the provided batch files and the importance of project-specific usage, please refer to our [Windows User Guide](WINDOWS_GUIDE.md).

Remember that the `init` and `start` commands (and their corresponding batch files) are project-specific. Always ensure you're in the correct project directory when running these commands or using the batch files.
