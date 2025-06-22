class APIKeyManager {
  static STORAGE_KEY = 'gdds_api_config';

  static async saveAPIConfig(config) {
    try {
      await chrome.storage.sync.set({ [this.STORAGE_KEY]: config });
    } catch (error) {
      console.error('Error saving API configuration:', error);
      throw error;
    }
  }

  static async getAPIConfig() {
    try {
      const result = await chrome.storage.sync.get(this.STORAGE_KEY);
      return result[this.STORAGE_KEY] || null;
    } catch (error) {
      console.error('Error getting API configuration:', error);
      throw error;
    }
  }

  static async validateGeminiAPIKey(apiKey) {
    try {
      const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + apiKey, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: "Explain how AI works in a few words"
            }]
          }]
        })
      });

      return response.ok;
    } catch (error) {
      console.error('Error validating Gemini API key:', error);
      return false;
    }
  }
} 