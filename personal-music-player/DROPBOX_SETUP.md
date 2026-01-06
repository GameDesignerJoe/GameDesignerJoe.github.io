# Dropbox App Setup Instructions

## 🔑 The Problem

The app key `w6g3az21d8acv15` from the documentation is invalid. You need to create your own Dropbox app and get a real app key.

## 📝 Step-by-Step Setup

### 1. Create a Dropbox App

1. Go to: **https://www.dropbox.com/developers/apps/create**
2. Sign in with your Dropbox account
3. Choose:
   - **API**: Scoped access
   - **Access type**: Full Dropbox (or App folder if you prefer)
   - **Name**: "My Music Player" (or any unique name)
4. Click **Create app**

### 2. Configure App Settings

After creating the app, you'll be on the app's settings page:

#### Permissions Tab
1. Click the **Permissions** tab
2. Enable these scopes:
   - ✅ `files.metadata.read` (required)
   - ✅ `files.content.read` (required)
3. Click **Submit** at the bottom

#### Settings Tab
1. Go back to the **Settings** tab
2. Find **OAuth 2** section
3. Under **Redirect URIs**, add:
   ```
   http://localhost:8080
   ```
   (You can add the `/callback` part but it's not strictly necessary for the implicit grant flow)

4. Click **Add**

5. Scroll down and ensure **Allow implicit grant** is set to "Allow"

### 3. Get Your App Key

1. Still on the **Settings** tab
2. Find the **App key** near the top
3. Copy this key (it will look something like: `abc123def456ghi`)

### 4. Update Your Config

1. Open `personal-music-player/config.js`
2. Replace the app key:
   ```javascript
   dropboxAppKey: 'YOUR_ACTUAL_APP_KEY_HERE',
   ```
3. Save the file

### 5. Update Redirect URI (if needed)

If you added `/callback` to the Dropbox redirect URI, update `config.js`:

```javascript
redirectUri: window.location.hostname === 'localhost' 
  ? 'http://localhost:8080/callback'
  : `${window.location.origin}/callback`,
```

If you didn't add `/callback`, use:

```javascript
redirectUri: window.location.hostname === 'localhost' 
  ? 'http://localhost:8080'
  : window.location.origin,
```

### 6. Test It!

1. Make sure your local server is still running:
   ```bash
   python -m http.server 8080
   ```

2. Open **http://localhost:8080**

3. Click **Connect to Dropbox**

4. You should now be redirected to Dropbox's authorization page (not an error page!)

5. Click **Allow** to grant access

6. You'll be redirected back to your app with an access token

## 🐛 Troubleshooting

### "Invalid redirect URI"
- Make sure the redirect URI in Dropbox settings EXACTLY matches what's in your config.js
- Common mismatch: `http://localhost:8080` vs `http://localhost:8080/callback`

### "Invalid client_id" (again)
- Double-check you copied the App key correctly (no extra spaces)
- Make sure you saved config.js after updating

### Still getting the error page
- Try clearing your browser cache
- Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
- Check browser console for the actual URL being used

## 📚 References

- Dropbox OAuth Guide: https://developers.dropbox.com/oauth-guide
- Dropbox App Console: https://www.dropbox.com/developers/apps
