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
            `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    requests: [{
                        image: {
                            content: image
                        },
                        features: [{
                            type: 'DOCUMENT_TEXT_DETECTION',
                            maxResults: 1
                        }],
                        imageContext: {
                            languageHints: ['en']
                        }
                    }]
                })
            }
        );

        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json({
                error: data.error?.message || 'Google Cloud Vision API error'
            });
        }

        // DOCUMENT_TEXT_DETECTION returns fullTextAnnotation with the complete text
        const text = data.responses?.[0]?.fullTextAnnotation?.text || '';

        if (!text && data.responses?.[0]?.error) {
            return res.status(400).json({
                error: data.responses[0].error.message || 'Vision API returned an error'
            });
        }

        return res.status(200).json({ text });

    } catch (err) {
        return res.status(500).json({ error: 'Server error: ' + err.message });
    }
};
