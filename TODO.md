# TODO List

## Logging and Output
1. Create a separate chat output log for conversation progress (no debugging or app logging)
2. Save the chat log in the .bbai directory
3. Add a `bbai` command to tail the chat log

## Repository Information Management
1. Convert projectInfo into a proper class with support for:
   - ctags
   - file listing
   - vector embeddings
   - fallback to file_search tool if none of the above are used
2. Allow users to specify projectInfo type in the config
3. Implement a repoInfo persistence solution
4. Don't create tags file in .bbai - either save with conversation or use the persistence solution

## Chat Command Improvements
1. Modify `bbai chat` command to:
   - Listen to STDIN if '-p' isn't passed
   - Start a prompt for user input if nothing is piped in
   - End user input with '\n.\n' (a dot with a leading blank line)

## Patching and Git Integration
1. Create new files when patch file has /dev/null as the source
2. Implement git commit after patching
3. Modify apply_patch tool to accept a list of file names and patches
4. Use haiku to write commit messages

## Conversation Management
1. Use haiku to create semantic names for conversations based on initial prompts
2. Use semantic names for directories in cache, while maintaining IDs for passing around
3. Create a map of conversation IDs and names to allow user input of either

## Task Management
1. Create an 'add task' tool allowing Claude to give bbai a list of tasks to complete
2. Implement each task as a new conversation to complete the task

## Performance and Execution
1. Fix run loop to continue as long as needed (within reason), allowing for multiple tool turns

## Utility Functions
1. Create a function/class for a "fast" conversation with haiku (for git commit messages, semantic conversation titles, etc.)

## Environment and Execution
1. Check ENV environment and add `--watch` only for localdev
2. When `bbai start` is called, check if running compiled binary or from repo to control how bbai-api is started


`searchFiles` is using file name for exclude pattern; instead need to read the exclude patterns from the file and add those to grep


statement/turn number at start of persisted message json

create new branch with each conversation, merge back at end of convo

save system prompt in persistence if running localdev

