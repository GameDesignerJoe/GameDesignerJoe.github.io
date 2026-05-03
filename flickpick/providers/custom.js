// Custom provider — for any OpenAI-compatible /chat/completions endpoint
// the user wants to plug in (DeepSeek, Mistral, Together, OpenRouter, Groq,
// local Ollama / LM Studio, future providers, etc.). The user supplies the
// base URL and a single model ID via Settings; both 'fast' and 'smart' tiers
// use that same model. Response normalized to { content: [{ text }] }.
export const custom = {
  id: 'custom',
  label: 'Custom (OpenAI-compatible)',
  // No baked-in models — the user provides one via settings.customAi.model.
  models: { fast: null, smart: null },
  async call(apiKey, { messages, max_tokens, custom }) {
    const baseUrl = (custom && custom.baseUrl || '').trim().replace(/\/$/, '');
    const model = (custom && custom.model || '').trim();
    if (!baseUrl) {
      throw new Error('Custom provider: missing Base URL. Set it in Settings → AI Provider.');
    }
    if (!model) {
      throw new Error('Custom provider: missing Model ID. Set it in Settings → AI Provider.');
    }
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: max_tokens || 1024,
      }),
    });
    if (!res.ok) throw new Error(`Custom (${model}) ${res.status}: ${await res.text()}`);
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || '';
    return { content: [{ text }] };
  },
};
