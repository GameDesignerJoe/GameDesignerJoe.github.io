# Setting up the database (Supabase)

A refresher for creating the shared-world database for the multiplayer test. Supabase renames
things in its dashboard from time to time, so if a name below doesn't match, look for the nearest
equivalent.

## Keys: which one goes where

A project has two kinds of key.

- **Public key** (called "anon" or "publishable"). It goes in the site's code. That's normal and
  safe, because row-level security decides what it can do.
- **Service key** (called "service_role" or "secret"). It can do anything and bypasses all
  security. It never goes in the code, the repository, a chat or a doc. If it ever leaks,
  rotate it in the dashboard straight away.

The database password set when creating the project belongs in a password manager, not in
chat either.

## Steps

1. Go to supabase.com and sign in (signing in with GitHub is easiest).
2. Create a new project in the free plan: name it `nas-online`, set a database password (save it
   in a password manager), and pick the region nearest you.
3. Wait a minute or two while it's set up.
4. Turn on anonymous sign-in: Authentication, then Sign In / Providers (or Settings), then
   "Allow anonymous sign-ins".
5. Find the project's API settings (Project Settings, then API or API Keys) and copy two things:
   - the **Project URL** (`https://<something>.supabase.co`)
   - the **public key** (anon / publishable)
6. Send those two to Claude. They go in `nas-online/js/net/config.js`.
7. Claude writes the tables as `nas-online/db/schema.sql`. Open the project's SQL Editor, paste
   the file in and press Run. Row-level security is switched on in that file.

## Good to know

- Free projects are paused after about a week without use. Restore it from the dashboard if the
  game reports it can't connect after a quiet spell.
- Anything in the database can be seen in the dashboard's Table Editor, which is handy for
  checking the test results by hand.
