# Lazy Cooking Website

One-person Indian(+) meal-prep decision engine. A mobile-first PWA that
answers "what do I cook tonight?" from your energy level and freezer state,
and runs the batch-cooking system around it.

Everything is client-side. No backend, no accounts — your data lives in the
browser's localStorage (backup/restore built in, Freezer tab → Your data).

## Deploy

### Option A — GitHub Pages (public repo)

1. Create a **new GitHub repo** (personal account) and push this folder:
   ```
   git init && git add -A && git commit -m "lazy cooking v1"
   git branch -M main
   git remote add origin git@github.com:YOU/lazy-cooking.git
   git push -u origin main
   ```
2. Repo → **Settings → Pages → Source: "GitHub Actions"**. (One-time click;
   the included workflow does the rest.)
3. The push triggers the build. App appears at
   `https://YOU.github.io/lazy-cooking/` in ~1 minute.

Every subsequent push to `main` redeploys automatically.

### Option B — Cloudflare Pages (private repo, free)

If you'd rather the repo stay private: push to a **private** GitHub repo,
then in the Cloudflare dashboard → Workers & Pages → Create → Pages →
connect the repo with:

- Build command: `npm ci && bash build.sh`
- Build output directory: `dist`

Site appears at `lazy-cooking.pages.dev`. The GitHub Actions workflow is
ignored by Cloudflare; you can delete `.github/` on this path if you like.

> Note: the *site* is effectively public on both options (unguessable-ish
> URL on Cloudflare). There's nothing sensitive in the app itself — your
> data never leaves your phone's browser.

## Install on iPhone

Open the URL in **Safari** → Share → **Add to Home Screen**. You get a
proper full-screen app with the flame icon. Works offline after first load
(service worker caches the shell).

localStorage is **per browser, per device** — the home-screen app has its
own storage. Set up on the phone, and use Download/Copy backup before
switching devices or hosts.

## Local development

```
npm install
bash build.sh
npx http-server dist   # or: python3 -m http.server -d dist 8000
```

(Any static server works; opening `dist/index.html` via `file://` breaks the
service worker but the app itself still runs.)

## Using it

- **Tonight** — pick your flame (low / medium / high), toggle what's in the
  fridge. Top group = cook from what's in; second group = worth a shop or 20
  extra minutes, with the missing item shown. P/V/C dots = protein/veg/carb
  balance; ⚑ lines tell you how to hit the ~35 g protein floor.
- **Arsenal** — every dish, grouped by technique family. **＋ Add recipe**
  for your own (ingredients/steps optional — metadata alone is enough for
  the engine). Edit *any* recipe, including built-ins; edits show an
  `edited` badge and can be reset. Mark dishes **✓ tried & true** — at low
  flame the engine then ranks them above experiments — and log calibration
  tweaks in **field notes** ("HP 9 next time").
- **Prep day** — four plans for four kinds of weekend, IP + stove as
  parallel lanes. "+ Week plan" on any recipe builds the merged Monday
  **shopping list** here.
- **Freezer** — the counters that drive Tonight. Update when you batch and
  when you raid. Standing items (cauli rice, spinach, peas) tracked
  separately from portion slots. **Your data** section: backup, restore,
  reset.

First move after deploying: run the **Full Sunday** plan once. It stocks the
whole system (frozen base + dal portions) that every fast weeknight depends
on.

## Maintaining with Claude Code

The repo carries `CLAUDE.md` with full design context — data model, engine
rules, recipe-authoring rules, verified cooking constants with sources.
From the repo root:

```
claude "add a beef rendang recipe to the coconut family"
claude "the tehri came out wet — check the water ratio against sources"
```

Claude Code reads `CLAUDE.md` automatically and knows the constraints
(schema migrations additive-only, whole-pack shopping rule, SSR-safe module,
service-worker cache versioning).
