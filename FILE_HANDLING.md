# File Handling in bbai Conversations

This document outlines the conventions and strategies for handling files within bbai conversations.

## File Storage Strategy

1. **System Prompt:**
   - Use for smaller, frequently accessed files
   - Include files using XML tags
   - Suitable for <10 files or <50KB total

2. **Message Array:**
   - Use for larger or less frequently used files
   - Add files via tool use
   - Suitable for >10 files or >50KB total

3. **Large File Handling:**
   - For files >1MB, consider chunking and loading relevant sections as needed

## File Updates

- Replace the original file with the edited version in the conversation
- Maintain a separate log of changes for reference if needed

## File Metadata

Include file metadata alongside content for better context. Example:

```xml
<file path="/src/main.ts" size="1024" last_modified="2023-06-15T10:30:00Z">
// File content here
import { Application } from "https://deno.land/x/oak/mod.ts";
// ... rest of the file
</file>
```

## Change Proposals

When proposing changes to files, use the diff patch format:

```diff
--- a/path/to/file
+++ b/path/to/file
@@ -10,7 +10,7 @@
 unchanged line
-removed line
+added line
 unchanged line
```

## Caching

Implement a caching mechanism in the bbai agent for frequently accessed files to reduce redundant loading.

## Version Control Integration

- While direct access to git logs is not available, include relevant commit messages or summaries when significant changes occur
- Provide clear, actionable changes in the conversation

## File Handling Workflow

1. Assistant requests files using the provided tool
2. bbai agent adds requested files to the conversation
3. Assistant proposes changes using the diff patch format
4. bbai agent applies changes and updates the conversation state

By following these conventions, we ensure consistent and efficient file handling throughout bbai conversations.
