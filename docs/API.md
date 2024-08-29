# BBai API Documentation

This document provides details about the endpoints available in the BBai API.

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

#### List Conversations
- **GET** `/conversation`
  - Retrieve a list of conversations with pagination and filtering options.
  - Query Parameters:
    - `page` (integer, default: 1): Page number for pagination
    - `pageSize` (integer, default: 10): Number of items per page
    - `startDate` (string, format: date): Filter conversations starting from this date
    - `endDate` (string, format: date): Filter conversations up to this date
    - `llmProviderName` (string): Filter conversations by LLM provider name
    - `startDir` (string, required): The starting directory for the project
  - Response: List of conversations with pagination details

#### Get Conversation
- **GET** `/conversation/:id`
  - Retrieve details of a specific conversation.
  - Query Parameters:
    - `startDir` (string, required): The starting directory for the project
  - Response: Conversation details including messages, LLM provider, and token usage

#### Continue Conversation
- **POST** `/conversation/:id`
  - Continue an existing conversation.
  - Request Body:
    ```json
    {
      "statement": "string",
      "startDir": "string"
    }
    ```
  - Response: LLM-generated response with conversation details

#### Delete Conversation
- **DELETE** `/conversation/:id`
  - Delete a specific conversation.
  - Query Parameters:
    - `startDir` (string, required): The starting directory for the project
  - Response: Deletion confirmation message

#### Clear Conversation
- **POST** `/conversation/:id/clear`
  - Clear the history of a specific conversation.
  - Query Parameters:
    - `startDir` (string, required): The starting directory for the project
  - Response: Confirmation message

### WebSocket Connection
- **GET** `/ws/conversation/:id`
  - Establish a WebSocket connection for real-time conversation updates.
  - The client can send messages with the following format:
    ```json
    {
      "task": "greeting" | "converse" | "cancel",
      "statement": "string",
      "startDir": "string"
    }
    ```
  - The server will emit events for conversation updates, including:
    - `conversationReady`
    - `conversationContinue`
    - `conversationAnswer`
    - `conversationError`
    - `conversationCancelled`

## Note on Unimplemented Features

The following features are mentioned in the codebase but are not fully implemented or exposed through the API:

- Adding files to a conversation
- Removing files from a conversation
- Listing files in a conversation
- Retrieving token usage
- Running CLI commands
- Loading external content
- Retrieving conversation logs
- Undoing the last change in a conversation

These features may be implemented in future versions of the API.

## Error Handling

All endpoints may return appropriate HTTP status codes for various error conditions. Common error responses include:

- 400 Bad Request: For invalid input or missing required parameters
- 404 Not Found: When a requested resource (e.g., conversation) is not found
- 500 Internal Server Error: For unexpected server-side errors

Detailed error messages will be provided in the response body when applicable.

## Authentication

The current implementation does not include authentication. It is designed for local use only. Ensure proper security measures are in place when deploying this API in a production environment.

## Versioning

This documentation is for API version 1 (`v1`). Future versions may introduce changes to the endpoint structure or functionality.