import { MessageType, LLMProvider } from '../shared/types';
import { APIKeyManager } from '../utils/apiKeyManager';

// When popup loads
document.addEventListener('DOMContentLoaded', async () => {
  // Check connection status
  checkConnectionStatus();
  
  // Load project count
  loadProjectCount();
  
  // Setup open Claude button
  const openClaudeButton = document.getElementById('open-claude');
  if (openClaudeButton) {
    openClaudeButton.addEventListener('click', () => {
      chrome.tabs.create({ url: 'https://claude.ai' });
    });
  }

  // Setup LLM selector
  const llmSelect = document.getElementById('llm-select') as HTMLSelectElement;
  const apiConfig = document.getElementById('api-config');
  const claudeWebConfig = document.getElementById('connection-status');

  // Load saved configuration
  const config = await APIKeyManager.getAPIConfig();
  if (config) {
    llmSelect.value = config.provider;
    if (config.apiKey) {
      (document.getElementById('api-key-input') as HTMLInputElement).value = config.apiKey;
    }
    updateUIForProvider(config.provider);
  }

  // Handle provider selection change
  llmSelect.addEventListener('change', (e) => {
    const provider = (e.target as HTMLSelectElement).value as LLMProvider;
    updateUIForProvider(provider);
    
    // Update button text based on provider
    if (openClaudeButton) {
      openClaudeButton.textContent = provider === 'claude' ? 'Open Claude.ai' : 'Open Document Interface';
    }

    // Clear status message when switching providers
    const apiKeyStatus = document.getElementById('api-key-status');
    if (apiKeyStatus) {
      apiKeyStatus.textContent = '';
      apiKeyStatus.className = 'api-key-status';
    }
  });

  // Handle API key save
  const saveKeyButton = document.getElementById('save-key-button');
  if (saveKeyButton) {
    saveKeyButton.addEventListener('click', async () => {
      const provider = llmSelect.value as LLMProvider;
      const apiKeyInput = document.getElementById('api-key-input') as HTMLInputElement;
      const apiKey = apiKeyInput.value.trim();
      const apiKeyStatus = document.getElementById('api-key-status');

      if (!apiKey) {
        if (apiKeyStatus) {
          apiKeyStatus.textContent = 'Please enter an API key';
          apiKeyStatus.className = 'api-key-status error';
        }
        return;
      }

      if (saveKeyButton instanceof HTMLButtonElement) {
        saveKeyButton.disabled = true;
      }
      if (apiKeyStatus) {
        apiKeyStatus.textContent = 'Validating...';
        apiKeyStatus.className = 'api-key-status';
      }

      try {
        let isValid = false;
        
        if (provider === 'gemini') {
          isValid = await APIKeyManager.validateGeminiAPIKey(apiKey);
        }
        // Add validation for other providers here

        if (isValid) {
          await APIKeyManager.saveAPIConfig({ provider, apiKey });
          if (apiKeyStatus) {
            apiKeyStatus.textContent = 'API key saved successfully';
            apiKeyStatus.className = 'api-key-status success';
          }
        } else {
          if (apiKeyStatus) {
            apiKeyStatus.textContent = 'Invalid API key';
            apiKeyStatus.className = 'api-key-status error';
          }
        }
      } catch (error) {
        if (apiKeyStatus) {
          apiKeyStatus.textContent = 'Error saving API key';
          apiKeyStatus.className = 'api-key-status error';
        }
      } finally {
        if (saveKeyButton instanceof HTMLButtonElement) {
          saveKeyButton.disabled = false;
        }
      }
    });
  }
});

// Update UI based on selected provider
function updateUIForProvider(provider: LLMProvider) {
  const apiConfig = document.getElementById('api-config');
  const claudeWebConfig = document.getElementById('connection-status');
  
  if (provider === 'claude') {
    if (apiConfig) apiConfig.style.display = 'none';
    if (claudeWebConfig) claudeWebConfig.style.display = 'block';
  } else {
    if (apiConfig) apiConfig.style.display = 'block';
    if (claudeWebConfig) claudeWebConfig.style.display = 'none';
  }
}

async function checkConnectionStatus() {
  const connectionStatus = document.getElementById('connection-status');
  if (connectionStatus) {
    connectionStatus.textContent = 'Connected';
  }
}

async function loadProjectCount() {
  const projectCount = document.getElementById('project-count');
  if (projectCount) {
    projectCount.textContent = 'Projects: 0';
  }
}
