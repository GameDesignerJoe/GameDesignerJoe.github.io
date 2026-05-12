// Vercel serverless function: identify a comic from a cover image.
// Accepts: { provider, model, apiKey, image (data URL or base64), endpoint? }
// Returns: { ok: true, comic: { title, issue, year, publisher, confidence } }
//      or: { ok: false, error: "..." }
//
// Supports five named providers plus a "custom" slot:
//   - anthropic    (Claude)        → uses Anthropic Messages API shape
//   - openai       (GPT-4o etc.)   → OpenAI Chat Completions shape
//   - gemini       (Google)        → Google Generative Language API shape
//   - xai          (Grok)          → OpenAI-compatible
//   - groq         (Groq cloud)    → OpenAI-compatible
//   - custom       (BYO endpoint)  → user supplies endpoint URL, defaults to OpenAI shape
//
// User's API key is never stored — passed through this proxy on each request.

const SYSTEM_PROMPT = `You identify comic books from photographs of their covers. Look carefully at the image and return the comic's title, issue number, publisher, and approximate cover year. Only respond with JSON matching this exact schema:

{"title": "<series title as printed on cover>", "issue": "<issue number, no leading # — could be a number, 'Annual N', 'Special N', etc.>", "year": <year as a number or null if unknown>, "publisher": "<Marvel | DC | Image | Dark Horse | other publisher name>", "confidence": "<high|medium|low>"}

If you can't read part of the cover, make your best guess and lower the confidence. If you can't identify the comic at all, return confidence "low" with whatever you can read. Output ONLY the JSON object, no surrounding prose.`;

const USER_PROMPT = `Identify this comic book.`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed — use POST.' });
  }

  const { provider, model, apiKey, image, endpoint } = req.body || {};
  if (!provider) return res.status(400).json({ ok: false, error: 'Missing "provider".' });
  if (!apiKey) return res.status(400).json({ ok: false, error: 'Missing "apiKey".' });
  if (!image) return res.status(400).json({ ok: false, error: 'Missing "image".' });
  if (!model) return res.status(400).json({ ok: false, error: 'Missing "model".' });

  // Normalize image: strip "data:image/...;base64," prefix and figure out media type.
  let mediaType = 'image/jpeg';
  let base64 = image;
  const m = String(image).match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
  if (m) { mediaType = m[1]; base64 = m[2]; }

  try {
    let raw;
    switch (provider) {
      case 'anthropic':
        raw = await callAnthropic({ model, apiKey, base64, mediaType });
        break;
      case 'gemini':
        raw = await callGemini({ model, apiKey, base64, mediaType });
        break;
      case 'openai':
        raw = await callOpenAICompatible({
          endpoint: 'https://api.openai.com/v1/chat/completions',
          model, apiKey, base64, mediaType,
        });
        break;
      case 'xai':
        raw = await callOpenAICompatible({
          endpoint: 'https://api.x.ai/v1/chat/completions',
          model, apiKey, base64, mediaType,
        });
        break;
      case 'groq':
        raw = await callOpenAICompatible({
          endpoint: 'https://api.groq.com/openai/v1/chat/completions',
          model, apiKey, base64, mediaType,
        });
        break;
      case 'custom':
        if (!endpoint) return res.status(400).json({ ok: false, error: 'Custom provider requires an "endpoint" URL.' });
        raw = await callOpenAICompatible({ endpoint, model, apiKey, base64, mediaType });
        break;
      default:
        return res.status(400).json({ ok: false, error: `Unknown provider: ${provider}` });
    }

    const comic = parseStructured(raw);
    if (!comic) {
      return res.status(502).json({ ok: false, error: 'Could not parse a comic identification from the model response.', raw });
    }
    return res.status(200).json({ ok: true, comic, raw });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err?.message || String(err) });
  }
}

// ---------- Provider adapters ----------

async function callAnthropic({ model, apiKey, base64, mediaType }) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 400,
      system: SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
          { type: 'text', text: USER_PROMPT },
        ],
      }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const j = await res.json();
  return j?.content?.[0]?.text ?? '';
}

async function callGemini({ model, apiKey, base64, mediaType }) {
  // Gemini puts key in URL.
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        role: 'user',
        parts: [
          { text: SYSTEM_PROMPT + '\n\n' + USER_PROMPT },
          { inline_data: { mime_type: mediaType, data: base64 } },
        ],
      }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 400, responseMimeType: 'application/json' },
    }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const j = await res.json();
  return j?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

async function callOpenAICompatible({ endpoint, model, apiKey, base64, mediaType }) {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: 400,
      temperature: 0.2,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'text', text: USER_PROMPT },
            { type: 'image_url', image_url: { url: `data:${mediaType};base64,${base64}` } },
          ],
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Provider ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const j = await res.json();
  return j?.choices?.[0]?.message?.content ?? '';
}

// ---------- Response parsing ----------

function parseStructured(raw) {
  if (!raw) return null;
  // Strip code fences if model wrapped JSON in ```json ... ```
  let text = String(raw).trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) text = fence[1].trim();
  // Find the first JSON object in the text
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first < 0 || last < first) return null;
  const slice = text.slice(first, last + 1);
  let obj;
  try { obj = JSON.parse(slice); } catch { return null; }
  return {
    title: String(obj.title || '').trim(),
    issue: obj.issue == null ? '' : String(obj.issue).replace(/^#/, '').trim(),
    year: obj.year == null ? null : (Number.isFinite(+obj.year) ? +obj.year : null),
    publisher: String(obj.publisher || '').trim(),
    confidence: ['high', 'medium', 'low'].includes(obj.confidence) ? obj.confidence : 'medium',
  };
}
