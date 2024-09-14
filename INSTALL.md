# Installing BBai

BBai is an AI-powered assistant for text-based projects. This guide will walk you through the installation process.

## System Requirements

BBai can run on any system that supports Deno. While it has been primarily tested on macOS, it should work on other platforms as well.

## Prerequisites

Before installing BBai, ensure you have the following:

1. [Deno](https://deno.com/) (latest stable version)
2. [Git](https://git-scm.com/) (latest stable version)
3. [ctags](https://github.com/universal-ctags/ctags) (optional)
4. An Anthropic API key

These dependencies can be easily installed using package managers like Homebrew on macOS.

## Installation Methods

### Option 1: Installing from Release Packages (Recommended)

1. Go to the [BBai Releases page](https://github.com/BBai-Tips/bbai/releases) on GitHub.
2. Download the appropriate package for your operating system and architecture:
   - For Linux: `bbai-x86_64-unknown-linux-gnu.tar.gz` or `bbai-aarch64-unknown-linux-gnu.tar.gz`
   - For macOS: `bbai-x86_64-apple-darwin.tar.gz` or `bbai-aarch64-apple-darwin.tar.gz`
   - For Windows: `bbai-x86_64-pc-windows-msvc.zip`
3. Extract the downloaded package:
   - For .tar.gz files (Linux and macOS):
     ```
     tar -xzf bbai-<your-platform>.tar.gz
     ```
   - For .zip files (Windows):
     Extract using your preferred zip tool or the built-in Windows explorer.
4. Run the installation script:
   - For Linux and macOS:
     ```
     sudo ./install.sh
     ```
   - For Windows:
     Run `install.bat` as administrator

### Option 2: Manual Installation from Source

1. Clone the BBai repository:
   ```
   git clone https://github.com/BBai-Tips/bbai.git
   cd bbai
   ```

2. Build the project:
   ```
   deno task -c ./cli/deno.jsonc build
   deno task -c ./api/deno.jsonc build
   ```

3. Move the built executables to a directory in your PATH:
   - For Linux and macOS:
     ```
     sudo mv ./cli/build/bbai ./api/build/bbai-api /usr/local/bin/
     ```
   - For Windows:
     Move `bbai.exe` and `bbai-api.exe` to a directory in your PATH, such as `C:\Windows\System32\`


## Configuration

After installation, navigate to the project directory where you want to use BBai and run:

```
bbai init
```

This will create a `.bbai/config.yaml` file in your project directory.

## Obtaining an Anthropic API Key

To use BBai, you'll need an Anthropic API key. Follow these steps:

1. Go to the [Anthropic API Console](https://console.anthropic.com/settings/keys)
2. Sign in or create an account if you don't have one
3. Generate a new API key
4. Copy the API key and add it to your `.bbai/config.yaml` file

## Verifying Installation

To verify that BBai has been installed correctly, run:

```
bbai --help
bbai-api --help
```

These commands should display the help information for BBai and its API.

## Usage

After installation, you can start using BBai in two main ways:

1. Browser Interface:
   To launch the API and open a browser window to start using BBai, run:
   ```
   bbai start
   ```
   This will start the BBai API server and open your default web browser to the BBai interface.

2. Command Line Interface:
   To launch the API and start the CLI for BBai, run:
   ```
   bbai chat
   ```
   This will start the BBai API server and initiate a chat session in your terminal.

Both methods provide access to BBai's features, allowing you to interact with your projects and leverage BBai's capabilities.

## Troubleshooting

If you encounter any issues during installation or use:

1. Check the chat logs: `bbai logs`
2. Check the API logs: `bbai logs --api`
3. Inspect the JSON files under `.bbai/data/conversations` for more detailed information

As BBai is still in alpha, please take necessary precautions when using it with important projects. If you encounter any problems, please create an issue on the [BBai GitHub repository](https://github.com/BBai-Tips/bbai).

## Getting Help

For more information or if you need assistance, please refer to the following resources:

- [BBai GitHub Repository](https://github.com/BBai-Tips/bbai)
- [CLI Documentation](docs/CLI.md)
- [API Documentation](docs/API.md)
- [Contributing Guidelines](docs/CONTRIBUTING.md)
- [Code of Conduct](docs/CODE_OF_CONDUCT.md)
- [Security Policy](docs/SECURITY.md)
- [File Handling Guidelines](docs/FILE_HANDLING.md)
- [Project Conventions](CONVENTIONS.md)

### Using BBai

After installation, we recommend familiarizing yourself with BBai's features:

1. **CLI Usage**: The [CLI Documentation](docs/CLI.md) provides a comprehensive guide on using BBai from the command line. It covers all available commands, their options, and usage examples.

2. **API Integration**: If you're interested in integrating BBai into your own tools or workflows, check out the [API Documentation](docs/API.md). It details all available endpoints, request/response formats, and authentication requirements.

These resources will help you get started with BBai and make the most of its capabilities.

Remember, BBai is in active development, and your feedback is valuable in improving the tool. Happy coding with BBai!
