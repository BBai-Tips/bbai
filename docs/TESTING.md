# BBai Testing Guidelines and Progress

## Overview
This document outlines the testing strategy, progress, and guidelines for the BBai project. It serves as a reference for current and future testing efforts, ensuring comprehensive coverage and consistent quality across the project.

## Testing New Tools

When creating tests for a new tool:

1. Create a new test file in the `api/tests/t/llms/tools` directory, named `toolName.test.ts`.
2. Import necessary testing utilities from Deno's standard testing library.
3. Create mock objects for `LLMConversationInteraction`, `LLMAnswerToolUse`, and `ProjectEditor` as needed.
4. Write tests covering:
   - Basic functionality
   - Edge cases
   - Error scenarios
   - Input validation
5. Test all public methods of the tool, including `toolUseInputFormatter` and `toolRunResultFormatter`.
6. Follow the patterns established in existing tool tests for consistency.
7. Ensure proper cleanup after each test, especially for file system operations.

## General Testing Principles
1. Each tool should have its own test file.
2. Tests should cover basic functionality, edge cases, and error scenarios.
3. Use `Deno.test()` for creating test cases.
4. Set `sanitizeResources` and `sanitizeOps` to `false` for each test to handle resource management properly.
5. Use a temporary directory for file-based tests to ensure a clean state for each test.

## Current Test Coverage

### SearchAndReplace Tool
File: `api/tests/t/llms/tools/searchAndReplaceTool.test.ts`

Completed tests:
1. Basic functionality (modifying existing files)
2. Creating new files with `createIfMissing` flag
3. Multiple operations on a new file
4. Attempting to create a file outside the project root
5. Handling empty operations array
6. Unicode character support

Potential additional tests:
1. Very large file content
2. Complex search and replace patterns (e.g., regex)
3. Error handling for invalid operations

### RequestFiles Tool
File: `api/tests/t/llms/tools/requestFilesTool.test.ts`

Completed tests:
1. Requesting existing files
2. Attempting to request a non-existent file
3. Attempting to request a file outside the project root

Potential additional tests:
1. Requesting multiple files (mix of existing and non-existing)
2. Handling empty array of file names
3. Testing various file path formats (relative, absolute)
4. Requesting files with special characters in names

## Pending Tests

### SearchProject Tool
File: `api/tests/t/llms/tools/searchProjectTool.test.ts`

Completed tests:
1. Basic search functionality
2. Searching with file pattern restrictions
3. Handling searches with no results
4. Error handling for invalid search patterns
5. Partial testing of search within nested directory structures

Potential additional tests:
1. More complex search patterns (e.g., regular expressions)
2. Very large projects or files
3. Edge cases in nested directory structures

### Other Tools
- Implement tests for remaining tools in the `api/src/llms/tools` directory
- Consider creating tests for `LLMToolManager` and interaction classes

## Testing Strategy and Reasoning

1. **Isolation**: Each tool has its own test file to maintain clear separation of concerns and make it easier to locate and update specific tests.

2. **Comprehensive Coverage**: We aim to test not just the happy path, but also edge cases and error scenarios to ensure robust tool behavior.

3. **File Handling**: Many tools interact with the file system. We use a temporary directory for these tests to ensure a clean state and prevent interference between tests.

4. **Error Handling**: We explicitly test for expected errors (e.g., file not found, access denied) to ensure the tools fail gracefully and provide meaningful error messages.

5. **Unicode Support**: Testing with Unicode characters ensures the tools can handle a wide range of text inputs correctly.

6. **Resource Management**: By setting `sanitizeResources` and `sanitizeOps` to `false`, we take responsibility for proper resource cleanup, which is especially important for file system operations.

7. **Mocking Considerations**: While we currently test against a real file system, we may want to consider mocking the file system in the future for more controlled and faster tests.

## Next Steps

1. Run and verify the implemented SearchProject tool tests.
2. Review and expand test coverage for existing tools based on the potential additional tests listed above.
3. Implement tests for remaining tools and components (e.g., LLMToolManager, interaction classes).
4. Consider implementing integration tests that cover the interaction between multiple tools and components.
5. Set up continuous integration to run these tests automatically on each commit or pull request.
6. Regularly review and update this document as new tests are added or testing strategies evolve.

## Recent Progress

1. Implemented initial test cases for the SearchProject tool, covering basic functionality, file pattern restrictions, no-result scenarios, and error handling.
2. Created a consistent test environment with multiple files and a subdirectory for SearchProject tool tests.

## Conclusion
Thorough testing is crucial for maintaining the reliability and functionality of the BBai project. By following these guidelines and continuously expanding our test coverage, we can ensure that the project remains robust and dependable as it grows and evolves. The recent addition of SearchProject tool tests demonstrates our commitment to comprehensive testing and lays the groundwork for testing other components of the system.
