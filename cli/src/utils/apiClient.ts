import { ConfigManager } from "shared/config/configManager.ts";

class ApiClient {
  private baseUrl: string;

  constructor() {
    const config = ConfigManager.getInstance().getConfig();
    this.baseUrl = `http://localhost:${config.api.port}`;
  }

  async get(endpoint: string) {
    return await fetch(`${this.baseUrl}${endpoint}`);
  }

  async post(endpoint: string, data: Record<string, unknown>) {
    return await fetch(`${this.baseUrl}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });
  }
}

export const apiClient = new ApiClient();
