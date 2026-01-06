# Comic Scanner

A web application for scanning comic book barcodes and retrieving comic information from the Comic Vine API.

## Phase 1: Manual Barcode Entry

Currently implemented: Manual barcode entry with Comic Vine API integration.

## Deployment to Vercel

### Prerequisites
- Vercel account connected to your GitHub repository
- Comic Vine API key (already obtained)

### Setup Instructions

1. **Push your code to GitHub** (if not already done):
   ```bash
   git add comic-collector/
   git commit -m "Add comic scanner with serverless API"
   git push
   ```

2. **Create new project on Vercel**:
   - Go to [Vercel Dashboard](https://vercel.com/dashboard)
   - Click "New Project"
   - Import your GitHub repository: `GameDesignerJoe/GameDesignerJoe.github.io`

3. **Configure Project Settings**:
   - **Project Name**: `comic-collector` (or your preference)
   - **Framework Preset**: `Other`
   - **Root Directory**: `comic-collector`
   - **Build Settings**: Leave as default (no build command needed)

4. **Environment Variables**:
   Add the following environment variable:
   - **Key**: `COMIC_VINE_API_KEY`
   - **Value**: `6be7a1f7e4ebe66403aca6ff9e8174f6a8aa9717`

5. **Deploy**:
   - Click "Deploy"
   - Wait for deployment to complete

### Testing the Deployed App

1. Visit: `https://[your-deployment-url].vercel.app/comic-scanner.html`
2. Enter a comic book barcode (e.g., `75960610554703211` for The New Avengers #32)
3. Click "Search"
4. The app should display the comic name, issue number, and cover image

### Test Barcodes
- `75960610554703211` - The New Avengers #32
- (Add more barcodes from your collection as you test)

## Project Structure

```
comic-collector/
├── comic-scanner.html     # Main app (HTML + CSS + JS inline)
├── api/
│   └── search-comic.js    # Vercel serverless function for Comic Vine API
├── docs/
│   └── comic-scanner-mvp.md  # Original MVP specification
└── README.md              # This file
```

## How It Works

1. User enters a barcode in the web interface
2. Frontend calls `/api/search-comic?barcode=XXX`
3. Serverless function makes request to Comic Vine API (server-side, no CORS issues)
4. Results are returned and displayed with comic cover, name, and issue number

## API Rate Limits

- Comic Vine API: 200 requests per hour
- The app includes rate limit error handling

## Future Development

- **Phase 2**: Add camera barcode scanning using device camera
- Collection management features
- Local storage of scanned comics
- Export/import functionality
