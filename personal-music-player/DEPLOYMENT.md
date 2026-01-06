# Deploying My Playback to Vercel

## Quick Deploy

### Option 1: Vercel CLI (Recommended)

1. **Install Vercel CLI** (if not already installed):
   ```bash
   npm i -g vercel
   ```

2. **Navigate to project folder**:
   ```bash
   cd personal-music-player
   ```

3. **Deploy**:
   ```bash
   vercel
   ```
   
4. **Follow the prompts**:
   - Link to existing project? **N** (first time)
   - What's your project name? **my-playback**
   - In which directory is your code located? **./
   - Want to override settings? **N**

5. **Production deploy**:
   ```bash
   vercel --prod
   ```

### Option 2: Vercel Dashboard

1. Go to [vercel.com](https://vercel.com)
2. Click **"Add New Project"**
3. Import from Git or upload folder
4. Project name: **my-playback**
5. Root Directory: **personal-music-player**
6. Click **"Deploy"**

---

## ⚠️ Important: Update Dropbox Redirect URI

After deploying, you'll get a URL like: `https://my-playback.vercel.app`

**You MUST update your Dropbox app settings:**

1. Go to [Dropbox App Console](https://www.dropbox.com/developers/apps)
2. Select your app
3. Go to **Settings** tab
4. Under **Redirect URIs**, add:
   ```
   https://my-playback.vercel.app
   ```
5. Click **Add** then **Save**

6. **Update config.js**:
   - Change `redirectUri` to: `'https://my-playback.vercel.app'`
   - Or use dynamic detection (already implemented)

---

## Testing on Mobile

Once deployed:

1. Open `https://my-playback.vercel.app` on your phone
2. Connect to Dropbox
3. Play a song
4. **Lock your screen** 🔒
5. Media controls should appear!

### iOS:
- Controls appear on lock screen
- Swipe down from top-right for Control Center
- Also works with CarPlay

### Android:
- Controls in notification shade
- Lock screen controls
- Works with Android Auto

---

## Custom Domain (Optional)

To use a custom domain:

1. In Vercel dashboard, go to your project
2. Click **"Domains"**
3. Add your domain (e.g., `playback.yourdomain.com`)
4. Follow DNS setup instructions
5. Update Dropbox redirect URI to new domain

---

## Troubleshooting

### Deployment fails:
- Make sure all files are in `personal-music-player/` folder
- Check vercel.json is valid JSON
- Try: `vercel --debug`

### OAuth redirect error:
- Double-check Dropbox redirect URI matches deployment URL exactly
- Must include `https://` protocol
- No trailing slash

### Service Worker not loading:
- Clear browser cache
- Check browser console for errors
- Vercel headers should allow service workers

### Lock screen controls don't appear:
- Only works on HTTPS (Vercel provides this)
- Browser must support Media Session API
- Try Chrome/Safari on mobile

---

## Environment Variables (If Needed)

If you want to use environment variables:

1. In Vercel dashboard: **Settings** → **Environment Variables**
2. Add variables (though current setup uses config.js)

---

## Continuous Deployment

Connect to GitHub for auto-deploy on push:

1. Push code to GitHub
2. Import GitHub repo in Vercel
3. Every push to `main` auto-deploys!

---

## Performance Tips

Vercel automatically handles:
- ✅ Global CDN
- ✅ Automatic HTTPS
- ✅ Compression (gzip/brotli)
- ✅ HTTP/2
- ✅ Edge caching

Your app will load fast worldwide! 🚀
