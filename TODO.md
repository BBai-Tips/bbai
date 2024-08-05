# TODO List

## Repository Information Management
1. Convert projectInfo into a proper class with support for:
   - ctags
   - file listing
   - vector embeddings
   - fallback to file_search tool if none of the above are used
2. Allow users to specify projectInfo type in the config
3. Implement a repoInfo persistence solution
4. Don't create tags file in .bbai - either save with conversation or use the persistence solution

## Patching and Git Integration
3. Modify apply_patch tool to accept a list of file names and patches
5. Create a new tool to add files rather than update files
6. For new files in patches, check for paths starting with `b/` and strip it
7. Add config option to create new branch when starting a conversation
8. Implement a way to "end" conversation which merges branch back to original


## Task Management
1. Create an 'add task' tool allowing Claude to give bbai a list of tasks to complete
2. Implement each task as a new conversation to complete the task

## System Prompt and Project Info
1. Update system prompt to give a clear explanation about using project-info to choose files rather than search_files
2. Move project-info towards the beginning of the system prompt
3. Create a high-level system prompt template to combine baseSystem with project info and files added
4. Update system prompt to further clarify that assistant is talking to both bbai and user:
   - Responses to tool use (e.g., "Patch applied successfully") should be directed to bbai and wrapped in tags for parsing
   - Everything not inside <bbai> tags will be shown to user as part of the conversation
   - 'User' message showing 'tool result' should be clearly separate from rest of the conversation

## Logging and Output
1. Implement terse and verbose options for conversation log:
   - Verbose option to show results of tool use and details such as contents of patches being applied
   - Implement fancy formatting for showing patches, similar to git diff output

## Configuration and Customization
1. Make the 'post-run' script (currently hard-coded for deno format) a user config option
2. Implement a safety switch (e.g., allow_dangerous_user_scripts) for potentially dangerous user scripts
3. Create a meta tool to choose which toolset to load (e.g., different tools for coding projects vs. creative writing)

## Improvements and Fixes
1. Fix ctags multi-tier functionality:
   - Currently goes through all tiers and says all are too big
2. Implement conversation state management:
   - Keep state of conversations with a currently active 'speak with'
   - Use KV (or similar) to create "conversation locking" in ProjectEditor to allow only a single active conversation

## Completed Tasks
1. ✓ `searchFiles` is now using exclude patterns read from the file instead of file names for exclude pattern
2. ✓ Added statement/turn number at the start of persisted message JSON
3. ✓ Implemented creation of a new branch with each conversation, merging back at the end of the conversation
4. ✓ Saved system prompt and project info in conversation persistence when running in localdev environment
5. ✓ Check ENV environment and add `--watch` only for localdev
6. ✓ When `bbai start` is called, check if running compiled binary or from repo to control how bbai-api is started
7. ✓ Create a separate chat output log for conversation progress (no debugging or app logging)
8. ✓ Save the chat log in the .bbai directory
9. ✓ Add a `bbai` command to tail the chat log
10. ✓ Modify `bbai chat` command to:
    - Listen to STDIN if '-p' isn't passed
    - Start a prompt for user input if nothing is piped in
    - End user input with '\n.\n' (a dot with a leading blank line)
11. ✓ Fix run loop to continue as long as needed (within reason), allowing for multiple tool turns

## Utility Functions
1. ✓ Create a function/class for a "fast" conversation with haiku (for git commit messages, semantic conversation titles, etc.)

## Conversation Management
1. ✓ Use haiku to create semantic names for conversations based on initial prompts
2. ✓ Use semantic names for directories in cache, while maintaining IDs for passing around
3. ✓ Create a map of conversation IDs and names to allow user input of either

## Patching and Git Integration
1. ✓ Create new files when patch file has /dev/null as the source [done]
2. ✓ Implement git commit after patching [done]
4. ✓ Use haiku to write commit messages

## Improvements and Fixes
1. ✓ Create a 'chat' class similar to LLMConversation:
   - designed for quick (fast) LLM conversations, eg to ask for a git message or for the 'title' of a conversation
2. ✓ Update `bbai chat` to support proper readline text entry rather than just typing on stdin

## Logging and Output
1. ✓ Refactor conversation logging:
   - Write human-friendly and machine-parseable output to chat log
   - Allow users to tail the chat log directly for as-is viewing
   - Use `bbai logs` for fancy formatting
   - Make `bbai logs` check the TERM width and use that for max width

## For CHANGELOG

- Implement a repoInfo persistence solution
- Create an 'add task' tool allowing Claude to give bbai a list of tasks to complete


## Charlie's thoughts

tool manager class

new files need to be staged before commiting

statementCount and turnCount in persisted messages is not correct. statementCount is starting at zero with every request, it needs to be restored from persisted conversation. turnCount stays at 1, so the value we're storing isn't the value that's updated during the loop.

at start of each conversation, get current git commit, save it with the "Add File" content of new message.

when running `bbai chat` check if api is running; if not start it, and then kill it when exiting
 this has been done but api isn't responding - it's maybe on different IP. Also ensure the api logs go to file and not to chat terminal (Unless debug cli arg is passed)

don't start api in watch mode if auto-started by `bbai chat` can we pass args via action(...)

websocket mode to get live updtes between terminal and api

tool use conversation log entry needs to be type `agent` not `user`

Add 'bbai restart' command for api, can just do a stop/start, look in cli/src/main.ts for entry point. There are also commands for `apiStart` and `apiStop`.

Exclude args are not being respected for file listing in `fileHandling.utils.ts`

don't persist a conversation for a quick chat

after prompt in console - print a divider line

DONE:

- do clear screen when starting editor
- In LogFormatter, formatted log entries don't have new lines
- in conversationStart chat terminal, make the summary block with coversation id, turn count, token usage, etc look fancy
- when hydrating files, process messages in reverse order, and keep track of which files have been hydrated. If earlier message asks for same file again, don't add the file and instead make a note that file in this message is outdated and will appear in later message.
- validate results of search/replace in `handleSearchAndReplace`. Confirm the search and replace strings don't match, then confirm the original and modified text don't match - if they do then the search/replace failed. 
- chat history in terminal
