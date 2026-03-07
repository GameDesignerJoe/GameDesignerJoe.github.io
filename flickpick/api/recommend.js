import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic(); // reads ANTHROPIC_API_KEY from process.env

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { messages, model, max_tokens } = req.body;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Missing or invalid "messages" field' });
  }

  try {
    const response = await client.messages.create({
      model: model || 'claude-sonnet-4-20250514',
      max_tokens: max_tokens || 1024,
      messages,
    });

    return res.status(200).json(response);
  } catch (err) {
    console.error('Anthropic API error:', err.status, err.message);
    const status = err.status || 500;
    return res.status(status).json({ error: err.message || 'Internal server error' });
  }
}
