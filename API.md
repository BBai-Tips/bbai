# BBai API Documentation

This document provides details about the endpoints available in the bbai API.

## Base URL

All endpoints are relative to: `http://localhost:<port>/api/v1`

## Endpoints

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
  - Request Body:
    ```json
    {
      "prompt": "string",
      "provider": "string" (optional),
      "model": "string" (optional),
      "startDir": "string"
    }
    ```
  - Response: LLM-generated response

- **GET** `/conversation/:id`
  - Get details of a specific conversation.
  - Response: Conversation details (to be implemented)

- **POST** `/conversation/:id`
  - Continue an existing conversation.
  - Request Body:
    ```json
    {
      "prompt": "string",
      "startDir": "string"
    }
    ```
  - Response: LLM-generated response

- **DELETE** `/conversation/:id`
  - Delete a conversation.
  - Response: Deletion confirmation message

- **POST** `/conversation/:id/clear`
  - Clear the history of a conversation.
  - Response: Confirmation message

- **POST** `/conversation/:id/undo`
  - Undo the last change in a conversation.
  - Response: Confirmation message

### File Management
- **POST** `/conversation/:id/file`
  - Add a file to the conversation.
  - Request Body: FormData with 'file' field
  - Response: File addition confirmation

- **DELETE** `/conversation/:id/file/:fileId`
  - Remove a file from the conversation.
  - Response: File removal confirmation

- **GET** `/conversation/:id/files`
  - List files in the conversation.
  - Response: Array of file names

Note: Some endpoints like Token Usage, CLI Command, External Content, Logs, and Persistence are not currently implemented in the provided code and have been removed from this documentation.

Detailed request/response schemas and examples for each endpoint will be added in future updates.
