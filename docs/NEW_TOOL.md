# Creating a New Tool for BBai

This document serves as a guide for creating new tools in the BBai project. It includes a step-by-step process, a template for gathering necessary information, and important considerations for tool development.

## Step-by-Step Guide

1. **Identify the Need**: Determine the specific functionality the new tool will provide.

2. **Gather Information**: Use the template below to collect necessary details about the tool.

3. **Create the Tool File**: Create a new TypeScript file in the `api/src/llms/tools` directory. Name it according to the existing naming convention (e.g., `newToolNameTool.ts`).

4. **Create Formatter Files**: Create two new files in the `api/src/llms/tools/formatters` directory:
   - `newToolNameTool.browser.tsx` for browser formatting
   - `newToolNameTool.console.ts` for console formatting

5. **Implement the Tool**: Use the gathered information to implement the tool, following the structure of existing tools.

6. **Implement Formatters**: Implement the `formatToolUse` and `formatToolResult` functions in both formatter files.

7. **Error Handling and Input Validation**: Implement robust error handling and input validation.

8. **Integration with LLMToolManager**: Ensure the tool is properly integrated with the LLMToolManager.

9. **Testing**: Create comprehensive tests for the new tool in the `api/tests/t/llms/tools` directory. It is critical to read the TESTING.md file before writing tests to ensure consistency and proper test coverage.

10. **Documentation**: Add necessary documentation for the tool.

## Information Gathering Template

When creating a new tool, gather the following information:

1. Tool Name: [Provide a descriptive name for the tool]

2. Tool Description: [Brief description of what the tool does]

3. Input Schema:
   - Parameter 1: [Name, type, description]
   - Parameter 2: [Name, type, description]
   - ...

4. Expected Output: [Describe what the tool should return upon successful execution]

5. Required Actions: [List the main actions the tool needs to perform]

6. Implementation Details: [Describe how the tool will accomplish its actions]

7. Error Scenarios: [List potential error scenarios and how they should be handled]

8. Testing Considerations: [Specific aspects to focus on during testing]

9. Formatting Considerations: [Describe any specific formatting needs for browser and console output]

## Tool Implementation Guidelines

When implementing a new tool, it's crucial to maintain consistency with existing tools in the project. This consistency ensures easier maintenance, better readability, and a more cohesive codebase. Pay close attention to the structure, naming conventions, and types used in other tools.

### Structure
Each tool should be a class that extends the `LLMTool` base class. The class should implement the following methods:

- `constructor`: Initialize the tool with a name and description.
- `get input_schema()`: Define the input schema for the tool.
- `toolUseInputFormatter`: Format the tool input for display.
- `toolRunResultFormatter`: Format the tool result for display.
- `runTool`: Implement the main functionality of the tool.

### Naming Conventions
Follow the naming conventions used in existing tools. Use PascalCase for class names (e.g., `LLMToolNewFeature`) and camelCase for method and variable names.

### Formatter Implementation
Create two separate formatter files for each tool:

1. Browser Formatter (`newToolNameTool.browser.tsx`):
   - Import necessary types from `api/llms/llmTool.ts` and `api/llms/llmMessage.ts`.
   - Implement `formatToolUse` and `formatToolResult` functions that return JSX elements.

2. Console Formatter (`newToolNameTool.console.ts`):
   - Import necessary types from `api/llms/llmTool.ts` and `api/llms/llmMessage.ts`.
   - Import `colors` from `cliffy/ansi/colors.ts` and `stripIndents` from `common-tags`.
   - Implement `formatToolUse` and `formatToolResult` functions that return strings.

### Main Tool File
In the main tool file (`newToolNameTool.ts`):

- Import the formatter functions from both formatter files.
- Implement `toolUseInputFormatter` and `toolRunResultFormatter` methods to use the appropriate formatter based on the format parameter.

Example:

```typescript
import { formatToolUse as formatToolUseBrowser, formatToolResult as formatToolResultBrowser } from './formatters/newToolNameTool.browser.tsx';
import { formatToolUse as formatToolUseConsole, formatToolResult as formatToolResultConsole } from './formatters/newToolNameTool.console.ts';

// ...

toolUseInputFormatter = (toolInput: LLMToolInputSchema, format: 'console' | 'browser' = 'console'): string | JSX.Element => {
    return format === 'console' ? formatToolUseConsole(toolInput) : formatToolUseBrowser(toolInput);
};

toolRunResultFormatter = (toolResult: LLMToolRunResultContent, format: 'console' | 'browser' = 'console'): string | JSX.Element => {
    return format === 'console' ? formatToolResultConsole(toolResult) : formatToolResultBrowser(toolResult);
};
```

### Input Validation
Use the input schema to validate incoming data. The `validateInput` method in the base `LLMTool` class will automatically use this schema for validation.

### Error Handling
Implement try-catch blocks where necessary. Use the `createError` function to generate consistent error objects. Handle both expected and unexpected errors gracefully.

### Integration with LLMToolManager
Ensure the tool is registered with the LLMToolManager. This involves adding the tool to the `registerDefaultTools` method in the LLMToolManager class:

```typescript
private registerDefaultTools(): void {
    // ... other tool registrations
    this.registerTool(new LLMToolNewFeature());
}
```

### Tool Result Handling
The `runTool` method should return an object of type `LLMToolRunResult`, which includes:

- `toolResults`: The main output of the tool (can be a string, LLMMessageContentPart, or LLMMessageContentParts).
- `toolResponse`: A string response for the tool execution.
- `bbaiResponse`: A user-friendly response describing the tool's action.
- `finalize` (optional): A function to perform any final actions after the tool use is recorded.

### Testing

When creating tests for your new tool:

- Place test files in the `api/tests/t/llms/tools` directory.
- Follow the naming convention: `toolName.test.ts`.
- Ensure comprehensive test coverage, including edge cases and error scenarios.
- Refer to TESTING.md for detailed guidelines on writing and organizing tests.
- Study existing tool tests as examples to maintain consistency in testing approach.
- Include tests for both browser and console formatters.

It is crucial to read and follow the guidelines in TESTING.md before writing any tests. This ensures consistency across the project and helps maintain high-quality test coverage.

### Documentation
Include JSDoc comments for the class and its methods. Update any relevant project documentation to include information about the new tool.

## Example Tool Types

### File Manipulation Tool
Tools that interact with the file system. Examples: SearchAndReplace, ApplyPatch tools.

### Data Retrieval Tool
Tools that fetch data from external sources or the local project. Example: SearchProject tool.

### System Command Tool
Tools that execute system commands. Example: RunCommand tool.

## Considerations for Specific Tool Types

### File Manipulation Tools
- Always use `isPathWithinProject` to ensure file operations are restricted to the project directory.
- Use `ProjectEditor` methods for file operations when possible.
- Handle file creation, modification, and deletion scenarios.

### Data Retrieval Tools
- Implement proper error handling for data access operations.
- Consider performance implications for large datasets or frequent queries.

### System Command Tools
- Use `Deno.run` or equivalent to execute system commands.
- Implement timeout mechanisms for long-running commands.
- Sanitize and validate command inputs to prevent injection attacks.

## Important Notes
- Tools must be registered in the LLMToolManager before they can be used.
- After adding or modifying tools, always restart the API server to ensure the changes are applied.
- Be cautious when implementing tools that interact with the file system or execute commands, as they can have significant impacts on the user's environment.
- Consider the impact of the tool on the overall conversation flow and user experience.
- Ensure that both browser and console formatters are implemented and used correctly for each tool.

## Conclusion

Creating a new tool involves careful planning, implementation, and testing. By following this guide and maintaining consistency with existing tools, you can ensure that new tools integrate seamlessly into the BBai project and provide reliable functionality. Remember to consider both the technical implementation and the user experience when designing and implementing new tools, including proper formatting for both browser and console outputs.