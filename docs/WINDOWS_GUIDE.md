# BBai Windows User Guide

This guide will help you install and use BBai on your Windows system.

## Installation

1. Go to the [BBai Releases page](https://github.com/BBai-Tips/bbai/releases) on GitHub.
2. Download the `bbai-installer.msi` file.
3. Double-click the downloaded file to run the installer.
4. Follow the on-screen instructions to complete the installation.

## Using BBai

After installation, you'll find two batch files on your desktop:

- `bbai_init.bat`: Use this to initialize BBai in your project directory.
- `bbai_start.bat`: Use this to start BBai and open the browser interface.

### Important: Project-Specific Usage

BBai is designed to work with specific projects or directories. The `init` and `start` commands are not global; they are tied to the directory where you run them.

### Initializing a Project

1. Open File Explorer and navigate to your project directory.
2. Copy the `bbai_init.bat` file from your desktop into your project directory.
3. Double-click `bbai_init.bat` to run it.
4. Follow the prompts to set up BBai for your project.

### Starting BBai for a Project

1. Make sure you're in the project directory where you ran `bbai_init.bat`.
2. Copy the `bbai_start.bat` file from your desktop into your project directory.
3. Double-click `bbai_start.bat` to start BBai.
4. Your default web browser will open, showing the BBai interface for your project.

### Using BBai from Command Prompt

If you prefer using the command line:

1. Open Command Prompt.
2. Navigate to your project directory:
   ```
   cd path\to\your\project
   ```
3. Run BBai commands directly:
   ```
   bbai init
   bbai start
   ```

## Troubleshooting

If you encounter any issues:

1. Ensure you're running the batch files from your project directory.
2. Check that BBai was installed correctly by running `bbai --version` in Command Prompt.
3. If you get a "command not found" error, you may need to add BBai to your system PATH.

For more help, refer to the [full documentation](https://github.com/BBai-Tips/bbai/blob/main/README.md) or [open an issue](https://github.com/BBai-Tips/bbai/issues) on our GitHub repository.