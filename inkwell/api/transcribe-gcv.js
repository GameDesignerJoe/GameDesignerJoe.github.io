/**
 * Reconstruct text with indentation from GCV bounding box data.
 * Uses word x-coordinates to add leading spaces, preserving poetic layouts.
 */
function formatWithLayout(annotation) {
    try {
        const pages = annotation.pages;
        if (!pages || pages.length === 0) return annotation.text || '';

        // Collect all words with their bounding boxes and text
        const words = [];
        for (const page of pages) {
            for (const block of page.blocks || []) {
                for (const paragraph of block.paragraphs || []) {
                    for (const word of paragraph.words || []) {
                        const text = (word.symbols || []).map(s => {
                            let ch = s.text;
                            // Check for line/paragraph breaks after this symbol
                            const breakType = s.property?.detectedBreak?.type;
                            if (breakType === 'LINE_BREAK' || breakType === 'EOL_SURE_SPACE') {
                                ch += '\n';
                            } else if (breakType === 'SPACE') {
                                ch += ' ';
                            }
                            return ch;
                        }).join('');

                        const vertices = word.boundingBox?.vertices;
                        if (vertices && vertices.length >= 2) {
                            words.push({
                                text,
                                x: vertices[0].x || 0,
                                y: vertices[0].y || 0,
                                rightX: vertices[1].x || 0
                            });
                        }
                    }
                }
            }
        }

        if (words.length === 0) return annotation.text || '';

        // Find the leftmost x position (the page's left margin)
        const minX = Math.min(...words.map(w => w.x));

        // Estimate character width from the page width
        const pageWidth = pages[0].width || 1000;
        // Assume ~80 chars across the page as a rough estimate
        const charWidth = pageWidth / 80;

        // Group words into lines and add indentation
        const lines = [];
        let currentLine = [];

        for (const word of words) {
            // Check if this word starts after a line break in the previous word
            if (currentLine.length > 0) {
                const lastWord = currentLine[currentLine.length - 1];
                if (lastWord.text.endsWith('\n')) {
                    lines.push(currentLine);
                    currentLine = [];
                }
            }
            currentLine.push(word);
        }
        if (currentLine.length > 0) lines.push(currentLine);

        // Target line width for centering calculation
        const LINE_WIDTH = 60;
        const pageCenter = pageWidth / 2;

        // Build output with indentation and centering
        const output = lines.map(line => {
            if (line.length === 0) return '';

            // Join word texts, stripping trailing newlines
            const lineText = line.map(w => w.text.replace(/\n$/, '')).join('');

            // Calculate the line's horizontal extent in pixels
            const firstWord = line[0];
            const lastWord = line[line.length - 1];
            const lineStartX = firstWord.x;
            const lineEndX = lastWord.rightX || (lastWord.x + lastWord.text.length * charWidth);
            const lineCenter = (lineStartX + lineEndX) / 2;

            // Check if this line is centered on the page
            // (line center is within 10% of page center)
            const isCentered = Math.abs(lineCenter - pageCenter) < pageWidth * 0.1
                && lineStartX > minX + charWidth * 3; // must be indented to count

            if (isCentered) {
                const padding = Math.max(0, Math.round((LINE_WIDTH - lineText.length) / 2));
                return ' '.repeat(padding) + lineText;
            }

            // Regular left-indented line
            const indent = Math.max(0, Math.round((lineStartX - minX) / charWidth));
            const spaces = ' '.repeat(indent);
            return spaces + lineText;
        }).join('\n');

        return output;
    } catch (e) {
        // Fallback to plain text if layout parsing fails
        return annotation.text || '';
    }
}

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

        const annotation = data.responses?.[0]?.fullTextAnnotation;

        if (!annotation?.text && data.responses?.[0]?.error) {
            return res.status(400).json({
                error: data.responses[0].error.message || 'Vision API returned an error'
            });
        }

        // Try to reconstruct layout with indentation from bounding boxes
        const text = annotation ? formatWithLayout(annotation) : '';

        return res.status(200).json({ text });

    } catch (err) {
        return res.status(500).json({ error: 'Server error: ' + err.message });
    }
};
