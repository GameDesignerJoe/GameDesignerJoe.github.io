module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        return res.status(500).json({ error: 'Google OAuth not configured on server' });
    }

    const { code, refresh_token, redirect_uri } = req.body;

    if (!code && !refresh_token) {
        return res.status(400).json({ error: 'Missing code or refresh_token' });
    }

    try {
        // Build token request — either initial exchange or refresh
        const params = new URLSearchParams();
        params.set('client_id', clientId);
        params.set('client_secret', clientSecret);

        if (code) {
            // Initial auth code exchange
            params.set('code', code);
            params.set('grant_type', 'authorization_code');
            params.set('redirect_uri', redirect_uri || req.headers.origin || '');
        } else {
            // Refresh existing token
            params.set('refresh_token', refresh_token);
            params.set('grant_type', 'refresh_token');
        }

        const response = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params.toString()
        });

        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json({
                error: data.error_description || data.error || 'Token exchange failed'
            });
        }

        // Return tokens to client (refresh_token only comes on initial exchange)
        return res.status(200).json({
            access_token: data.access_token,
            expires_in: data.expires_in,
            refresh_token: data.refresh_token || null
        });

    } catch (err) {
        return res.status(500).json({ error: 'Server error: ' + err.message });
    }
};
