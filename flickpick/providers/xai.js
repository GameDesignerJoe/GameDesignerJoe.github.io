// xAI Grok adapter. Uses an OpenAI-compatible REST shape; only baseURL and
// model IDs differ. Model names occasionally rename — if calls 404, update
// the IDs here. Response normalized to { content: [{ text }] }.
export const xai = {
  id: 'xai',
  label: 'Grok (xAI)',
  models: {
    fast: 'grok-3-mini',
    smart: 'grok-3',
  },
  async call(apiKey, { messages, tier, max_tokens }) {
    const model = this.models[tier] || this.models.fast;
    const res = await fetch('https://api.x.ai/v1/chat/completions', {
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
    if (!res.ok) throw new Error(`Grok ${res.status}: ${await res.text()}`);
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || '';
    return { content: [{ text }] };
  },
};
