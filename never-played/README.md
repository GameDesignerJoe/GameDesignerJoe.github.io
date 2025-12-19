# Never Played - Minimal MVP

Display your Steam game library. Shows which games you've never played!

## Setup Instructions

### 1. Get Your Steam API Key

1. Go to https://steamcommunity.com/dev/apikey
2. Sign in with your Steam account
3. Enter domain name: `localhost`
4. Copy the API key

### 2. Configure Environment Variables

1. Open `.env.local` in the project root
2. Replace `your_steam_api_key_here` with your actual Steam API key

```env
STEAM_API_KEY=ABC123YOUR_ACTUAL_KEY_HERE
```

### 3. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Use the App

1. Enter your Steam ID (find it at https://steamidfinder.com)
2. Click "Get Games"
3. See your library with playtime!

**Test Steam ID:** You can test with Gabe Newell's ID: `76561197960434622`

## Important Notes

- Your Steam profile must be **Public** for this to work
  - Go to Steam → Profile → Edit Profile → Privacy Settings
  - Set "Game details" to Public

- The API key is used **server-side only** (secure)
- No database needed - fetches fresh from Steam each time
- No authentication required

## Project Structure

```
src/
  app/
    page.tsx                    # Main page (UI)
    api/
      steam-library/
        route.ts                # Steam API endpoint
```

## Troubleshooting

**"Invalid Steam ID or profile is private"**
- Make sure Steam profile is set to Public
- Verify the Steam ID is correct (17 digits)

**"Steam API key not configured"**
- Make sure `.env.local` exists
- Make sure `STEAM_API_KEY` is set
- Restart the dev server after adding the key

---

**That's it!** Just 2 files + 1 config. Simple and clean. 🎮
