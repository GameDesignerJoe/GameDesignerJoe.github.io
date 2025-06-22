// Simple test script for Gemini API
async function testGeminiAPI(apiKey) {
    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: "Explain how AI works in a few words"
                        }]
                    }],
                    safetySettings: [{
                        category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                        threshold: "BLOCK_NONE"
                    }],
                    generationConfig: {
                        temperature: 0.9,
                        topK: 1,
                        topP: 1,
                        maxOutputTokens: 2048,
                        stopSequences: []
                    }
                })
            }
        );

        const responseText = await response.text();
        console.log('Response status:', response.status);
        console.log('Response headers:', Object.fromEntries(response.headers));
        console.log('Response body:', responseText);
        
        return {
            ok: response.ok,
            status: response.status,
            body: responseText
        };
    } catch (error) {
        console.error('Error:', error);
        return {
            ok: false,
            error: error.message
        };
    }
}

// Test with the provided API key
testGeminiAPI('AIzaSyB932lMvUJGzhxwe24XnUAuEXvmI0xsp3I')
    .then(result => {
        console.log('Test complete:', result);
    }); 