// Anthropic adapter. Native response shape is { content: [{ type, text }] }
// — used as the canonical normalized shape across all providers, so this
// adapter just passes the API response through unmodified.
export const anthropic = {
  id: 'anthropic',
  label: 'Claude (Anthropic)',
  models: {
    fast: 'claude-haiku-4-5-20251001',
    smart: 'claude-sonnet-4-20250514',
  },
  async call(apiKey, { messages, tier, max_tokens }) {
    const model = this.models[tier] || this.models.fast;
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({ model, messages, max_tokens: max_tokens || 1024 }),
    });
    if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
    return res.json();
  },
};
