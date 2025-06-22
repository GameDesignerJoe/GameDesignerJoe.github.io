import { LLMProvider } from '../shared/types';

interface APIKeyConfig {
  provider: LLMProvider;
  apiKey?: string;
}

export class APIKeyManager {
  private static readonly STORAGE_KEY = 'gdds_api_config';

  static async saveAPIConfig(config: APIKeyConfig): Promise<void> {
    try {
      await chrome.storage.sync.set({ [this.STORAGE_KEY]: config });
    } catch (error) {
      console.error('Error saving API configuration:', error);
      throw error;
    }
  }

  static async getAPIConfig(): Promise<APIKeyConfig | null> {
    try {
      const result = await chrome.storage.sync.get(this.STORAGE_KEY);
      return result[this.STORAGE_KEY] || null;
    } catch (error) {
      console.error('Error getting API configuration:', error);
      throw error;
    }
  }

  static async clearAPIConfig(): Promise<void> {
    try {
      await chrome.storage.sync.remove(this.STORAGE_KEY);
    } catch (error) {
      console.error('Error clearing API configuration:', error);
      throw error;
    }
  }

  static async validateGeminiAPIKey(apiKey: string): Promise<boolean> {
    try {
      console.log('Validating Gemini API key...');
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
      console.log('Request URL:', url);
      
      const requestBody = {
        contents: [{
          parts: [{
            text: "Explain how AI works in a few words"
          }]
        }]
      };
      console.log('Request body:', JSON.stringify(requestBody, null, 2));

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      console.log('Response status:', response.status);
      console.log('Response status text:', response.statusText);
      
      const responseText = await response.text();
      console.log('Response body:', responseText);

      if (!response.ok) {
        console.error('Gemini API validation failed:', responseText);
      }
      return response.ok;
    } catch (error) {
      console.error('Error validating Gemini API key:', error);
      return false;
    }
  }
} 