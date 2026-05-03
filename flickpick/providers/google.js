// Google Gemini adapter. Different request shape (contents instead of
// messages, parts arrays inside) — translate from OpenAI-style messages on
// the way in, normalize to Anthropic shape on the way out.
export const google = {
  id: 'google',
  label: 'Gemini (Google)',
  models: {
    fast: 'gemini-2.5-flash',
    smart: 'gemini-2.5-pro',
  },
  async call(apiKey, { messages, tier, max_tokens }) {
    const model = this.models[tier] || this.models.fast;
    // Gemini role mapping: user → user, anything else (assistant) → model.
    // System messages don't have a direct equivalent — fold them into the
    // first user message so the prompt isn't lost.
    let systemPrefix = '';
    const contents = [];
    for (const m of messages) {
      if (m.role === 'system') {
        systemPrefix += (systemPrefix ? '\n\n' : '') + m.content;
        continue;
      }
      const role = m.role === 'assistant' ? 'model' : 'user';
      let text = m.content;
      if (systemPrefix && contents.length === 0 && role === 'user') {
        text = `${systemPrefix}\n\n${text}`;
        systemPrefix = '';
      }
      contents.push({ role, parts: [{ text }] });
    }
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        generationConfig: { maxOutputTokens: max_tokens || 1024 },
      }),
    });
    if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return { content: [{ text }] };
  },
};
