import { APIKeyManager } from './apiKeyManager';

interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{
        text: string;
      }>;
    };
  }>;
}

export class GeminiInterface {
  private static readonly API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

  static async sendMessage(message: string): Promise<string> {
    try {
      const config = await APIKeyManager.getAPIConfig();
      
      if (!config || config.provider !== 'gemini' || !config.apiKey) {
        throw new Error('Gemini API configuration not found');
      }

      const response = await fetch(`${this.API_URL}?key=${config.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: message
            }]
          }],
          safetySettings: [{
            category: "HARM_CATEGORY_DANGEROUS_CONTENT",
            threshold: "BLOCK_NONE"
          }],
          generationConfig: {
            temperature: 0.9,
            topK: 1,
            topP: 1,
            maxOutputTokens: 2048,
            stopSequences: []
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.statusText}`);
      }

      const data: GeminiResponse = await response.json();
      
      if (!data.candidates || data.candidates.length === 0) {
        throw new Error('No response from Gemini API');
      }

      return data.candidates[0].content.parts[0].text;
    } catch (error) {
      console.error('Error sending message to Gemini:', error);
      throw error;
    }
  }

  static async isConfigured(): Promise<boolean> {
    try {
      const config = await APIKeyManager.getAPIConfig();
      return !!(config && config.provider === 'gemini' && config.apiKey);
    } catch (error) {
      console.error('Error checking Gemini configuration:', error);
      return false;
    }
  }
} 