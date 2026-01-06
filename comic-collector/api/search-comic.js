// Vercel Serverless Function to proxy Comic Vine API requests
// This handles CORS issues by making the API call server-side

export default async function handler(req, res) {
    // Only allow GET requests
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Get barcode from query parameter
    const { barcode } = req.query;

    if (!barcode) {
        return res.status(400).json({ error: 'Barcode parameter is required' });
    }

    // Comic Vine API configuration
    const API_KEY = '6be7a1f7e4ebe66403aca6ff9e8174f6a8aa9717';
    const API_BASE_URL = 'https://comicvine.gamespot.com/api';
    
    try {
        // Build the Comic Vine API URL
        const url = `${API_BASE_URL}/issues/?api_key=${API_KEY}&format=json&filter=upc:${barcode}&field_list=name,issue_number,image,volume`;

        // Make the request to Comic Vine
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'ComicScanner/1.0'
            }
        });

        if (!response.ok) {
            if (response.status === 429) {
                return res.status(429).json({ error: 'Rate limit exceeded. Please try again later.' });
            }
            throw new Error(`Comic Vine API error: ${response.status}`);
        }

        const data = await response.json();

        // Check if we have results
        if (data.results && data.results.length > 0) {
            const result = data.results[0];
            
            // Return formatted comic data
            return res.status(200).json({
                success: true,
                comic: {
                    name: result.volume?.name || result.name || 'Unknown Comic',
                    issueNumber: result.issue_number || 'Unknown',
                    coverUrl: result.image?.medium_url || result.image?.small_url || ''
                }
            });
        } else {
            // No results found
            return res.status(404).json({
                success: false,
                error: 'No comic found with this barcode'
            });
        }

    } catch (error) {
        console.error('Error fetching comic data:', error);
        return res.status(500).json({
            success: false,
            error: 'Error searching for comic. Please try again.'
        });
    }
}
