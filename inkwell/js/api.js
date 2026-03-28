import { getApiKey, getProvider } from './settings.js';

const ENDPOINTS = {
    claude: '/api/transcribe',
    gemini: '/api/transcribe-gemini',
    gcv: '/api/transcribe-gcv'
};

export async function transcribePage(base64Image) {
    const provider = getProvider();
    const apiKey = getApiKey(provider);

    if (!apiKey) {
        return { text: null, error: `No API key for ${provider}` };
    }

    const endpoint = ENDPOINTS[provider];
    if (!endpoint) {
        return { text: null, error: `Unknown provider: ${provider}` };
    }

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                image: base64Image,
                apiKey: apiKey
            })
        });

        const data = await response.json();

        if (!response.ok) {
            return { text: null, error: data.error || `API error (${response.status})` };
        }

        return { text: data.text || '', error: null };
    } catch (err) {
        return { text: null, error: 'Network error: ' + err.message };
    }
}
