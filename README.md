# Lazy Cooking Website

One-person Indian(+) meal-prep decision engine. A mobile-first web app (PWA)
that answers "what do I cook tonight?" from your energy level and freezer
state, and runs the batch-cooking system around it.

Everything is client-side. No backend, no accounts — your data lives in the
browser's localStorage (backup/restore built in, Freezer tab → Your data).

---

## Run it on your computer (start here if you've never done web dev)

You do not need to know JavaScript. It's four one-time steps, then a single
command each time you want to run it.

### Step 0 — Install Node.js (one time, ~2 min)

Node.js is the engine that builds and runs the app. It comes with `npm`, the
command the steps below use.

- Go to **https://nodejs.org** and download the **LTS** version.
- Run the installer, click through the defaults.
- To confirm it worked, open a terminal (see Step 2) and type:
  ```
  node --version
  ```
  If it prints something like `v20.x.x`, you're set.

### Step 1 — Unzip the folder

Unzip `lazy-cooking-website.zip` somewhere you'll find it (e.g. your Desktop).

> **Heads-up:** the folder contains a `.github` folder that stays hidden in
> Finder/Explorer because its name starts with a dot. That's normal — it's
> still there and it's needed for the GitHub deploy below. You don't have to
> do anything with it.

### Step 2 — Open a terminal *in that folder*

**macOS:** Open the **Terminal** app (Cmd+Space, type "Terminal"). Type
`cd ` (with a space), then drag the unzipped `lazy-cooking-website` folder
from Finder onto the Terminal window and press Enter. You're now "inside"
the folder.

**Windows:** Open the unzipped folder in File Explorer, click the address
bar, type `powershell`, and press Enter. A blue terminal opens already
inside the folder.

To check you're in the right place, type `ls` (Mac) or `dir` (Windows) and
press Enter — you should see `package.json`, `src`, `public`, and `README.md`.

### Step 3 — Install the app's dependencies (one time)

```
npm install
```

This downloads the libraries the app needs into a `node_modules` folder. It
takes 10–30 seconds and only has to be done once.

### Step 4 — Build and run it

```
npm start
```

This builds the app and starts a local web server. When it prints

```
Open this in your browser:  http://localhost:8000
```

open that address in your browser and the app is running. Press **Ctrl+C**
in the terminal to stop it.

That's it. Next time, you only need Step 4 (`npm start`).

**Commands summary**

| Command | What it does |
|---|---|
| `npm install` | One-time setup (downloads dependencies) |
| `npm start` | Build **and** run locally at http://localhost:8000 |
| `npm run build` | Just build into `dist/` (what the deploy uses) |
| `npm run serve` | Just serve an already-built `dist/` |

---

## Put it online

Once it runs locally, you can host it so it's reachable from your phone.

### Option A — GitHub Pages (simplest, public repo)

This repo includes an automated deploy workflow at
`.github/workflows/deploy.yml` (the hidden `.github` folder from the note
above). GitHub runs it for you on every push — you don't run it yourself.

1. Create a **new GitHub repo** under your personal account (name it e.g.
   `lazy-cooking-website`). **Don't** add a README/licence on creation —
   keep it empty.
2. In the terminal, still inside the folder, push these files up. Replace
   `YOU` with your GitHub username:
   ```
   git init
   git add -A
   git commit -m "lazy cooking website v1"
   git branch -M main
   git remote add origin https://github.com/YOU/lazy-cooking-website.git
   git push -u origin main
   ```
   (If `git` isn't installed, macOS will offer to install it; on Windows get
   it from https://git-scm.com.)
3. On GitHub, open the repo → **Settings → Pages** → under **Source** choose
   **"GitHub Actions"**. This is a one-time click.
4. Open the repo's **Actions** tab — you'll see the deploy running. When it
   finishes (~1 min), your app is live at
   `https://YOU.github.io/lazy-cooking-website/`.

Every future `git push` redeploys automatically.

> If the Actions tab shows no runs, the `.github` folder didn't get pushed —
> usually because it was deleted while unzipping. Re-unzip, or create the
> file manually: it's `.github/workflows/deploy.yml`.

### Option B — Cloudflare Pages (keeps the repo private, free)

Push to a **private** GitHub repo (same as above), then in the Cloudflare
dashboard → Workers & Pages → Create → Pages → connect the repo with:

- **Build command:** `npm ci && npm run build`
- **Build output directory:** `dist`

Site appears at `lazy-cooking-website.pages.dev`. Cloudflare ignores the
GitHub Actions workflow; you can delete `.github/` if you go this route.

> The *site* is effectively public on both options (an unguessable-ish URL on
> Cloudflare). There's nothing sensitive in it — your data never leaves your
> phone's browser.

---

## Install on your iPhone

Open your live URL in **Safari** → Share button → **Add to Home Screen**.
You get a full-screen app with the flame icon that works offline after the
first load.

localStorage is **per browser, per device** — the home-screen app has its
own storage separate from Safari. Use Download/Copy backup (Freezer tab →
Your data) before switching devices or hosts.

---

## Using it

- **Tonight** — pick your flame (low / medium / high), toggle what's in the
  fridge. Top group = cook from what's in; second group = worth a shop or 20
  extra minutes, with the missing item shown. P/V/C dots = protein/veg/carb
  balance; ⚑ lines tell you how to hit the ~35 g protein floor.
- **Arsenal** — every dish, grouped by technique family. **＋ Add recipe**
  for your own (ingredients/steps optional). Edit *any* recipe, including
  built-ins; edits show an `edited` badge and can be reset. Mark dishes
  **✓ tried & true** — at low flame the engine ranks those above experiments
  — and log tweaks in **field notes**.
- **Prep day** — four plans for four kinds of weekend, Instant Pot + stove as
  parallel lanes. "+ Week plan" on any recipe builds the merged **shopping
  list** here.
- **Freezer** — the counters that drive Tonight. Update when you batch and
  when you raid. **Your data** section: backup, restore, reset.

First move after deploying: run the **Full Sunday** plan once. It stocks the
frozen base + dal portions that every fast weeknight depends on.

---

## Maintaining with Claude Code

The repo carries `CLAUDE.md` with full design context — data model, engine
rules, recipe-authoring rules, verified cooking constants with sources. From
the repo folder:

```
claude "add a beef rendang recipe to the coconut family"
claude "the tehri came out wet — check the water ratio against sources"
```
