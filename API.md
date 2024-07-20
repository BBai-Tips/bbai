# bbai API Documentation

This document provides details about the endpoints available in the bbai API.

## Base URL

All endpoints are relative to: `http://localhost:<port>/api/v1`

## Endpoints

### Generate Response
- **POST** `/generate`
  - Generate a response using an LLM.
  - Body:
    ```json
    {
      "prompt": "string",
      "provider": "string",
      "model": "string",
      "system": "string"
    }
    ```
  - Response: LLM-generated response

### API Status
- **GET** `/status`
  - Check the status of the API.
  - Response: 
    ```json
    {
      "status": "OK",
      "message": "API is running"
    }
    ```

### Conversation Management
- **POST** `/conversation`
  - Start a new conversation.
- **GET** `/conversation/:id`
  - Get details of a specific conversation.
- **PUT** `/conversation/:id`
  - Update a conversation.
- **DELETE** `/conversation/:id`
  - Delete a conversation.
- **POST** `/conversation/:id/message`
  - Add a message to a conversation.
- **POST** `/conversation/:id/clear`
  - Clear the history of a conversation.
- **POST** `/conversation/:id/undo`
  - Undo the last change in a conversation.

### File Management
- **POST** `/files`
  - Add a file to the conversation.
- **DELETE** `/files/:id`
  - Remove a file from the conversation.
- **GET** `/files`
  - List files in the conversation.

### Token Usage
- **GET** `/tokens`
  - Get current token usage.

### CLI Command
- **POST** `/cli`
  - Run an arbitrary CLI command.

### External Content
- **POST** `/external`
  - Load content from an external website.

### Logs
- **GET** `/logs`
  - Get conversation logs.

### Persistence
- **POST** `/persist`
  - Persist the current conversation to disk.
- **POST** `/resume`
  - Resume a conversation from disk.

Note: Detailed request/response schemas and examples for each endpoint will be added in future updates.
