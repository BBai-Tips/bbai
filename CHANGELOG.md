# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

- Add workflow to automatically create a Github release and deploy to package managers
- Create a function/class for a "fast" conversation with haiku (for git commit messages, semantic conversation titles, etc.)
- Implement a repoInfo persistence solution
- Implement git commit after patching
- Use haiku to create semantic names for conversations based on initial prompts
- Create an 'add task' tool allowing Claude to give bbai a list of tasks to complete

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
