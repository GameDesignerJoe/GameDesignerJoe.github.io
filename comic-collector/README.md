# Comic Collector

A web app that identifies comic books from cover photos using vision LLMs (Claude, OpenAI, Gemini, Grok, Groq, or a custom OpenAI-compatible endpoint), then enriches the result with canonical metadata from the ComicVine API.

## What changed from v0.1

The original v0.1 attempted to look up comics by UPC barcode via the ComicVine API. **That doesn't work** — ComicVine silently ignores the `filter=upc:...` parameter and there is no `upc` field on issue records. Every barcode would return the first record in their database. The barcode-based approach has been removed.

v0.2 replaces it with vision-based identification: take a photo of the cover, an LLM extracts series title + issue + year + publisher, then ComicVine is queried with the title-year-issue triple (the same pattern that powers Jack's Comics elsewhere in this repo).

## File layout

```
comic-collector/
├── index.html          Main page (settings modal, upload UI, results display)
├── package.json        type:"module" so Vercel treats /api files as ES modules
├── js/
│   ├── app.js          Front-end entry, wires UI + API calls
│   └── settings.js     Provider/model/API-key settings, localStorage
├── api/                Vercel serverless functions
│   ├── identify.js     Vision LLM proxy (multi-provider adapter)
│   └── comicvine.js    ComicVine lookup using our COMIC_VINE_API_KEY env var
├── docs/
│   └── comic-scanner-mvp.md   Old MVP spec (kept as historical record — DO NOT BUILD FROM THIS)
└── README.md
```

## Supported AI providers

| Provider  | API shape           | Default model used                     |
| --------- | ------------------- | -------------------------------------- |
| Anthropic | Anthropic Messages  | `claude-sonnet-4-6`                    |
| OpenAI    | Chat Completions    | `gpt-4o-mini`                          |
| Gemini    | Google GenAI        | `gemini-2.0-flash`                     |
| xAI Grok  | OpenAI-compat       | `grok-2-vision-1212`                   |
| Groq      | OpenAI-compat       | `llama-3.2-90b-vision-preview`         |
| Custom    | OpenAI-compat (BYO) | user-provided endpoint + model         |

The user supplies their own API key in the in-app Settings modal (⚙ icon, top-right). The key is stored in browser localStorage and sent with each request through the Vercel proxy — never persisted server-side.

## Vercel environment variables required

Set on the Vercel project dashboard (the existing `comic-collector` project — same Vercel app, different code now):

| Variable               | Value                                          | Used by              |
| ---------------------- | ---------------------------------------------- | -------------------- |
| `COMIC_VINE_API_KEY`   | `6be7a1f7e4ebe66403aca6ff9e8174f6a8aa9717`     | `/api/comicvine.js`  |

The existing env var from v0.1 is preserved. No new server-side keys needed — user-supplied AI keys travel in request bodies.

## Local dev

The static front-end will serve from any HTTP server, but `/api/*` functions require Vercel. To test the full flow locally:

```bash
npx vercel dev        # in the comic-collector/ folder, after `vercel link`
```

Or just push to the connected GitHub branch — Vercel auto-deploys preview URLs.

## API rate limits

- **AI providers**: per the user's own account / billing
- **ComicVine**: 200 requests/hour per resource (volumes and issues are separate buckets). One comic identification = 1 volume search + 1 issue fetch = 2 ComicVine calls

## Phases

- [x] **Phase 1**: Settings modal, image upload, AI identification proxy
- [x] **Phase 2**: ComicVine canonical lookup + display
- [ ] **Phase 3**: Save identified comics to a personal collection (localStorage)
- [ ] **Phase 4**: Cloud sync collection across devices (Vercel KV + user token)
- [ ] *Future*: Live camera viewfinder (currently just file picker / phone camera via `accept="image/*" capture="environment"`)
