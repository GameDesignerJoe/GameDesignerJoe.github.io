import { getApiKey } from './settings.js';

export async function transcribePage(base64Image) {
    const apiKey = getApiKey();
    if (!apiKey) {
        return { text: null, error: 'No API key configured' };
    }

    try {
        const response = await fetch('/api/transcribe', {
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
