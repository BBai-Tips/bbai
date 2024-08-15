# Creating a New Tool for BBai

This document serves as a guide for creating new tools in the BBai project. It includes a step-by-step process, a template for gathering necessary information, and important considerations for tool development.

## Step-by-Step Guide

1. **Identify the Need**: Determine the specific functionality the new tool will provide.

2. **Gather Information**: Use the template below to collect necessary details about the tool.

3. **Create the Tool File**: Create a new TypeScript file in the `api/src/llms/tools` directory. Name it according to the existing naming convention (e.g., `newToolNameTool.ts`).

4. **Implement the Tool**: Use the gathered information to implement the tool, following the structure of existing tools.

5. **Error Handling and Input Validation**: Implement robust error handling and input validation.

6. **Integration with LLMToolManager**: Ensure the tool is properly integrated with the LLMToolManager.

7. **Testing**: Create comprehensive tests for the new tool in the `api/tests/llms/tools` directory.

8. **Documentation**: Add necessary documentation for the tool.

## Information Gathering Template

When creating a new tool, gather the following information:

1. Tool Name: [Provide a descriptive name for the tool]

2. Tool Description: [Brief description of what the tool does]

3. Input Schema:
   - Parameter 1: [Name, type, description]
   - Parameter 2: [Name, type, description]
   - ...

4. Expected Feedback: [Describe what the tool should return upon successful execution]

5. Required Actions: [List the main actions the tool needs to perform]

6. Implementation Details: [Describe how the tool will accomplish its actions]

7. Error Scenarios: [List potential error scenarios and how they should be handled]

8. Testing Considerations: [Specific aspects to focus on during testing]

## Tool Implementation Guidelines

### Structure
Each tool should be a class that extends the `LLMTool` base class. Refer to existing tools for the basic structure.

### Naming Conventions
Follow the naming conventions used in existing tools. Generally, use camelCase for variables and methods, and PascalCase for class names.

### Input Validation
Use the input schema to validate incoming data. Throw appropriate errors for invalid inputs.

### Error Handling
Implement try-catch blocks where necessary. Use the `createError` function to generate consistent error objects.

### Integration with LLMToolManager
Ensure the tool is registered with the LLMToolManager. This typically involves adding the tool to the `registerDefaultTools` method in the LLMToolManager class. Without this step, the tool will not be available for use in the BBai system.

Example:
```typescript
private registerDefaultTools(): void {
    // ... other tool registrations
    this.registerTool(new YourNewTool());
}
```

Remember that after adding a new tool or modifying the tool registration, the API server needs to be restarted for the changes to take effect.
Ensure the tool is registered with the LLMToolManager. This typically involves adding the tool to the `tools` array in the LLMToolManager constructor.

### Testing
Create a corresponding test file in `api/tests/llms/tools`. Include tests for:
- Basic functionality
- Edge cases
- Error scenarios
- Input validation

### Documentation
Include JSDoc comments for the class and its methods. Update any relevant project documentation to include information about the new tool.

## Example Tool Types

### File Manipulation Tool
Tools that interact with the file system. Example: SearchAndReplace tool.

### Data Retrieval Tool
Tools that fetch data from external sources. Example: The upcoming "add data" tool using `fetch` or deno-puppeteer.

### System Command Tool
Tools that execute system commands. Example: The upcoming "run command" tool.

## Considerations for Specific Tool Types

### File Manipulation Tools
- Always use `isPathWithinProject` to ensure file operations are restricted to the project directory.
- Use `ProjectEditor` methods for file operations when possible.

### Data Retrieval Tools
- Implement proper error handling for network requests.
- Consider rate limiting and caching mechanisms.

### System Command Tools
- Use `Deno.run` or equivalent to execute system commands.
- Implement timeout mechanisms for long-running commands.
- Sanitize and validate command inputs to prevent injection attacks.

## Important Notes
- Tools must be registered in the LLMToolManager before they can be used.
- After adding or modifying tools, always restart the API server to ensure the changes are applied.
- Be cautious when implementing tools that interact with the file system or execute commands, as they can have significant impacts on the user's environment.

## Conclusion

Creating a new tool involves careful planning, implementation, and testing. By following this guide and maintaining consistency with existing tools, you can ensure that new tools integrate seamlessly into the BBai project and provide reliable functionality.
