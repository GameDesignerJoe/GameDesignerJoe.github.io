# Wayward — Image Generation Setup Guide

This guide walks through setting up local AI image generation for Wayward using ComfyUI on a Windows laptop, ngrok for remote access, and Vercel Blob for image storage.

---

## How It Works

1. You create a scenario on your phone
2. Tapping "Generate Image" sends the companion description to your laptop's ComfyUI instance
3. ComfyUI generates the image locally using FLUX (no cost, no restrictions)
4. The image uploads to Vercel Blob storage
5. Your phone pulls it from Blob and displays it as the companion thumbnail

Image generation only needs to happen once per companion. Your laptop just needs to be on and running when you create scenarios.

---

## Phase A — Install ComfyUI on Your Windows Laptop

### Step 1 — Install Python

Go to **python.org/downloads** and download Python 3.11.

> ⚠️ During install, check the box that says **"Add Python to PATH"**. This is easy to miss. If you skip it, nothing will work and you'll need to reinstall.

### Step 2 — Install Git

Go to **git-scm.com** and download Git for Windows. Default install options are fine throughout.

### Step 3 — Download ComfyUI

Open a terminal (search "cmd" in the Windows start menu) and run these commands one at a time:

```
cd C:\
git clone https://github.com/comfyanonymous/ComfyUI
cd ComfyUI
```

### Step 4 — Install ComfyUI Dependencies

Still in the same terminal window:

```
pip install -r requirements.txt
```

This installs everything ComfyUI needs. It takes a few minutes — let it run.

### Step 5 — Download the FLUX Model

Go to **huggingface.co** and search for **"flux schnell gguf"**. You want the file called:

```
flux1-schnell-Q6_K.gguf
```

This file is around 9GB so give it time to download. Once downloaded, move it to:

```
C:\ComfyUI\models\checkpoints\
```

### Step 6 — Test That ComfyUI Runs

In your terminal:

```
cd C:\ComfyUI
python main.py
```

Open a browser on your laptop and go to:

```
http://127.0.0.1:8188
```

You should see the ComfyUI interface. If you do — you're done with Phase A.

> 🔧 **Troubleshooting:** If the terminal says "python not found", the PATH checkbox was missed during install. Reinstall Python with that box checked.

---

## Phase B — Expose ComfyUI to the Internet (ngrok)

Your phone needs to reach your laptop. ngrok creates a secure tunnel from the internet to your laptop without any complicated router configuration.

### Step 1 — Install ngrok

Go to **ngrok.com**, create a free account, and download the Windows version. It's a single `.exe` file — no installer needed.

### Step 2 — Authenticate ngrok

After signing up, ngrok gives you an auth token. Run this in a terminal (replace with your actual token):

```
ngrok config add-authtoken YOUR_TOKEN_HERE
```

You only need to do this once.

### Step 3 — Starting Everything Up

Each time you want image generation to work, open **two terminal windows** and run one command in each:

**Terminal 1 — Start ComfyUI:**
```
cd C:\ComfyUI
python main.py
```

**Terminal 2 — Start ngrok:**
```
ngrok http 8188
```

ngrok will display a URL that looks like:
```
https://abc123def456.ngrok.io
```

Copy that URL — this is your laptop's public address.

### Step 4 — Add the URL to Vercel

Go to your Wayward project in the Vercel dashboard → Settings → Environment Variables and add:

```
COMFYUI_URL = https://abc123def456.ngrok.io
```

> ⚠️ The ngrok URL changes every time you restart ngrok (on the free plan). You'll need to update this environment variable each session, or upgrade to ngrok's paid plan ($8/mo) for a static URL.

---

## Phase C — Vercel Blob Setup

Vercel Blob stores the generated images so your phone can access them.

### Step 1 — Enable Blob in Vercel Dashboard

Go to your Wayward project in Vercel → Storage → Create Database → Blob. It connects automatically and adds a `BLOB_READ_WRITE_TOKEN` environment variable to your project.

### Step 2 — Add Blob Package

In your Wayward project terminal:

```
npm install @vercel/blob
```

Commit and push. Vercel Blob is now ready. Claude Code handles the rest.

---

## Phase D — Wire It Into Wayward (Claude Code Prompt)

Give this prompt to Claude Code:

> "Add image generation to Wayward using a local ComfyUI instance and Vercel Blob storage. Here's how it should work:
>
> **When a user saves a companion and taps 'Generate Image':**
> 1. Pull the companion name, description, and scenario setting from the current scenario data
> 2. Use the Groq API to auto-generate an image prompt from those fields using a simple prompt like: 'Write a concise image generation prompt for a fantasy portrait. Character name: [name]. Description: [description]. Setting: [scenario setting]. Format: cinematic portrait, highly detailed, dramatic lighting, [key visual details].'
> 3. Send that generated prompt to a `/api/generate-image` route which calls the ComfyUI API at the URL stored in `COMFYUI_URL` environment variable
> 4. ComfyUI generates the image and returns it
> 5. Upload the result to Vercel Blob storage using `@vercel/blob`
> 6. Save the Blob URL back to the scenario's companion data in localStorage
> 7. Display the image as the companion thumbnail everywhere it appears in the app
>
> **UI in the Companion tab of the scenario editor:**
> - Add a 'Generate Image' button beneath the companion description field
> - While generating, show a loading state with the text 'Generating... this takes about a minute' — set the request timeout to 120 seconds
> - Once complete, display the generated image with a 'Regenerate' button for a fresh attempt
> - If `COMFYUI_URL` is not set or unreachable, show a friendly message: 'Image generation requires your laptop to be running with ComfyUI and ngrok active.'
>
> **ComfyUI API call:**
> Use ComfyUI's `/prompt` endpoint with a minimal FLUX workflow that accepts a text prompt and returns a generated image. Target 1024x1024 resolution.
>
> **Environment variables required:**
> - `COMFYUI_URL` — ngrok URL of the local ComfyUI instance
> - `BLOB_READ_WRITE_TOKEN` — already set by Vercel Blob setup"

---

## Phase E — One-Click Launch Script (Claude Code Prompt)

Once everything is working, ask Claude Code to create a launch script:

> "Create a Windows batch file called `start-wayward-image.bat` that I can save on my desktop. When double-clicked, it should open two terminal windows — one running ComfyUI (`cd C:\ComfyUI && python main.py`) and one running ngrok (`ngrok http 8188`). Add a pause at the end of the ngrok window so I can see and copy the generated URL before the window closes."

---

## Quick Reference — Starting Image Generation

When you want to generate images:

1. Double-click `start-wayward-image.bat` on your desktop
2. Copy the ngrok URL from the ngrok terminal window
3. Update `COMFYUI_URL` in Vercel environment variables if it changed
4. Open Wayward on your phone and generate away

When you're done, just close both terminal windows.

---

## Estimated Setup Time

| Phase | Time |
|---|---|
| Phase A — ComfyUI install | 30–45 min (mostly download time) |
| Phase B — ngrok setup | 10 min |
| Phase C — Vercel Blob | 5 min |
| Phase D — Claude Code | Claude Code handles it |
| Phase E — Launch script | 2 min |

---

## Future Upgrade — Static ngrok URL

If updating the ngrok URL every session gets annoying, ngrok's paid plan ($8/mo) gives you a permanent static URL. Then `COMFYUI_URL` never needs to change and the whole thing just works whenever your laptop is on.
