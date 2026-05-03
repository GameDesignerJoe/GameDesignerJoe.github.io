Plan: Stage 1 — BYOK Claude + TMDB-only fallback
Context
Today, every AI call (search disambiguation, recs carousels, similar grid backfill) hits /api/recommend.js, which reads ANTHROPIC_API_KEY from Vercel env. That key belongs to Joe's company account — every search a friend runs costs the company money, which makes sharing the app awkward.

The goal of Stage 1 is to stop the app from depending on Joe's paid key while keeping the experience usable for both (a) Joe with his own personal key and (b) shared users with no key at all.

Locked-in choices from planning:

No key → "degraded but functional": TMDB-only paths handle exact-title search, single-item similar grids, and TMDB-seeded carousels. Fuzzy search and multi-title search show a CTA to Settings. Empty carousels hide silently.
Providers eventually: Claude, ChatGPT, Gemini, Grok. Stage 1 wires Claude only. Settings UI is structured so adding the others later is additive (no rewrite).
Key sync: NOT synced in Stage 1. Per-device localStorage only. See Security section below for the threat-model analysis that drove this. Stage 2 may add encrypted-with-passphrase sync.
Call path: keep /api/recommend.js as a thin proxy. It stops reading the env var; key now comes from the request body. Hard requirement: proxy must never log/persist request bodies (see Security).
Approach
Six tracks, in order:

State plumbing — extend state.settings with aiProvider + apiKeys map; include in cloud-sync round-trip.
Server proxy refactor — api/recommend.js (and dev-server.js's mirror) reads the key from request body; returns 400 if missing. No env fallback.
Single client wrapper — replace direct fetch('/api/recommend', ...) calls with callAI({ messages, model, max_tokens }). Wrapper attaches the user's key, throws a sentinel error when no key.
Gate Claude fallbacks behind hasAiKey() — every soft-AI surface that already has a TMDB-first path simply skips the Claude fallback when no key is set. Hard-AI surfaces (fuzzy search, multi-search) show a CTA.
Settings UI — new "AI Provider" section with a provider dropdown (Claude active, others greyed out with "coming soon") + masked API key input + a "Test connection" button.
Carousel/empty-section hiding — when a recs carousel can't be filled with TMDB seeds and there's no key for Claude backfill, the section hides itself instead of showing a stunted row.
Files to modify
flickpick/state.js
Extend DEFAULT_SETTINGS with the provider preference (synced) but keep keys in a separate, non-synced localStorage slot:

const DEFAULT_SETTINGS = {
  ...existing fields...,
  aiProvider: 'anthropic',         // 'anthropic' | 'openai' | 'google' | 'xai'
  updatedAt: 0,
};
// API keys live OUTSIDE state.settings — separate localStorage key, never
// included in the cloud-sync payload.
const API_KEYS_LS_KEY = 'flickpick_api_keys_v1';
Add helpers (in state.js, alongside State):

const ApiKeys = {
  get(provider) {
    try { return (JSON.parse(localStorage.getItem(API_KEYS_LS_KEY) || '{}') || {})[provider] || ''; }
    catch { return ''; }
  },
  set(provider, key) {
    let blob = {};
    try { blob = JSON.parse(localStorage.getItem(API_KEYS_LS_KEY) || '{}') || {}; } catch {}
    if (key && key.trim()) blob[provider] = key.trim();
    else delete blob[provider];
    localStorage.setItem(API_KEYS_LS_KEY, JSON.stringify(blob));
  },
  clear(provider) { this.set(provider, ''); },
};
State.importData (cloud-sync merge): explicitly does not touch API_KEYS_LS_KEY. If a future malicious payload includes an apiKeys field, it's ignored. Add a defensive guard so existing in-flight code that might inadvertently spread imported settings into local doesn't carry keys.

State.load() / _persist() / updateSettings() are unchanged for keys — they only deal with state.settings.

flickpick/api/recommend.js
Currently reads ANTHROPIC_API_KEY from process.env. Change to:

export default async function handler(req, res) {
  const { messages, model, max_tokens, apiKey } = req.body || {};
  if (!apiKey) return res.status(400).json({ error: 'No API key provided' });
  // ...existing Anthropic SDK call, but instantiate with `new Anthropic({ apiKey })`...
}
Strip env-var fallback so a forgotten dev secret can't accidentally re-enable company billing.

flickpick/dev-server.js
Same change in the local mirror around dev-server.js:20-46. Read apiKey from body, no env fallback.

flickpick/app.js
A. New helpers (top of file, near other utilities):

function hasAiKey() {
  const provider = state.settings?.aiProvider || 'anthropic';
  return !!ApiKeys.get(provider);
}

async function callAI({ messages, model, max_tokens }) {
  const provider = state.settings?.aiProvider || 'anthropic';
  const apiKey = ApiKeys.get(provider);
  if (!apiKey) throw new NoAiKeyError();
  const res = await fetch('/api/recommend', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, model, max_tokens, apiKey }),
  });
  if (!res.ok) throw new Error(`AI call failed: ${res.status}`);
  return res.json();
}
class NoAiKeyError extends Error { constructor() { super('NO_AI_KEY'); this.code = 'NO_AI_KEY'; } }
Note: ApiKeys is defined in state.js and reads from a separate localStorage key, never state.settings. This prevents cloud-sync from ever round-tripping the key.

B. Replace 6 fetch('/api/recommend', ...) call sites with callAI(...) at:

fetchClaudeSimilar (app.js ~line 2117)
fetchClaudeMultiSimilar (~line 2157)
doSearch Claude fallback (~line 2362)
maybeLoadMoreChooserCandidates (~line 2745)
fillSuggestionPool (~line 3060)
fetchOneRec (~line 1187)
Each site's outer caller wraps the call in try { ... } catch (e) { if (e.code === 'NO_AI_KEY') { /* TMDB-only path or CTA */ } else throw }.

C. Soft-AI surfaces (TMDB fallback already exists):

fetchClaudeSimilar callers (app.js:2298, 2395, 3207, 3253): already use the pattern tmdb || claude. Just let the Claude branch silently no-op when no key. No UX surface to show — TMDB result either fills or doesn't.
fillSuggestionPool: when no key, set poolExhausted = true after TMDB returns nothing more. Pagination naturally stops.
fetchOneRec (carousel backfill): when no key, return null. Caller already handles "TMDB exhausted, give up" via lovedConsecutiveFails. Bonus: hide the carousel section if it ends up with < 3 items after TMDB-only seeding (new logic in the carousel render).
D. Hard-AI surfaces (no TMDB substitute):

doSearch fuzzy fallback: when TMDB-first returns 0 hits AND no key → show empty state with <button>Add an API key in Settings</button> that calls showPage('settings') and scrolls to the AI section.
fetchClaudeMultiSimilar (multi-title search): same CTA. The TMDB-first path already returns either single-hit-featured or multi-hit-chooser; the multi-title comma path falls through to here only when both options aren't viable.
E. Settings UI (renderSettingsPage at app.js:1688):

New section card placed above "Filters", titled "AI Provider":

<div class="settings-section-card">
  <div class="settings-section-title">AI Provider</div>
  <div class="settings-hint">Used for smart search ("spy shows"), multi-title matches, and fresh recommendations. Without a key, the app falls back to TMDB-only data.</div>

  <label class="settings-row settings-toggle">
    <span>Provider</span>
    <select class="settings-select" id="setting-ai-provider" data-action="set-ai-provider">
      <option value="anthropic">Claude (Anthropic)</option>
      <option value="openai" disabled>ChatGPT (coming soon)</option>
      <option value="google" disabled>Gemini (coming soon)</option>
      <option value="xai" disabled>Grok (coming soon)</option>
    </select>
  </label>

  <div class="settings-row settings-key-row">
    <input type="password" class="settings-input" id="setting-ai-key" placeholder="sk-ant-..." data-action="set-ai-key" autocomplete="off" spellcheck="false">
    <button class="settings-btn" data-action="toggle-key-visibility" title="Show/hide">👁</button>
    <button class="settings-btn settings-btn-primary" data-action="test-ai-key">Test</button>
    <button class="settings-btn" data-action="clear-ai-key" title="Remove key">✕</button>
  </div>
  <div class="settings-status" id="ai-key-status"></div>
  <div class="settings-hint">Get a Claude key at <a href="https://console.anthropic.com/" target="_blank" rel="noopener">console.anthropic.com</a>. The key stays only on this device — it is <strong>not</strong> included in cloud sync. Enter it again on each device you use.</div>
</div>
Handlers:

set-ai-provider (change event) → State.updateSettings({ aiProvider: value }) (synced).
set-ai-key (change event, not input) → ApiKeys.set(provider, value.trim()). Listening to change (commit on blur / Enter) instead of input avoids saving every keystroke into localStorage.
toggle-key-visibility → swap input type between password and text (in-DOM only, not persisted).
test-ai-key → fire a tiny callAI({ messages: [{role:'user', content:'hi'}], max_tokens: 10 }). Show ✓ / ✗ in #ai-key-status. On 401, surface Anthropic's error message so the user knows it's an invalid-key issue rather than a network hiccup.
clear-ai-key → ApiKeys.clear(provider), blank the input, status to "key removed".
renderSettingsPage populates the provider dropdown from state.settings.aiProvider, populates the input from ApiKeys.get(provider) (input shown as password type so the actual chars are masked).

flickpick/styles.css
.settings-key-row flex row: input grows, two buttons compact.
.settings-input text-style input matching existing settings-input pattern (already used for sync code).
A subtle indicator on the gear nav when no key is set? Out of scope this round — keep it just within the Settings page.
Reusable primitives (no new code needed)
fetchTmdbRecommendations(item, count, kind) (app.js ~line 245) — already supports 'recommendations' and 'similar' kinds. Backbone of TMDB-only fallback.
State.updateSettings(partial) — bumps updatedAt for cloud-sync conflict resolution.
refreshDiscoverFilters() — re-renders any visible discover surface; called when the user enters a key so carousels rebuild without a reload.
showPage('settings') — already wired to nav via data-action="show-page". The CTA buttons just dispatch this.
tmdbExtrasCache, tmdbIdCache, posterCache, ratingCache — none touched.
Cloud sync (api/sync.js) — round-trips the whole state object; new apiKeys field rides for free.
Edge cases
Test button hits a 401. Surface the actual Anthropic error message to #ai-key-status ("Invalid API key" / "Rate limited"), don't just say "failed".
Server still has ANTHROPIC_API_KEY set on Vercel. No-op, since the new code ignores env. Manual followup: Joe must remove that env var from Vercel after deploy. Listed in verification.
Existing users. No state migration needed — keys are a brand-new localStorage slot, missing means "no key". Settings UI shows blank input. App enters degraded mode. They'll see the CTA on next fuzzy search.
Empty key entered (whitespace). ApiKeys.set trims and deletes the entry if blank. No "ghost" empty values left behind.
fetchOneRec is called many times during carousel seeding. Each call throwing NoAiKeyError would be wasteful. Early-out: if !hasAiKey(), return null immediately without entering callAI.
Cloud sync from a malicious peer. A bad sync payload that includes an apiKeys field gets ignored by State.importData because the new code never reads keys out of parsed.settings.apiKeys. Defense in depth: even if a future bug accidentally spreads parsed.settings into local, keys aren't there to be picked up — they live in a separate localStorage slot.
Security analysis
This section exists because the obvious "stick the key in state.settings and let cloud-sync carry it" design has a meaningfully larger blast radius than the current company-key model. Calling out the trade-offs explicitly so we know what we're accepting.

Threats considered
Cloud-sync code enumeration. The repo is public. api/sync.js reveals the blob naming pattern (flickpick-sync/${code.toLowerCase()}.json). An attacker can script enumeration over common usernames ("joe", "alex", "movies") and harvest any data behind weak codes. Today's loot: someone's watchlist (annoying, not catastrophic). Loot if we sync keys: working API credentials (real damage). Mitigation: don't sync keys. Keys live in a separate localStorage slot that no code path includes in cloud-sync.

Public-repo amplifies (1). A private repo would force attackers to reverse-engineer URLs from network traffic. Public means they read the recipe and walk in. Same mitigation.

Server proxy logs. /api/recommend receives the key in the request body on every AI call. Vercel doesn't log bodies by default for production functions, but a careless console.log(req.body) in recommend.js would leak every user's key into log retention. Mitigation: explicit no-log policy in recommend.js (comment, lint-style), and the server destructures only the fields it needs ({ messages, model, max_tokens, apiKey }) instead of touching req.body as a whole.

localStorage exposure to extensions / XSS. Any JS running in the page can read localStorage. Extensions with "read site data" permission, or an XSS bug, would exfiltrate the key. Mitigations: (a) keep keys in their own localStorage slot so you can audit / clear them independently; (b) ensure all dynamic content insertion uses textContent not innerHTML for untrusted strings (this is already the convention in the codebase but worth re-grepping during implementation).

Server-side env-var leftover. If ANTHROPIC_API_KEY stays set on Vercel after deploy, a stale code path or a future revert could re-enable company billing. Mitigation: explicit verification step to delete the env var post-deploy.

Anthropic-side controls. Any key the user pastes is theirs. Anthropic's per-key rate limits and usage dashboard are the user's first line of defense if the key leaks. The settings hint should include a note: "If you suspect your key was exposed, revoke it at console.anthropic.com."

Decisions driven by this analysis
Keys stored in localStorage[flickpick_api_keys_v1], NOT in state.settings. This guarantees the cloud-sync payload never carries them, today or in any future code path that touches settings.
State.importData never writes into the api-keys slot. Defense in depth.
Server proxy guards against accidental body logging. Explicit comment + minimal destructure.
Settings UI is honest about the trust model. Hint says "stays on this device" + "enter it again on each device" + "revoke at Anthropic if exposed".
Stage 2 path for sync (deferred)
If per-device entry proves too annoying, the right fix is passphrase-based client-side encryption: user picks a passphrase distinct from the sync code, key is encrypted in the browser via WebCrypto (AES-GCM), only ciphertext goes to Vercel Blob. Server breach → ciphertext only. Sync-code guess → ciphertext only. Lose passphrase → re-enter key (acceptable).

Related: existing cloud-sync weaknesses (separate work)
Independent of API keys, the current sync code mechanism has weaknesses worth fixing:

Minimum length / entropy enforcement on new sync codes (e.g., ≥12 chars, mixed letters+digits).
Optional rate-limiting at /api/sync GET to slow down enumeration.
Out of scope for this Stage 1 PR but should be tracked as a follow-up.

Out of scope (Stage 2+)
OpenAI / Gemini / Grok adapters. Provider abstraction beyond a single dropdown. Each provider has different request/response shapes. Stage 2 introduces a providers/ module with one adapter per provider, all conforming to a { messages, model, max_tokens } → { text } interface.
Per-call provider routing. "Use Haiku for fast chooser, GPT-4o-mini for cheap recs" — a future power-user feature.
Encrypted key storage. Keys live in plain localStorage and (if synced) plain Vercel Blob. Same trust model as today's lists.
Usage/cost meter. Could later show approx tokens used for the user's key. Not now.
Removing /api/recommend.js entirely in favor of direct browser→Anthropic. Possible once we go multi-provider; for Stage 1 the proxy still earns its keep (CORS-bypass + JSON-extraction glue).
Verification
No key, exact-title search: open the app on a fresh browser (no key set). Search "Severance" → renders featured card via TMDB-first. Click in → similar grid populates from TMDB. ✓
No key, fuzzy search: search "spy shows" → loading spinner ends, empty-state CTA appears with "Add an API key in Settings". Click it → routes to Settings page, AI section visible.
Add a key: open Settings → AI Provider, paste a Claude key, click Test → status flashes ✓ within 1–2s.
Repeat fuzzy search: "spy shows" → chooser appears with disambiguated picks. ✓
Discovery page with no key: "Based on What You Love" / "Based on Your Watchlist" rows either fill from TMDB-recommendations or hide silently. No broken-looking half-rows.
Provider dropdown: ChatGPT / Gemini / Grok options visible but disabled with "(coming soon)".
Sync isolation: enter a key on Phone, sync to cloud. Open Desktop with same sync code, BEFORE entering a key → Settings shows blank key field. AI features remain in degraded mode. ✅ Confirms the key did NOT cross devices via sync.
Cloud-sync payload audit: trigger a sync, then in DevTools network tab inspect the PUT body to /api/sync. Confirm the body does NOT contain any apiKey / apiKeys / sk-ant- substring. Repeat by reading the raw blob via /api/sync?code=joe GET and confirming the same.
Server log audit: add a one-line console.log(JSON.stringify(req.body)) temporarily in recommend.js during local testing only, fire one call, confirm the log output. Then revert that log before commit. (Sanity-check that you can spot it.)
Server-side env-var cleanup: after deploy, run vercel env rm ANTHROPIC_API_KEY production (or remove via Vercel dashboard) to kill the company-billed path. Re-run a fuzzy search with no key set in the browser → still gets the CTA, doesn't silently use any leftover env. ✓
Clear-key flow: click ✕ next to the key input → input blanks, status reads "Key removed", localStorage[flickpick_api_keys_v1] no longer has the provider entry (DevTools application tab).
Per-device behavior: clear browser storage on Phone, reopen, sync code re-enters movie data BUT the key field stays blank. Required to re-enter the key. ✓ (This is the intended trade-off.)