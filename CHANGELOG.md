# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]



## [0.0.13-beta] - 2024-09-14

### Changed

- Refactored Split config handling; global, project, full
- Added config for apiHostname
- Changed BUI to also load apiHostname and startDir from URL
- Fixes for init wizard
- Changed tests to create configured project for each unit
- Release builds for each platform
- Updated docs for INSTALL and README


## [0.0.12b-beta] - 2024-09-08

### Changed

- Hotfix-2 for over-ambitious api client


## [0.0.12a-beta] - 2024-09-08

### Changed

- Hotfix for over-ambitious api client


## [0.0.12-beta] - 2024-09-08

### Changed

- Added wizard for `bbai init`; will re-use existing config values for defaults if present
- Changed git to be optional
- Split config handling into global and project
- Improved handling for API control (port number)


## [0.0.11-alpha] - 2024-09-06

### Changed

- BUI is not a hosted site (can still be run manually from localhost)
- Running `bbai start` will open browser page for hosted BUI, with apiPort pointing to localhost API


## [0.0.10b-alpha] - 2024-09-03

### Changed

- Hotfix for bui


## [0.0.10a-alpha] - 2024-09-03

### Changed

- Hot fix for deno.lock and build command


## [0.0.10-alpha] - 2024-09-02

### Changed

- Added custom tool content formatters for console and browser
- Added browser interface
- Added prompt caching for tools and system prompt
- Updated cli tool to auto-start api server


## [0.0.9-alpha] - 2024-08-18

### Changed

- Added mock stubs to bypass calls to LLM during unit tests
- Added web page fetch tool
- Added web screenshot fetch tool
- Reworked tool results, tool response, bbai response for better conversation logging
- Refactored finalize callback for tool runs
- Cleaned up dangling event listeners 


## [0.0.8a-alpha] - 2024-08-15

### Changed

- Hot fix for missing conversation log entries


## [0.0.8-alpha] - 2024-08-15

### Changed

- Foundations for Orchestrator/Agent structure
- More tests
- Console logging cleanup
- Error handling


## [0.0.7-alpha] - 2024-08-05

### Changed

- Added websocket support for live updates of conversation logging
- Added event manager
- Added manager for project editors
- Improved typescript type handling
- Refactored terminal console handling


## [0.0.6-alpha] - 2024-08-03

### Changed

- Move tools to a ToolManager class
- Migrate each tool to dedicated class
- Fixes for gathering ProjectDetails
- Improved conversation logging
- More reliable file hydration in messages
- Better tool input validation and handling


## [0.0.5a-alpha] - 2024-08-01

### Changed

- Hot fix for multiple tool result blocks
- Hot fix for undefined usage tokens


## [0.0.5-alpha] - 2024-08-01

### Changed

- Added terminal support for multi-turn conversations
- Applied formatting to chat logs for easier reading


## [0.0.4-alpha] - 2024-07-28

### Changed

- Add workflow to automatically create a Github release and deploy to package managers
- Implement git commit after patching
- Create a class for a "fast" conversation with haiku (for git commit messages, semantic conversation titles, etc.)
- Use haiku to create semantic names for conversations based on initial prompts
- Use haiku to write commit messages


## [0.0.3-alpha] - 2024-07-27

### Changed

- Add support for Homebrew on macOS
- Lots of refactoring improvements for 
  - tool use
  - conversations
  - stateless requests (data persists across API restarts)
  - file searching, adding to conversation, and patching
  - project editor to handle different data sources (only local filesystem so far)


## [0.0.2-alpha] - 2024-07-23

### Added
- Initial project setup
- Basic CLI and API functionality
- File handling capabilities
- Conversation management features


## [0.0.1-alpha] - 2023-07-20
- Initial alpha release
