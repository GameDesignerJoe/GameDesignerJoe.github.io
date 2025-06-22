document.addEventListener('DOMContentLoaded', () => {
    const aiProvider = document.getElementById('ai-provider');
    const apiKeyGroup = document.getElementById('api-key-group');
    const apiKeyInput = document.getElementById('api-key');
    const continueButton = document.getElementById('continue');

    // Show/hide API key input based on provider selection
    aiProvider.addEventListener('change', () => {
        const selectedValue = aiProvider.value;
        const needsApiKey = ['claude-api', 'gpt4', 'gemini', 'local'].includes(selectedValue);
        apiKeyGroup.style.display = needsApiKey ? 'block' : 'none';
    });

    // Handle continue button click
    continueButton.addEventListener('click', () => {
        const selectedProvider = aiProvider.value;
        const apiKey = apiKeyInput.value;

        // Validate API key if needed
        if (['claude-api', 'gpt4', 'gemini', 'local'].includes(selectedProvider) && !apiKey) {
            alert('Please enter an API key for the selected provider.');
            return;
        }

        // Store settings
        chrome.storage.sync.set({
            aiProvider: selectedProvider,
            apiKey: apiKey
        }, () => {
            // Open the main interface
            window.location.href = 'main-interface.html';
        });
    });
});