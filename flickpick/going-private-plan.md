# Plan: Going private with flickpick (and the GameDesignerJoe.github.io repo)

## Context

The current repo is `github.com/GameDesignerJoe/GameDesignerJoe.github.io` — public, and required to be public because:
- The name `<username>.github.io` is a GitHub-special "user site" repo. GitHub Pages serves it at `https://gamedesignerjoe.github.io` automatically.
- On the **free** GitHub plan, Pages on user-site repos requires the repo to be public.

The repo holds Joe's whole portfolio of small projects — 20+ subfolders (cartographer, the-watch, asciiExplore, color-match, flickpick, etc.). Most are static; flickpick is the one with serverless functions (deployed via Vercel).

Joe's stated worry: *"if it's all public, that will be an issue for me down the road when I start taking this stuff seriously."* The concern is forward-looking — not a today problem, but he wants to know the path before he's locked in.

There's also a tension to flag explicitly: the AI Provider settings card now contains a security disclosure that points at the public proxy source as the basis for *why* a stranger should trust the app with their API key. **Going fully private breaks that argument.** Whatever option Joe picks needs an answer for that.

---

## The realistic options

### Option A — Extract flickpick into its own private repo (recommended for flickpick specifically)

Treat flickpick as a graduating project. The portfolio repo stays public; flickpick moves to a new private repo and continues to deploy via Vercel.

**Pros:**
- Surgical: only the project Joe wants to gate gets gated. Other portfolio pieces stay public for showcasing.
- No GitHub Pro required. Vercel's free tier deploys from private GitHub repos.
- The portfolio URL `gamedesignerjoe.github.io` keeps working unchanged.
- Cleanest mental model: each project that "gets serious" graduates the same way.

**Cons:**
- Loses the portfolio benefit of "anyone can see all my stuff at once."
- Breaks the security disclosure unless you do one of these mitigations:
  - **(a)** Create a tiny **public mirror repo** containing only `flickpick/api/recommend.js` and `flickpick/providers/*`. The disclosure links there. You manually push proxy changes to both — small cost, since those files barely change.
  - **(b)** Drop the "verify on GitHub" sentence from the disclosure and reword to "we promise X, Y, Z" (weaker, but simpler).
  - **(c)** Point the disclosure at a tagged release of the proxy code on the public repo (one-time mirror, trust the timestamp).

### Option B — GitHub Pro for $4/month, take the whole repo private

Pro lets `<username>.github.io` repos stay private and still serve via Pages.

**Pros:**
- Zero migration. Just flip the visibility setting and pay.
- All projects gain privacy in one move.
- Keeps the same git history, same URL, same everything.

**Cons:**
- $48/year forever, even for the projects you'd be happy to keep public.
- Still breaks the flickpick security disclosure — same mitigations as Option A (a)/(b)/(c) needed.
- Doesn't actually solve the underlying question of "which projects deserve to be private vs not." You'll re-ask this question per-project over time anyway.

### Option C — Don't go private; make it auditable instead

Reframe the worry. "Taking it seriously" doesn't have to mean "hide the source." Public source code with an appropriate license can:
- Protect you legally (AGPL means anyone using your code commercially has to release theirs)
- Protect you reputationally (the security disclosure earns trust BECAUSE the code is public)
- Cost nothing
- Let interested users / employers / collaborators read your work

This is the right answer if your "serious" worry is *theft* / *commercial copying*. It's the wrong answer if your worry is *not wanting people to read your work-in-progress*.

### Option D — Hybrid open-core

Public repo for the proxy + adapters (the small, security-relevant slice). Private repo for the app + UI + future commercial features.

This is essentially Option A's mitigation (a) elevated to the primary plan: the public repo isn't a mirror — it's the actual home of the verifiable code. The private repo `git submodule`s or `npm install`s from the public one.

**Pros:**
- The trust story stays intact (proxy is public).
- Most of your work-in-progress is gated.

**Cons:**
- Two-repo workflow has friction.
- Submodule UX is famously annoying.
- Probably overkill for a hobby/early-commercial project. Worth it later, not now.

---

## Recommendation

**Don't do anything today.** When you're actually ready to commercialize flickpick, do **Option A with mitigation (a)**:

1. Pick a moment when flickpick has stopped changing daily.
2. Create a new private repo: `flickpick-app` (or whatever).
3. Extract `flickpick/` with its full git history using `git subtree split` or `git filter-repo`. (Filter-repo is the modern, recommended tool — installs via pip.)
4. Push the extracted history to the private repo.
5. In the Vercel dashboard, change the project's connected repo to the new one. Vercel re-deploys; no downtime if you do it carefully.
6. Replace `flickpick/` in the portfolio repo with a tiny landing page that links to the live Vercel URL (so the portfolio still showcases the project even though source is gated).
7. Create a tiny public repo `flickpick-proxy-source` containing only `api/recommend.js` and `providers/*.js`. README explains "this is the verifiable security-relevant slice; the full app lives privately." Small enough that ongoing maintenance is one `cp` and a `git commit` per proxy edit.
8. Update the security disclosure in flickpick to link to the public proxy repo instead of the current GameDesignerJoe.github.io path.

Reasons to pick A over B (Pro):
- You only have one project that needs privacy. Paying $48/year to gate work that you're happy to keep public is a bad trade.
- The flickpick-graduates-to-its-own-repo motion is repeatable for future projects.

Reasons to pick A over C (stay public):
- C is the right answer if your worry is *commercial theft*, not *visibility-while-developing*. Joe's wording ("when I start taking this stuff seriously") sounds more like the latter — wanting room to tinker without a public audience. A respects that; C doesn't.

Reasons to pick A over D (open-core):
- D is the same shape as A's mitigation (a), with extra git ergonomics overhead. A is simpler now and can evolve into D if the public mirror grows.

---

## When you're ready, the actual steps

This is the playbook — do not execute today.

**Prereqs:**
- `git filter-repo` installed (`pip install git-filter-repo`).
- Vercel CLI logged in (`vercel login`), or use the Vercel dashboard.
- A new private repo created on GitHub (empty, no README, no license).

**Step 1: extract flickpick with full history into a fresh clone**
```bash
git clone https://github.com/GameDesignerJoe/GameDesignerJoe.github.io.git /tmp/flickpick-extract
cd /tmp/flickpick-extract
git filter-repo --path flickpick/ --path-rename flickpick/:
```
That second command rewrites history so only `flickpick/` survives, and lifts everything up one directory level so the new repo isn't `flickpick/flickpick/`.

**Step 2: push to the new private repo**
```bash
git remote add origin git@github.com:GameDesignerJoe/flickpick-app.git
git push -u origin main
```

**Step 3: re-point Vercel**
- Vercel dashboard → flickpick project → Settings → Git → Disconnect.
- Reconnect to the new private repo. Vercel will trigger a fresh deploy on first push.
- Verify the deploy URL still works.

**Step 4: clean up the public portfolio repo**
- Delete `flickpick/` from the public repo (it's now mirrored elsewhere, so this is safe).
- Add a small landing page at `flickpick/index.html` that just says "Flickpick has its own home now → live demo / private source" and links to the Vercel URL.
- Commit and push.

**Step 5: the public proxy mirror**
- Create another small public repo: `flickpick-proxy-source`.
- Copy `api/recommend.js` and the `providers/` directory into it.
- README explains the trust model and links to the live app.
- This is the URL the security disclosure points at going forward.

**Step 6: update the security disclosure**
- In the now-private flickpick repo, edit `index.html` (the AI Provider security hint).
- Change the GitHub link from `GameDesignerJoe.github.io/blob/main/flickpick/api/recommend.js` to the new public mirror URL.
- Deploy.

**Ongoing maintenance** (after the migration):
- When you change `recommend.js` or any adapter, also `cp` the change to the public mirror and push. Realistic frequency: maybe once a quarter. If it gets onerous, escalate to Option D (real submodule).

---

## Other items worth noting now

- **Cloud sync security mention.** The current cloud-sync code in `flickpick/api/sync.js` has a separate weak-link issue (predictable blob naming + the public repo reveals the URL pattern, making sync codes enumerable). Going private on flickpick incidentally fixes that — once the source is private, attackers can't trivially read the URL pattern. So the sync-code-strengthening work I called out as a follow-up earlier becomes lower priority once the repo is private.

- **License decision.** Whatever path you pick, drop a `LICENSE` file in the flickpick repo before going commercial. Default GitHub repos have no license, which technically means *all rights reserved* — fine for private, surprising for users who fork. Pick something deliberate (MIT for permissive, AGPL for "I want my changes back if you commercialize," proprietary for fully closed).

- **Don't accidentally lose history.** `git filter-repo` rewrites history. Run it on a fresh clone (the prereqs above), not on your working directory. The old portfolio repo keeps its history intact.

- **GitHub Pages of the user-site repo.** Even after extracting flickpick, the rest of your portfolio at `gamedesignerjoe.github.io` keeps working. The `<username>.github.io` repo just needs to stay public (which it does in this plan).

---

## Verification

There's nothing to verify until you actually run the migration. When you do:

1. Live Vercel URL still works after re-pointing.
2. `git log` in the new private repo shows the full flickpick commit history.
3. Public portfolio still shows all other projects at `gamedesignerjoe.github.io`.
4. Old `flickpick/` path on the portfolio either 404s (acceptable) or redirects to the new live URL (preferred).
5. Security disclosure link in the live app points at the public mirror and resolves to a real `api/recommend.js`.
6. Open the public mirror in a browser and read the proxy code as if you were a skeptical user — the trust story still works.
