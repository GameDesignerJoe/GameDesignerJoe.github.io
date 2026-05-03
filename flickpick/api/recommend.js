// SECURITY: this proxy receives a user's API key in the request body. We
// MUST NOT log/persist the body or any field that might contain the key.
// Only the explicit fields we use are destructured below — never reference
// `req.body` as a whole, and never console.log it. If you need to debug,
// log message COUNTS and shapes, not contents. Vercel's function logs have
// retention; an accidental body dump leaks every user's key.
import { PROVIDERS } from '../providers/registry.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { provider, apiKey, messages, tier, max_tokens } = req.body || {};

  if (!apiKey || typeof apiKey !== 'string') {
    return res.status(400).json({ error: 'Missing API key. Add one in Settings → AI Provider.' });
  }
  const adapter = provider && PROVIDERS[provider];
  if (!adapter) {
    return res.status(400).json({ error: `Unknown provider: ${provider || '(none)'}` });
  }
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Missing or invalid "messages" field' });
  }

  try {
    const response = await adapter.call(apiKey, {
      messages,
      tier: tier || 'fast',
      max_tokens,
    });
    return res.status(200).json(response);
  } catch (err) {
    // Log status and message only — never the full error object (it can
    // include the request payload depending on internals).
    console.error(`${provider} API error:`, err.message);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
