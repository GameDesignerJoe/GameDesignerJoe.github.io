module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { image, apiKey } = req.body;

    if (!image || !apiKey) {
        return res.status(400).json({ error: 'Missing image or apiKey' });
    }

    try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 4096,
                messages: [{
                    role: 'user',
                    content: [
                        {
                            type: 'image',
                            source: {
                                type: 'base64',
                                media_type: 'image/jpeg',
                                data: image
                            }
                        },
                        {
                            type: 'text',
                            text: `This is a photo of a handwritten or typewritten notebook page.

READING ORDER:
1. First, identify the main body text — the primary column or block of writing in standard upright orientation. Transcribe it fully.
2. Then look for any marginal text written along the edges of the page (left margin, right margin, top, bottom). This text is often rotated 90° or 270° (sideways). Mentally rotate it to read it.
3. Output each region separated by a label line. Use these exact labels:
   - No label needed for the main body (just start with it)
   - ---[Left margin]--- for text running along the left edge
   - ---[Right margin]--- for text running along the right edge
   - ---[Top margin]--- for text along the top
   - ---[Bottom margin]--- for text along the bottom
4. If there is no marginal text, just output the main body with no labels.

FORMATTING:
- The page may be rotated sideways (90°, 180°, or 270°) — rotate it mentally to find the correct reading orientation before transcribing.
- Preserve the original formatting as closely as possible: maintain line breaks where they appear, preserve indentation and unusual spacing (including creative/poetic layouts where words are spaced apart or staggered), and keep paragraph breaks.
- Use spaces to replicate horizontal positioning of words on the page. If text is centered on the page, add leading spaces to center it relative to a ~60-character line width.
- Output only the raw transcribed text and region labels — no commentary, no headings, no markup.
- If a word is unclear, make your best guess and continue.`
                        }
                    ]
                }]
            })
        });

        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json({
                error: data.error?.message || 'Anthropic API error'
            });
        }

        const text = data.content?.[0]?.text || '';
        return res.status(200).json({ text });

    } catch (err) {
        return res.status(500).json({ error: 'Server error: ' + err.message });
    }
};
