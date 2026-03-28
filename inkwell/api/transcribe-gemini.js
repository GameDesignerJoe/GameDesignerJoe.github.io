module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { image, apiKey } = req.body;

    if (!image || !apiKey) {
        return res.status(400).json({ error: 'Missing image or apiKey' });
    }

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            {
                                inlineData: {
                                    mimeType: 'image/jpeg',
                                    data: image
                                }
                            },
                            {
                                text: 'This is a photo of a handwritten notebook page. The page may be rotated sideways (90°, 180°, or 270°) — rotate it mentally to find the correct reading orientation before transcribing. Transcribe all the handwritten text exactly as written, preserving paragraph breaks. Output only the raw transcribed text — no commentary, no headings, no formatting. If a word is unclear, make your best guess and continue.'
                            }
                        ]
                    }]
                })
            }
        );

        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json({
                error: data.error?.message || 'Gemini API error'
            });
        }

        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        return res.status(200).json({ text });

    } catch (err) {
        return res.status(500).json({ error: 'Server error: ' + err.message });
    }
};
