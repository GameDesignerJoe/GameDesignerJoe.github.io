# Comic Collector — Design Document

> Living design doc for the comic-collector project. Future sessions should read this first before making changes. Last updated 2026-05-12 (approved).

---

## 1. Context & Vision

Joe owns roughly 30 boxes of comics. The app exists to:

1. **Rapidly catalog all of them.** Primary scanning mode: phone on a tripod looking straight down into an empty box; drop comic, scan, drop next. Target ~1 comic every couple seconds. Secondary: handheld photo capture.
2. **Use vision LLMs** to identify each comic from the cover (ComicVine has no UPC lookup — see `jackscomics_project.md` memory). Then enrich with canonical metadata via the proven jackscomics title+year+issue ComicVine pattern.
3. **Keep the original photos.** Two reasons: (a) see his actual copy's wear/notes/signed pages; (b) re-do identification later if the AI got it wrong.
4. **Celebrate the collection.** Visually-rich display focused on art and stories — NOT grades or dollar values. Series-grouped library view, highlighted key issues, AI-generated paragraphs about why each series matters.
5. **Sync everywhere.** Phone scans → laptop browses → friend's phone shows it off. Supabase is the cloud-of-truth.
6. **Stay portable.** Export to JSON or CSV anytime; never locked in.

This is a real project. Future-feature surface area is large (see §15) and the design should accommodate growth without rewrites.

## 2. Goals & Non-Goals

**Goals:**
- Rapid scan (auto-capture on stable frame) ≤2 sec per snap, hands-free on a tripod
- Manual-capture fallback for handheld use or when auto misfires
- Ability to fully disable auto-capture (for unstable lighting or just preference)
- Background queue processes AI + ComicVine + DB writes without blocking snapping
- Beautiful, art-forward display celebrating each series
- Single-user cloud-backed (Supabase magic link), works on any device the user signs into
- Open data: full JSON + CSV export at any time
- Resilience to AI mistakes: "Needs Review" queue for low-confidence items
- **iPhone web (DuckDuckGo on iOS Webkit) is the primary scan target**; desktop is the primary browse target
- **Architecture portable to a future native iOS app**: all data in Supabase, all logic in REST-callable Vercel functions, no client-only state of record

**Non-goals (explicit for v1):**
- Grading or price valuation (Joe explicitly does not want this)
- Multi-user collaboration (schema is multi-user-ready via RLS, but only one account exists)
- Barcode scanning (proven dead end for ComicVine; see memory)
- No build step / no framework (pure ES modules — keeps debuggability, matches Joe's preference)
- Offline-first (online required; we don't queue scans while offline in v1)

## 3. Clarifications

- **"Static SPA" just means no Webpack/React/SSR.** The HTML/JS/CSS load as static files; the app uses Supabase JS client and `fetch()` to do live cloud writes/reads. Sync works fully — all CRUD goes to Supabase via authenticated requests from the browser. There is no localStorage primary store; localStorage holds only ephemeral state (AI provider settings, in-flight scan queue, capture-mode preference).
- **iPhone web first.** Bottom tab bar app shell (iPhone-native pattern). Desktop adapts (wider layouts, mouse interactions); iPad gets the iPhone layout (also works fine). No iPad-specific tuning.
- **Native iOS future.** When Joe wants a real iOS app, every piece of data is already in Supabase (which has Swift SDKs), every API call goes through Vercel functions (REST, callable from anything), and auth is Supabase Auth (Swift SDKs). The web app stays in service; the native app just becomes a second client.

## 4. Core Workflows

### 4.0 Dashboard (app home / "welcome back")

This is the default landing tab when the app opens. Reference: ComicApp_06.

Layout (top to bottom):
- **Collection Overview** card: total issues, EST. year (date of the earliest `added_at`), top publisher (most-collected publisher name), most-collected series.
- **Primary action card** — "Resume Scanning" (red/accent). Tapping it switches to the Scan tab. *(Lightweight: no actual "session" persistence in v1; it's a styled shortcut.)*
- **Recent Activity** feed: latest N comics added, each a card with cover thumbnail + title + `#N` + "added X ago" + chevron → opens detail view. "View All" link → jumps to Collection sorted by date.
- **Review pending** card surfaces *only when* `needs_review > 0`: "N comics need your eyes" → opens the Review tab.

All data is derived from the existing `comics` and `series` tables; no new schema needed.

### 4.1 Rapid scan (tripod, auto-capture)

1. User opens **Scan** tab, taps **START SCANNING**.
2. Live camera viewfinder fills the screen. Subtle overlay: "Drop a comic into the frame."
3. The **stability detector** watches the video stream. When pixels stop changing for ~800ms, it snaps the current frame automatically.
4. Snap animation (white flash + shutter sound feedback). Captured frame thumbnails into a horizontal **session strip** at the bottom of the viewport.
5. **Queue worker** processes each captured frame in the background (concurrency 3):
   - Compress to JPEG ≤1600px long edge, q=0.75
   - Upload to Supabase storage
   - Call `/api/identify` (existing AI proxy)
   - Call `/api/comicvine` (existing ComicVine lookup)
   - If new series: call `/api/series-summary` to generate AI series blurb
   - Insert `comics` row, upsert `series` row
   - Update session strip thumbnail with status badge (✓ identified / ⚠ needs review / ✗ failed)
6. User taps **STOP SCANNING** when done. Session strip persists; tap any thumbnail to jump into its detail card.

### 4.2 Manual scan (handheld, or fallback when auto misbehaves)

Same UI, but auto-detection is disabled. Big tap-zone **CAPTURE** button always visible. Tap to snap.
- Selectable from Settings or from a quick toggle on the Scan view (`Auto / Manual / Off`).
- "Off" means the camera view is open but nothing automatic happens; useful while reviewing lighting before flipping back to Auto.

### 4.3 Browse collection

Two views toggleable within the **Collection** tab:

**Series view** (default — "library"):
- Each row = one series owned (Avengers, Thor, etc.)
- Series header: title, year span, publisher, AI-generated paragraph (collapsible), total issues owned
- Issue strip below: cover thumbnails in issue-number order, key issues gold-bordered
- Tap any cover → detail view

**Grid view** ("look at all this beautiful art"):
- Flat masonry grid of every cover, recency-sorted by default
- Sort: date added, year, series, publisher, key/non-key
- Search: title, issue, year, publisher
- Tap any cover → detail view

### 4.4 Review needs-review queue

Separate **Review** tab with a count badge (e.g. `Review (12)`).
- Stacked cards: user's photo + AI guess + edit fields
- Per-card actions: **APPROVE** (lock metadata, clear review flag), **RE-IDENTIFY** (rerun AI on the same photo, maybe a cropped version), **MANUAL EDIT** (set fields, re-lookup ComicVine)
- Empty state celebrates: "All caught up. Your collection is verified."

Items land here automatically when:
- AI confidence is medium or low, OR
- ComicVine returned no match, OR
- Identification raised an error

### 4.5 Detail view

Centered modal with:
- **Top**: large primary cover image. Toggle between **My photo** and **ComicVine cover** (segmented switch). Default source comes from Settings (default: ComicVine).
- **Below**: series name + issue + year + publisher; ComicVine issue title; cover date; AI-generated series paragraph (collapsible); key-issue note if any
- Action row: **TOGGLE KEY** (override auto), **EDIT METADATA**, **REMOVE** (with confirm), **VIEW ON COMICVINE**

## 5. App Shell

iPhone-first layout. **Bottom tab bar, 4 tabs in v1**, plus a **⚙ gear icon in the top-left header** for Settings (modal). References: ComicApp_03 (3-tab pattern), ComicApp_06 (dashboard concept).

```
┌──────────────────────────────────┐
│  ⚙                               │   ← gear opens Settings modal
│                                  │
│  Title (per view)                │
│                                  │
│        active view region        │
│                                  │
│                                  │
├──────────────────────────────────┤
│   🏠       📷       📚       ⚠️    │
│ Dashboard Scan  Collection Review │
└──────────────────────────────────┘
```

**Dashboard is the default landing tab** when the app opens — a high-level "welcome back" view that synthesizes the rest of the app (recent activity, scan shortcut, collection stats). Tap any other tab to jump to its workflow.

**Designed for growth.** The tab list is config-driven (an array `TABS = [{id, label, icon, viewModule}]` in `app.js`). Adding a new tab in the future (Wanted gap-filler, Share, etc.) = adding one config entry. Bottom bars support up to 5 tabs per Apple HIG; we have room for one more before needing a "More" overflow. Settings stays as a modal so it never crowds the tab row.

**Desktop / iPad layout** (>= ~900px viewport): the bottom bar becomes a left sidebar — same items, vertical orientation. Reference: ComicApp_04 (sidebar collapsible to icon-only — ComicApp_05). Sidebar shows extra context (e.g., series list with `N/N` count badges). The same view modules render in the main area regardless of nav layout.

## 6. Architecture

```
┌────────────────────────────────────────────────┐
│  Browser (static HTML + ES modules, no build)  │
│  ├─ App shell (router, bottom tab nav)         │
│  ├─ Auth gate (Supabase magic link)            │
│  ├─ View modules (scan, collection, review,    │
│  │   settings) — each in its own file          │
│  ├─ Scan-queue worker (single async loop)      │
│  └─ Supabase JS client (data + storage + auth) │
└──────────────┬─────────────────────────────────┘
               │  HTTPS
               ▼
┌────────────────────────────────────────────────┐
│  Vercel serverless functions                   │
│  ├─ /api/identify       (multi-provider AI)    │
│  ├─ /api/comicvine      (ComicVine proxy)      │
│  └─ /api/series-summary (AI series blurb)      │
└──────────────┬─────────────────────────────────┘
               │
               ▼
┌────────────────────────────────────────────────┐
│  Supabase                                      │
│  ├─ Auth (magic link, single user for now)     │
│  ├─ Postgres (series, comics, future tables)   │
│  └─ Storage (comic-photos bucket)              │
└────────────────────────────────────────────────┘
```

**Why this stack favors a future native iOS app:**
- All data in Supabase Postgres + Storage → Swift SDKs are first-class.
- Vercel functions return JSON via REST → any client can call them.
- Auth is Supabase Auth → Swift SDK supports magic link out of the box.
- The web app and a native app would share the same cloud; users could switch between them seamlessly.

## 7. Data Model

### 7.1 Supabase schema (v1)

```sql
-- Series (one row per ComicVine volume; shared across users)
create table series (
  cv_volume_id   bigint primary key,
  name           text not null,
  start_year     int,
  publisher      text,
  count_of_issues int,
  ai_summary     text,
  user_summary_edited boolean default false,
  cv_image_url   text,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

-- One row per scanned comic, owned by one user
create table comics (
  id             uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references auth.users(id) on delete cascade,

  title          text not null,
  issue          text not null,
  year           int,
  publisher      text,

  cv_volume_id   bigint references series(cv_volume_id) on delete set null,
  cv_issue_id    bigint,
  cv_cover_date  date,
  cv_image_url   text,
  cv_detail_url  text,
  cv_issue_name  text,

  photo_url      text,   -- public Supabase storage URL (single photo for v1)
  photo_path     text,

  is_key         boolean default false,
  key_note       text,
  notes          text,

  ai_provider    text,
  ai_model       text,
  ai_confidence  text check (ai_confidence in ('high','medium','low')),
  ai_raw         jsonb,
  ai_on_cover_key_text text,
  user_corrected boolean default false,
  needs_review   boolean default false,
  entry_source   text default 'ai_scan' check (entry_source in ('ai_scan','manual','imported')),

  added_at       timestamptz default now(),
  updated_at     timestamptz default now()
);

create index comics_owner_added on comics(owner_id, added_at desc);
create index comics_owner_volume on comics(owner_id, cv_volume_id);
create index comics_needs_review on comics(owner_id, needs_review) where needs_review = true;

alter table comics enable row level security;
create policy comics_select_own on comics for select using (auth.uid() = owner_id);
create policy comics_insert_own on comics for insert with check (auth.uid() = owner_id);
create policy comics_update_own on comics for update using (auth.uid() = owner_id);
create policy comics_delete_own on comics for delete using (auth.uid() = owner_id);

alter table series enable row level security;
create policy series_read on series for select using (true);
create policy series_upsert on series for insert with check (auth.role() = 'authenticated');
create policy series_update on series for update using (auth.role() = 'authenticated');
```

`entry_source` is forward-looking: `ai_scan` for scanned/identified, `manual` for manual entry (later phase), `imported` for JSON import.

### 7.2 Forward-looking schema notes (NOT built v1; documented to lock the migration path)

**Multi-photo per issue.** When we want 4-6 photos per book (for selling): drop `comics.photo_url` / `comics.photo_path`, add:
```sql
create table comic_photos (
  id           uuid primary key default gen_random_uuid(),
  comic_id     uuid not null references comics(id) on delete cascade,
  url          text not null,
  path         text not null,
  caption      text,
  is_primary   boolean default false,
  sort_order   int default 0,
  uploaded_at  timestamptz default now()
);
```
Migration: copy each `comics.photo_url` into a primary `comic_photos` row, then drop columns.

**Wanted / gap-filler list.** Either add `comics.is_wanted boolean` flag, or a sibling table `wanted_comics`. Decision deferred — they have different display semantics. Reference: FlickPick / Wanna Watch.

**View-only sharing.** New `shares` table: `id, owner_id, slug, can_view_photos, expires_at`. Public read policy keyed on `slug`. Frontend has a `/share/{slug}` route that reads the slug's owner's comics via a special RPC.

**Native iOS notes.** Schema as-is works for native. Auth via Supabase Swift SDK. Photos via Supabase Storage SDK. No changes needed.

### 7.3 Storage layout

Bucket: `comic-photos` (public read, authenticated write).
Path: `{owner_id}/{yyyy-mm}/{uuid}.jpg`

## 8. Capture & Queue Model

### 8.1 Capture modes

A single setting `capture_mode ∈ {auto, manual, off}` lives in localStorage (and is exposed in Settings + a quick toggle on the Scan view):

- **Auto**: stability detector runs; snaps when frame is stable for ~800ms. Big manual CAPTURE button is also visible as override.
- **Manual**: stability detector is dormant. CAPTURE button is the only way to snap. Used handheld.
- **Off**: camera view is open for live preview but neither auto nor manual fires. Lets the user check lighting/positioning before flipping to Auto.

### 8.2 Stability detection algorithm

```
on each animation frame (~30fps):
  if cooldown > 0: cooldown--; return
  sample downsampled (160x120) grayscale frame to typed array
  if no prev frame: cache and return
  diff = mean(abs(prev - curr)) / 255          # normalized 0..1
  cache prev = current
  if diff < threshold (default 0.02, tunable in Settings):
    stableFrames++
    if stableFrames >= 24:                     # ~800ms at 30fps
      capture()
      stableFrames = 0
      cooldown = 45                            # ~1.5s before re-arming
  else:
    stableFrames = 0
```

Threshold + frame count are tunable from Settings ("Capture sensitivity" slider) so Joe can tighten them if false snaps happen.

### 8.3 Queue worker

In-memory FIFO of jobs:
```ts
type Job = {
  id: string;
  photo_blob: Blob;
  status: 'pending'|'uploading'|'identifying'|'looking_up'|'saving'|'done'|'failed';
  attempts: number;
  error?: string;
};
```

Worker keeps up to 3 in flight at once. On `failed` with `attempts < 2`: requeue with exponential backoff. On final failure: save photo + flag `needs_review = true` with whatever metadata we have.

### 8.4 Resilience invariants

- **The photo is always saved**, even if AI/CV fail. We upload to Supabase storage first, then try AI. Photo loss is unacceptable; metadata loss is recoverable in Review.
- Low confidence → photo + AI guess saved, `needs_review = true`.
- CV miss → photo + AI guess saved, `needs_review = true`.
- High confidence + CV match → saved without review flag.

## 9. AI Prompting

### 9.1 Identification prompt (extends current `/api/identify`)

```
You identify comic books from photographs of covers and look for "key issue" markers.
Return ONLY a JSON object matching this exact schema:

{
  "title": "<series title as printed on cover>",
  "issue": "<issue number, no leading # — could be 'Annual N', 'Special N', etc.>",
  "year": <year as number or null>,
  "publisher": "<Marvel | DC | Image | Dark Horse | other>",
  "confidence": "<high|medium|low>",
  "on_cover_key_text": "<verbatim cover text suggesting this is a key issue, or empty string. Examples: 'FIRST APPEARANCE OF THE VISION!', 'KEY ISSUE!', 'ORIGIN OF SPIDER-MAN', '#1 COLLECTORS ITEM!'>"
}

If you cannot identify the comic, set confidence to low and your best guess.
Only set on_cover_key_text when there is explicit promotional text on the cover.
Output ONLY the JSON object.
```

### 9.2 Key-issue flagging

After identification:
1. If `on_cover_key_text` is non-empty → `is_key = true`, `key_note = on_cover_key_text`.
2. Else if ComicVine volume description mentions first appearance for this issue → `is_key = true`, derive `key_note` from CV description.
3. Else `is_key = false`.

User can manually toggle in detail view; manual toggles persist (`user_corrected = true`).

### 9.3 Series summary generation

New serverless function `/api/series-summary`, called once per never-before-seen series.

Input: `{ provider, apiKey, model, title, year, publisher, cv_description }`
Prompt: "Write 2-3 sentences in warm, knowledgeable prose celebrating this comic series — the era, the creators, what made it matter. Avoid pricing or grade language. Focus on art, stories, cultural significance."

Output saved to `series.ai_summary`. Never overwritten if `series.user_summary_edited = true`.

## 10. Display Principles

The UI should feel like a curated library, not a spreadsheet. Reference apps Joe likes: ComicApp_03 / ComicApp_04 / ComicApp_05.

- **Cover-forward**: covers always present at meaningful size. Never replace covers with text-only cards. Issue-number badges sit on top of the cover in a corner (`#1`, `#2`...).
- **Theme**: follow system (`@media (prefers-color-scheme: dark)`). Both light and dark are first-class — references include both. Manual theme override deferred unless user asks.
- **Typography**: bold sans-serif for primary titles (Library / Discover / series name); softer gray sans for section sub-labels (Reading / Series / Featured); warm serif for body prose (series AI summaries, key annotations).
- **Accent color**: red/coral placeholder (lifted from ComicApp_03/04/05 references) until Joe picks a final palette during wireframe review. Used for: active tab, key-issue highlights, primary action affordances.
- **Layout idioms borrowed from references**:
  - Horizontal scrolling cover strips per category / series (ComicApp_03 Library)
  - Multi-column grid for series detail (ComicApp_04 main area)
  - `N/N` count badges on series (e.g., `14/14` for complete runs)
  - Sidebar with section groupings (Issues / Series / Lists) on bigger screens
- **No pricing UI**: no dollar amounts, no grade badges, no "value" columns.
- **Detail view photo toggle**: segmented switch between My Photo and ComicVine Cover. Default source in Settings (default = ComicVine).

## 11. Export

On-demand from Settings, two formats:

**JSON** — full data plus storage URLs:
```json
{
  "exported_at": "2026-05-12T...",
  "owner_email": "joe@example.com",
  "series": [ { ...series fields... } ],
  "comics": [ { ...comic fields, photo_url is public... } ]
}
```

**CSV** — flat per-comic rows. Columns: `title, issue, year, publisher, is_key, key_note, cv_issue_id, cv_volume_id, cv_image_url, cv_detail_url, photo_url, notes, added_at`.

Photos referenced by URL only (Supabase public URLs), not embedded.

## 12. Auth

Supabase magic link.
1. First load → `views/auth.js` sign-in screen with email input.
2. User enters email → magic link sent.
3. User clicks link → returns authenticated.
4. Session in localStorage (Supabase default). On any new device, repeat email step.
5. Sign-out button in Settings.

## 13. Rate Limits & Cost Budget

| API                | Free-tier limit                      | Estimated usage (3000 comics)        |
|--------------------|--------------------------------------|--------------------------------------|
| ComicVine          | 200/hr per resource                  | ~6/min sustained, well within        |
| AI (Anthropic Haiku) | $0.25/M input + ~$0.005/img          | ~$15 total                           |
| AI (Gemini 2.0 Flash, free) | 50 RPM, 1500 RPD                   | Covers a full scanning session       |
| Supabase storage   | 1 GB free                            | ~4000 photos at 250 KB each          |
| Supabase Postgres  | 500 MB free, 50 K req/mo             | Rows tiny; well within               |

Client-side throttling on `/api/comicvine` (1 per 350 ms ≈ 170/hr) prevents 429s. AI provider 429s handled by exponential backoff in the queue worker.

## 14. File Layout

```
comic-collector/
├── index.html                  Single SPA entry, mounts views into <main>
├── package.json                "type":"module" for Vercel
├── docs/
│   ├── design.md               THIS DOCUMENT — kept updated as design evolves
│   └── comic-scanner-mvp.md    Legacy v0.1 spec (barcode-based, broken). History only.
├── js/
│   ├── app.js                  Top-level wiring, view router, auth gate, bottom tab nav
│   ├── settings.js             AI provider settings (existing, reused + extended for new prefs)
│   ├── supabase.js             Supabase client init + CRUD helpers
│   ├── scan-queue.js           Background job queue + retries
│   ├── stability-detector.js   Frame-diff capture trigger
│   ├── export.js               JSON + CSV builders
│   └── views/
│       ├── auth.js             Sign-in screen (magic link)
│       ├── dashboard.js        Home tab: stats + Resume Scanning + Recent Activity
│       ├── scan.js             Live camera + session strip + capture-mode toggle
│       ├── collection-series.js  Series-grouped browse view
│       ├── collection-grid.js    Flat grid view
│       ├── review.js             Needs-review queue
│       └── detail.js             Per-comic detail modal (with photo-source toggle)
├── api/
│   ├── identify.js             AI vision proxy (existing — extend prompt for on_cover_key_text)
│   ├── comicvine.js            ComicVine proxy (existing, reused)
│   └── series-summary.js       NEW: AI series blurb generator
├── supabase/
│   └── schema.sql              Migration script for v1 tables (above)
└── README.md                   Setup instructions for future contributors / future Joe
```

## 15. Build Phases

Current state (as of 2026-05-12):
- ✅ `/api/identify` (multi-provider AI proxy)
- ✅ `/api/comicvine` (ComicVine lookup)
- ✅ Settings modal with provider/key/model
- ✅ Live camera viewfinder + tap-to-capture
- ✅ localStorage collection with add/remove/export/import
- ✅ Edit-before-save + re-lookup flow
- ✅ Detail modal with notes

### Phase 0 — UI/UX mockups (BEFORE we commit to building anything more)
- Joe shares the mocks he has.
- Claude produces ASCII wireframes for the remaining screens (Scan, Series view, Grid view, Review, Detail, Settings, Sign-in, Bottom tab bar shell).
- Joe reviews/edits/adds.
- Wireframes embedded into this design doc.
- Lock the visual + interaction model before any code lands.

### Phase A — Supabase foundation (~30-45 min once mockups are locked)
1. Create Supabase project (web dashboard).
2. Run `supabase/schema.sql` in SQL editor.
3. Create `comic-photos` storage bucket (public read, auth write).
4. Add to Vercel env: `SUPABASE_URL`, `SUPABASE_ANON_KEY`.
5. Add `js/supabase.js` (init Supabase JS client from CDN — preserves no-build).
6. Auth gate in `app.js`: show `views/auth.js` until session exists.
7. One-shot migration of any existing localStorage comics into Supabase.

### Phase B — Bottom tab shell + view router + Dashboard (~1.5 hours)
1. Refactor `app.js`: config-driven `TABS` array (4 entries: Dashboard, Scan, Collection, Review); view-module-per-tab; router swaps modules.
2. Move existing flows into modules: `views/scan.js`, `views/collection-grid.js` (existing UI as starting point), Settings modal (existing).
3. Build `views/dashboard.js`: Collection Overview stats card, Resume Scanning action card, Recent Activity feed, conditional Review-pending card.
4. Bottom tab bar styled for iPhone Webkit (safe-area-aware, ≥44pt touch targets, red active indicator).
5. Default landing tab = Dashboard.

### Phase C — Rapid-scan workflow (~2-3 hours)
1. Build `js/stability-detector.js` (algorithm in §8.2).
2. Build `js/scan-queue.js` (FIFO + concurrency-3 worker + retries).
3. Build the new Scan view: full-bleed viewfinder, capture-mode toggle (Auto/Manual/Off), session strip, sensitivity slider in settings.
4. Wire queue worker to: Supabase storage upload → `/api/identify` → `/api/comicvine` → DB insert.
5. Extend `/api/identify` prompt to include `on_cover_key_text`.

### Phase D — Series view + key highlighting (~2 hours)
1. Build `views/collection-series.js`: query series → owned comics per series → render header + issue strip.
2. Polish `views/collection-grid.js`: pagination, sort, search.
3. Tab between Series / Grid within Collection.
4. Key-issue gold-border styling on covers.

### Phase E — Series summary + detail view photo toggle (~1.5 hours)
1. Build `api/series-summary.js`. Queue calls it once per new series.
2. Display `series.ai_summary` in series header + detail view.
3. Build `views/detail.js` with segmented photo source switch (My Photo / ComicVine), respecting `default_photo_source` setting.

### Phase F — Review queue (~1 hour)
1. Build `views/review.js`: card list, photo + AI guess + edit fields, APPROVE / RE-IDENTIFY / MANUAL EDIT.
2. Tab badge with `needs_review = true` count.

### Phase G — Export + polish (~1 hour)
1. Build `js/export.js` (JSON + CSV).
2. Settings: export buttons, sign-out, capture sensitivity, default photo source, capture mode default.
3. iPhone polish: safe-area insets, landscape behavior, DuckDuckGo browser quirks pass.

**Total v1 estimate**: ~9-11 focused hours after Phase 0 mockups are done. Phases ship in order; each is deployable.

### Future phases (called out, not built in v1)

| Phase | Feature | Notes |
|-------|---------|-------|
| H | Manual entry (no AI/API path) | Take photo + fill form by hand. `entry_source = 'manual'`. New `views/manual-entry.js`. Toggle on Scan tab and/or a + button. |
| I | Multi-photo per issue | Schema migration to `comic_photos` table (see §7.2). UI: photo carousel in detail view, "add photo" button. |
| J | Wanted / gap-filler list | Similar to FlickPick. AI suggests issues to complete owned runs. User toggles "want". New tab. |
| K | View-only sharing | `/share/{slug}` route, `shares` table, public read RLS. Settings: "Generate share link". |
| L | Native iOS app | Swift + Supabase Swift SDK consumes the same backend. Web app stays in service as the desktop client. |

These all extend the existing data model without breaking it. The reason for documenting them now is so v1 decisions don't accidentally box them out.

## 16. Verification Plan

End-to-end smoke test after each phase. Key milestones:

**After Phase A** (Supabase foundation):
- Sign in with magic link on laptop → session persists across reload.
- Same email signs in on iPhone DuckDuckGo browser → see the same empty collection.

**After Phase C** (rapid scan):
- iPhone on tripod, Scan tab, START SCANNING.
- Drop 5 comics in sequence, each ~1 sec apart.
- Each gets a session-strip thumbnail with status badge.
- Within ~20 s of last snap, switch to Collection on iPhone AND laptop simultaneously — both show the same 5 comics with photos loaded.
- Toggle capture mode to Manual. Tap CAPTURE 2 more times. Confirm only fires on tap.
- Set capture mode to Off. Confirm nothing fires.

**After Phase F** (Review queue):
- Intentionally scan a blurry / cropped cover.
- Confirm it lands in Review with photo intact.
- APPROVE / RE-IDENTIFY / MANUAL EDIT all work and update the DB.

**After Phase G** (Export):
- Export JSON; every `photo_url` resolves in a browser.
- Export CSV; opens in spreadsheet cleanly.

## 17. Open Questions / Future-Joe Notes

- **Crop/rotate before AI**: would improve identification accuracy. Defer until we see real failure rate.
- **OCR fallback when AI is rate-limited**: defer.
- **Reading-order curation**: defer; not core.
- **Public collection pages**: belongs to Phase K (view-only sharing) but doesn't block anything in v1.
- **Sound on capture**: phone has a system camera-shutter sound; consider replicating in-app for feedback parity.

---

## 18. Phase 0 — UI/UX Mockups (in progress)

Joe is sharing mocks; Claude fills in the rest. Mockups land here as we agree on them.

### Design references Joe shared (2026-05-12)

- **ComicApp_03** (iPhone, light theme): cover-forward Library / Discover / Search; bottom tab bar (3 tabs); ⚙ in top-left header; horizontal scrolling cover strips per section; red/coral accent.
- **ComicApp_04** (iPad/desktop, dark theme): left sidebar with grouped sections (Issues / Series with `N/N` count badges / Lists); 5-column cover grid in main area with `#N` issue-number badges in cover corners.
- **ComicApp_05** (iPad, dark, sidebar collapsed): full-width art gallery — the "celebrate the art" mode.
- **ComicApp_06** (iPhone, dark theme — Joe's WIP, lower influence): Dashboard / Scanner pair. Dashboard pattern: "Collection Overview" stat block (Total Volume, EST. year, Top Publisher, Most Collected), primary action card ("Resume Scanning") + secondary action ("Add Manually"), Recent Activity feed. Scanner pattern: red corner brackets on viewfinder, recent-capture thumbnail strip, big circular FAB capture button.

### Locked decisions from references review

- Theme: follow-system (light/dark auto)
- **4 bottom tabs**: Dashboard, Scan, Collection, Review + ⚙ in header for Settings
- Dashboard is the default landing tab
- Cover-forward, no metadata clutter
- Issue-number corner badges on covers
- Series `N/N` count badges
- Horizontal scrolling strips per series on Series view
- Responsive: bottom bar on phone, left sidebar on tablet/desktop
- Accent color: red/coral placeholder; Joe will lock in final shade once wireframes are concrete

### Explicitly NOT taken from references (so future-Joe doesn't relitigate)

- **No "CGC 9.4" / grade displays** anywhere. The CGC text visible in the ComicApp_06 dashboard mock was a template leftover; the non-goal in §2 stands.
- **No "Profile" tab.** Account info / sign-out lives inside the Settings modal.
- **No hamburger menu.** The hamburger top-left in ComicApp_06 conflicts with our bottom-tab nav; we use the ⚙ gear icon instead.
- **No "Add Manually" action card on Dashboard in v1.** That feature is Phase H. When Phase H ships, Add Manually can be promoted to a dashboard action card alongside Resume Scanning.
- **No batch/session tracking.** "Resume Scanning" on the dashboard is a styled shortcut to the Scan tab, not a real persisted session. We can revisit if we ever want per-box organization.

### Wireframes (Phase 0 — draft for review)

Each wireframe is layout-only, not pixel art. Spacing, alignment, and proportions are illustrative. Notes after each one describe interactions/affordances.

#### 18.1 App shell — iPhone

```
┌──────────────────────────────┐
│  ⚙        COMIC COLLECTOR    │  ← header: ⚙ opens Settings modal
├──────────────────────────────┤
│                              │
│                              │
│       (active view region)   │  ← swappable view module
│                              │
│                              │
│                              │
├──────────────────────────────┤
│   🏠      📷     📚      ⚠    │
│  Dash    Scan   Coll.   Rev. │  ← bottom tab bar (4 tabs)
│  ▔▔▔                         │  ← red underline = active tab
└──────────────────────────────┘
```

Notes:
- `safe-area-inset-bottom` padding under the tab bar (iPhone home indicator).
- Tab bar always visible except in two cases: (a) scan view in active scanning mode (full-bleed camera), (b) detail modal open.
- Active-tab indicator: red bar above icon + red label color; inactive: muted gray.
- Tab icons use SF-symbol-equivalent glyphs; text label always present (no icon-only tabs at this size).

#### 18.2 App shell — desktop (sidebar expanded)

```
┌─────────────────┬───────────────────────────────────────────────────┐
│ ⚙  COMIC COLL.  │ Title (per view)                          ⋯  ⛞    │
├─────────────────┼───────────────────────────────────────────────────┤
│  🏠 Dashboard   │                                                    │
│  📷 Scan        │                                                    │
│  📚 Collection  │              active view region                    │
│  ⚠  Review  (3) │              (wider layout — more cols, denser)    │
│                 │                                                    │
│ ── SERIES ──    │                                                    │
│  ▢ Avengers     │                                                    │
│  ▢ Thor   60/64 │                                                    │
│  ▢ X-Men  49/49 │                                                    │
│  ▢ JIM    23/23 │                                                    │
│  ▢ Strange T.   │                                                    │
│  … (collapsible)│                                                    │
└─────────────────┴───────────────────────────────────────────────────┘
```

Sidebar collapsed:

```
┌────┬───────────────────────────────────────────────────────────────┐
│ ⚙  │ Title                                              ⋯  ⛞       │
├────┼───────────────────────────────────────────────────────────────┤
│ 🏠 │                                                                │
│ 📷 │                                                                │
│ 📚 │              full-bleed art gallery                            │
│ ⚠  │                                                                │
└────┴───────────────────────────────────────────────────────────────┘
```

Notes:
- Breakpoint: `min-width: 900px` switches from bottom-tab to sidebar.
- Sidebar shows the same 4 primary destinations as the tab bar, plus a series list with `N/N` count badges (clickable → opens Series view filtered to that series).
- Collapse toggle persists in localStorage (`sidebar_collapsed`).
- Top-right `⋯` = view-specific overflow menu (sort, layout density, etc.); `⛞` = view-specific filter.

#### 18.3 Sign-in / magic-link

Pre-send:

```
┌──────────────────────────────┐
│                              │
│                              │
│      COMIC COLLECTOR         │  ← display-font logo
│                              │
│   sign in with your email    │
│                              │
│   ┌────────────────────────┐ │
│   │  you@example.com       │ │
│   └────────────────────────┘ │
│                              │
│   ┌────────────────────────┐ │
│   │   ✉  SEND MAGIC LINK   │ │  ← red primary
│   └────────────────────────┘ │
│                              │
│   Your account is just an    │  ← brief explainer
│   email — no password to     │
│   remember.                  │
│                              │
└──────────────────────────────┘
```

Post-send:

```
┌──────────────────────────────┐
│                              │
│      COMIC COLLECTOR         │
│                              │
│           📧                 │
│                              │
│   Check your email at        │
│   you@example.com            │
│                              │
│   Click the link to sign in. │
│                              │
│   ┌────────────────────────┐ │
│   │  use a different email │ │  ← secondary, ghost button
│   └────────────────────────┘ │
│                              │
└──────────────────────────────┘
```

Notes:
- This screen replaces the entire app shell — no tabs, no chrome — until a session exists.
- Magic link redirects back to the app URL; Supabase resolves the session automatically.
- If a session already exists on load, this screen is skipped entirely.

#### 18.4 Dashboard view

```
┌──────────────────────────────┐
│  ⚙        Dashboard          │
├──────────────────────────────┤
│                              │
│ ┌──────────────────────────┐ │
│ │ COLLECTION OVERVIEW      │ │
│ │                          │ │
│ │ 1,248  ISSUES            │ │
│ │ 84 series · EST. 2021    │ │
│ │                          │ │
│ │ TOP        MOST          │ │
│ │ Marvel     Avengers      │ │
│ └──────────────────────────┘ │
│                              │
│ ┌──────────────────────────┐ │
│ │ ▌ RESUME SCANNING     →  │ │  ← red action card, full-width
│ │   Pick up where you left │ │
│ └──────────────────────────┘ │
│                              │
│ ┌──────────────────────────┐ │
│ │ ⚠ 3 NEED YOUR REVIEW  →  │ │  ← appears only if needs_review > 0
│ └──────────────────────────┘ │
│                              │
│ RECENT ACTIVITY    VIEW ALL  │
│ ┌─────────────────────────┐  │
│ │ [▣] Spider-Man #129     │→ │
│ │     2 hours ago         │  │
│ └─────────────────────────┘  │
│ ┌─────────────────────────┐  │
│ │ [▣] Long Halloween #1   │→ │
│ │     yesterday           │  │
│ └─────────────────────────┘  │
│ ┌─────────────────────────┐  │
│ │ [▣] X-Men #1 (1991)     │→ │
│ │     2 days ago          │  │
│ └─────────────────────────┘  │
├──────────────────────────────┤
│   🏠      📷     📚     ⚠     │
│  Dash←   Scan   Coll.  Rev.  │
└──────────────────────────────┘
```

Notes:
- Stats derive from existing rows: `count(comics)`, `min(added_at)::year`, `mode(publisher)`, `mode(series)` (Postgres has these built-in).
- "Resume Scanning" → simply switches to the Scan tab. No actual session resume.
- "N need your review" card hides entirely when `needs_review = 0`.
- Recent Activity = last 5 comics by `added_at desc`. Each row links to the detail modal.
- "VIEW ALL" → switches to Collection tab, Grid view, sorted by date.

#### 18.5 Scan view

Idle (not actively scanning):

```
┌──────────────────────────────┐
│  ⚙   Scan       [ Auto  ▾ ]  │  ← capture-mode pill
├──────────────────────────────┤
│                              │
│  ┌────────────────────────┐  │  ← red corner brackets on viewfinder
│  ⌐ ┐                  ⌐ ┐  │
│                              │
│         live preview         │
│                              │
│  └ ⌐                  └ ⌐   │
│  └────────────────────────┘  │
│                              │
│   ┌──────────────────────┐   │
│   │   START SCANNING     │   │  ← red primary, full-width
│   └──────────────────────┘   │
│                              │
│   This session: 0 scanned    │
│                              │
├──────────────────────────────┤
│   🏠     📷     📚     ⚠      │
│  Dash   Scan←  Coll.  Rev.   │
└──────────────────────────────┘
```

Active scanning (auto-mode):

```
┌──────────────────────────────┐
│  ⚙   Scan       [ Auto  ▾ ]  │
├──────────────────────────────┤
│  ● SCANNING                  │  ← pulsing red dot
│                              │
│  ┌────────────────────────┐  │
│                              │
│         live preview         │
│                              │
│  └────────────────────────┘  │
│                              │
│         ┌──────┐             │
│         │  📷  │             │  ← override manual-capture FAB
│         └──────┘                always visible in auto mode
│                              │
│   This session: 8 scanned    │
│   ┌──┬──┬──┬──┬──┬──┬──┬──┐  │
│   │✓ │✓ │⚠ │✓ │⊙ │✓ │✓ │⚠ │→│  ← scrollable thumb strip
│   └──┴──┴──┴──┴──┴──┴──┴──┘  │
│                              │
│   ┌──────────────────────┐   │
│   │    STOP SCANNING     │   │
│   └──────────────────────┘   │
└──────────────────────────────┘
```

Notes:
- Capture-mode pill (header right) opens a small menu: Auto / Manual / Off. Persists in localStorage.
- In **Auto**: stability detector runs; FAB camera button is also visible as a manual override.
- In **Manual**: detector dormant; FAB is the only capture trigger.
- In **Off**: viewfinder shown, neither trigger fires (for checking lighting).
- Thumbnails in the session strip use status glyphs: ✓ identified, ⚠ needs review, ⊙ in-flight, ✗ failed. Tap any thumb → opens detail of that comic.
- During active scanning, the bottom tab bar is hidden so the camera gets the full viewport. A subtle "STOP SCANNING" button at the bottom returns control.

#### 18.6 Collection — Series view

```
┌──────────────────────────────┐
│  ⚙   Collection              │
│  ┌─SERIES─┬─ Grid ─┐    🔍   │  ← view toggle + search
├──────────────────────────────┤
│                              │
│  THE AVENGERS                │
│  Marvel · 1963–1996          │
│  Marvel's flagship super-    │
│  team, launched at the heig… │  ← ai_summary, truncated (tap → full)
│  22 of 85 owned              │
│  ┌──┬──┬──┬──┬──┬──┬→        │
│  │#2│#3│#4│#5│#7│★13          │  ← scrollable strip; key = gold border
│  │  │  │  │  │  │            │
│  └──┴──┴──┴──┴──┴──┘         │
│                              │
│  THE X-MEN                   │
│  Marvel · 1963–1970          │
│  Foundational Silver Age…    │
│  49 of 49 owned · complete ✓ │  ← completion badge
│  ┌──┬──┬──┬──┬──┬──┬→        │
│  │★1│#2│#3│★13│★14│#17        │
│  └──┴──┴──┴──┴──┴──┘         │
│                              │
│  JOURNEY INTO MYSTERY        │
│  Marvel · 1952–1966          │
│  The crucible of Silver Age… │
│  23 of 125 owned             │
│  ┌──┬──┬──┬──┬──┬──┬→        │
│  │#91│#92│★112│★114│#125     │
│  └──┴──┴──┴──┴──┘            │
│         ↓ (scroll)           │
│                              │
├──────────────────────────────┤
│   🏠     📷    📚←   ⚠        │
└──────────────────────────────┘
```

Notes:
- Each series row is its own self-contained block; horizontal scroll within the strip is independent of the page scroll.
- Series order: most-recently-added first (or alphabetical — pick a default, expose sort).
- Tap series header → opens series detail page with the AI summary expanded + all owned issues at larger size.
- Tap any cover → detail modal (§18.9).
- Key-issue covers get a gold border + faint glow. Issue number badge in top-left corner of each cover.

#### 18.7 Collection — Grid view

```
┌──────────────────────────────┐
│  ⚙   Collection              │
│  ┌─ Series ─┬─GRID─┐    🔍   │
│  Sort: Recent ▾   Filter ▾   │
├──────────────────────────────┤
│                              │
│  ┌────┬────┬────┐            │  ← masonry grid (3 cols phone,
│  │#129│ #1 │ #1 │              5 cols tablet, 7+ desktop)
│  │ASM │BTLH│Xmen│            │
│  └────┴────┴────┘            │
│  ┌────┬────┬────┐            │
│  │★#2 │ #7 │ #13│            │  ← ★ = key, gold border
│  │AVN │XMN │XMN │            │
│  └────┴────┴────┘            │
│  ┌────┬────┬────┐            │
│  │★#14│★#57│ #85│            │
│  │XMN │AVN │AVN │            │
│  └────┴────┴────┘            │
│  ┌────┬────┬────┐            │
│  │ #4 │ #5 │ #6 │            │
│  │CTB │JIM │JIM │            │
│  └────┴────┴────┘            │
│         ↓ (scroll)           │
│                              │
├──────────────────────────────┤
│   🏠    📷   📚←   ⚠          │
└──────────────────────────────┘
```

Notes:
- Cover-only grid. Tiny `#N` badge top-left, tiny series abbreviation bottom (or omit on small thumbs).
- Sort options: Recent (default), Year, Series, Publisher, Key first.
- Filter options: Publisher (multi), Key only, Series.
- Search input filters live across title/issue/year.
- Tap cover → detail modal (§18.9).
- Tablet/desktop: more columns, larger thumbs. Cover-art-forward.

#### 18.8 Review queue

```
┌──────────────────────────────┐
│  ⚙   Review                  │
├──────────────────────────────┤
│                              │
│  3 comics need your eyes     │
│                              │
│  ┌────────────────────────┐  │
│  │ ┌──────┐ AI guess:     │  │
│  │ │      │ AVENGERS #57? │  │
│  │ │ your │ 1968 · Marvel │  │
│  │ │ photo│ ⚠ medium conf │  │
│  │ │      │               │  │
│  │ └──────┘               │  │
│  │                        │  │
│  │ Title    [Avengers   ] │  │  ← editable
│  │ Issue    [57         ] │  │
│  │ Year     [1968       ] │  │
│  │ Publisher[Marvel     ] │  │
│  │                        │  │
│  │ ┌──────┬──────┬──────┐ │  │
│  │ │ ✓    │ ↻    │ ✎    │ │  │
│  │ │APPRV │RE-ID │MANUAL│ │  │  ← three actions per card
│  │ └──────┴──────┴──────┘ │  │
│  └────────────────────────┘  │
│                              │
│  ┌────────────────────────┐  │
│  │ ┌──────┐ AI guess:     │  │
│  │ │ user │ — no match —  │  │
│  │ │ photo│ ⚠ low / CV: 0 │  │
│  │ └──────┘ …             │  │
│  └────────────────────────┘  │
│         ↓ (scroll)           │
├──────────────────────────────┤
│   🏠    📷    📚    ⚠←        │
└──────────────────────────────┘
```

Empty state:

```
┌──────────────────────────────┐
│  ⚙   Review                  │
├──────────────────────────────┤
│                              │
│                              │
│            ✓                 │
│                              │
│      All caught up.          │
│   Your collection is         │
│        verified.             │
│                              │
│                              │
├──────────────────────────────┤
└──────────────────────────────┘
```

Notes:
- Cards are stacked, one per `needs_review = true` row.
- **APPROVE** (✓): clears `needs_review`, saves any field edits, leaves the card.
- **RE-IDENTIFY** (↻): re-runs `/api/identify` on the same photo with current AI provider. Updates fields, stays in Review until APPROVED.
- **MANUAL EDIT** (✎): switches the card to a fuller editor (year, publisher, manual ComicVine search) — still ends in APPROVE.
- Each card shows the user's photo prominently so you can see what the AI was looking at when it stumbled.

#### 18.9 Detail view modal

```
┌──────────────────────────────┐
│ ✕                            │  ← close (top-left)
├──────────────────────────────┤
│                              │
│  ┌─MY PHOTO─┬─COMICVINE─┐    │  ← segmented switch
│                              │     default per Settings
│  ┌────────────────────┐      │
│  │                    │      │
│  │                    │      │
│  │     COVER IMAGE    │      │
│  │   (toggles source) │      │
│  │                    │      │
│  │                    │      │
│  └────────────────────┘      │
│                              │
│  THE AVENGERS                │  ← title (display font)
│  #57 · 1968 · Marvel         │  ← issue · year · publisher
│                              │
│  ▌ KEY ISSUE                 │  ← shown only if is_key
│  FIRST APPEARANCE OF         │     red left border + bold
│  THE VISION!                 │
│                              │
│  ABOUT THE SERIES            │
│  Marvel's flagship super-    │  ← series.ai_summary
│  team, born of Stan Lee's…   │
│  ▾ show more                 │
│                              │
│  COVER DATE   October 1968   │
│  ADDED        2 hours ago    │
│  PHOTO        ★ taken by you │  ← link to view your photo full-size
│                              │
│  ┌─★ KEY──┬─✎ EDIT───┐       │
│  │        │          │       │
│  └────────┴──────────┘       │
│  ┌────────┬──────────┐       │
│  │🗑 REMOVE│ ↗ COMIC- │       │
│  │        │   VINE   │       │
│  └────────┴──────────┘       │
└──────────────────────────────┘
```

Notes:
- Opens full-screen on phone, centered modal on tablet+.
- Photo toggle: segmented switch at the top of the cover area; toggling persists per-comic for the session, but DEFAULT comes from Settings (My Photo / ComicVine).
- If `cover_url` (CV image) is missing, hide that segment; if `photo_url` is missing, hide that segment. Single-source = no toggle UI.
- TOGGLE KEY: flips `is_key`, sets `user_corrected = true`.
- EDIT METADATA: opens an inline form for title/issue/year/publisher; on save re-runs `/api/comicvine` to refresh the CV linkage.
- REMOVE: confirm dialog → deletes the row (cascade also deletes the photo from storage).

#### 18.10 Settings modal

```
┌──────────────────────────────┐
│  Settings           CLOSE  ✕ │
├──────────────────────────────┤
│                              │
│  ACCOUNT                     │
│  ─────────                   │
│  Signed in as                │
│  joe@example.com             │
│  [ SIGN OUT ]                │
│                              │
│  AI PROVIDER                 │
│  ─────────                   │
│  Provider  [ Claude       ▾] │
│  Model     [ haiku-4-5    ▾] │
│  API key   [ ••••••••••   ]  │
│  [ TEST CONNECTION ] [ SAVE ]│
│                              │
│  CAPTURE                     │
│  ─────────                   │
│  Default mode [ Auto      ▾] │
│  Sensitivity                 │
│  loose  ─────●─────  tight   │
│                              │
│  DISPLAY                     │
│  ─────────                   │
│  Default photo source        │
│   ○ My Photo  ● ComicVine    │
│                              │
│  EXPORT                      │
│  ─────────                   │
│  [ ⇩ EXPORT JSON ]           │
│  [ ⇩ EXPORT CSV  ]           │
│                              │
│  ABOUT                       │
│  ─────────                   │
│  Comic Collector · v0.3      │
│  Open design doc ↗           │
│                              │
└──────────────────────────────┘
```

Notes:
- Modal slides up on phone, centers on desktop. Closable via X or backdrop tap.
- AI Provider section reuses the existing settings module from v0.2 — multi-provider dropdown, custom endpoint option, test-connection.
- Capture sensitivity slider maps to the stability detector threshold (§8.2).
- Default photo source feeds the segmented switch in §18.9.
- Export buttons trigger the JSON/CSV builders in `js/export.js`.
- ABOUT links to `docs/design.md` on the GitHub repo.

---

### Wireframe sign-off

When Joe is happy with the layouts above, we lock §18 and start Phase A (Supabase foundation). Adjustments to any specific screen happen in-place in this section.

---

## Memory pointers

- `jackscomics_project.md` — ComicVine API gotchas (no UPC, custom UA required, etc.)
- `comic_collector_project.md` — recent comic-collector history, current code state
