# Installing BBai

BBai is an AI-powered assistant for text-based projects. This guide will walk you through the installation process.

## System Requirements

BBai can run on any system that supports Deno. While it has been primarily tested on macOS, it should work on other platforms as well.

## Prerequisites

Before installing BBai, ensure you have the following:

1. [Deno](https://deno.com/) (latest stable version)
2. [Git](https://git-scm.com/) (latest stable version)
3. [ctags](https://github.com/universal-ctags/ctags) (optional but recommended)
4. An Anthropic API key

These dependencies can be easily installed using package managers like Homebrew on macOS.

## Installation Methods

### Option 1: Using Homebrew (macOS only)

If you're on macOS, you can install BBai using Homebrew:

```
brew install bbai
```

### Option 2: Manual Installation

1. Clone the BBai repository:
   ```
   git clone https://github.com/BBai-Tips/bbai.git
   cd bbai
   ```

2. Build the project:
   ```
   deno task build
   ```

3. Move the built executables to a directory in your PATH:
   ```
   sudo mv ./build/bbai ./build/bbai-api /usr/local/bin/
   ```

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

## Troubleshooting

If you encounter any issues during installation or use:

1. Check the chat logs: `bbai logs`
2. Check the API logs: `bbai logs --api`
3. Inspect the JSON files under `.bbai/cache/conversations` for more detailed information

As BBai is still in alpha, please take necessary precautions when using it with important projects. If you encounter any problems, please create an issue on the [BBai GitHub repository](https://github.com/BBai-Tips/bbai).

## Getting Help

For more information or if you need assistance, please refer to the following resources:

- [BBai GitHub Repository](https://github.com/BBai-Tips/bbai)
- [CLI Documentation](CLI.md)
- [API Documentation](API.md)
- [Contributing Guidelines](CONTRIBUTING.md)
- [Code of Conduct](CODE_OF_CONDUCT.md)
- [Security Policy](SECURITY.md)
- [File Handling Guidelines](FILE_HANDLING.md)
- [Project Conventions](CONVENTIONS.md)

### Using BBai

After installation, we recommend familiarizing yourself with BBai's features:

1. **CLI Usage**: The [CLI Documentation](CLI.md) provides a comprehensive guide on using BBai from the command line. It covers all available commands, their options, and usage examples.

2. **API Integration**: If you're interested in integrating BBai into your own tools or workflows, check out the [API Documentation](API.md). It details all available endpoints, request/response formats, and authentication requirements.

These resources will help you get started with BBai and make the most of its capabilities.

Remember, BBai is in active development, and your feedback is valuable in improving the tool. Happy coding with BBai!
