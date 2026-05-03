// OpenAI adapter. ChatCompletions API; same {role, content} message shape as
// Anthropic. Response normalized to { content: [{ text }] } so client code
// doesn't have to branch by provider.
export const openai = {
  id: 'openai',
  label: 'ChatGPT (OpenAI)',
  models: {
    fast: 'gpt-4o-mini',
    smart: 'gpt-4o',
  },
  async call(apiKey, { messages, tier, max_tokens }) {
    const model = this.models[tier] || this.models.fast;
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
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
    if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || '';
    return { content: [{ text }] };
  },
};
