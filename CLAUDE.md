# CLAUDE.md — Lazy Cooking Website

Context file for AI-assisted maintenance. Read this fully before changing anything.

## What this is

A one-person Indian(+) meal-prep decision engine for VK. Mobile-first PWA,
installed via Add to Home Screen on an iPhone. It answers one question well —
"what do I cook tonight, given my energy and what's in the freezer?" — and
supports the batch-cooking system around it.

**This is a personal tool, not a product.** No accounts, no sync, no backend.
One user, one kitchen. Resist generalising it.

## The user (design constraints, not biography)

- Cooks Indian food; strong on onion–tomato gravies. Batch-cooks Sunday
  (Saturday if spending Sunday in London); one main = 3–4 dinners; 4–5 home
  dinners/week.
- Kit: Instant Pot, stove, oven, blender, microwave. **No air fryer.**
- Lives alone in the UK → solo-perishable waste is a hard constraint (see
  recipe rules).
- Nutrition goal: **recomp** (lose fat, build muscle). Breakfast ≈ banana,
  lunch = sandwich → **dinner carries the day**. Protein floor ~35 g/dinner.
  Uses cauliflower rice but wants real rice when justified (portioned, paired
  with legumes; reheated rice = resistant-starch bonus).
- Engineer. Wants sourced claims, concise answers, options not prescriptions.

## Repo layout

```
src/app.jsx              — the entire app (one file, on purpose)
public/                  — static shell: index.html, manifest, sw.js, icons
build.sh                 — esbuild bundle + copy public/* → dist/
package.json             — react, react-dom, esbuild only. Keep it that way.
.github/workflows/deploy.yml — build + deploy to GitHub Pages on push to main
CLAUDE.md                — this file
README.md                — deploy + usage for the human
```

Single-file app is deliberate: trivially greppable, no import graph to hold
in your head, and the whole thing fits in one context window. Split only if
it genuinely exceeds ~2.5k lines.

## Build & test

```
npm install        # once (also refreshes package-lock.json — commit it)
bash build.sh      # → dist/  (esbuild, --jsx=automatic, minified)
```

Smoke test after any change (this is the CI-equivalent; there is no test
framework by design):

```
cat > smoke.tmp.jsx << 'EOF'
import { renderToString } from 'react-dom/server';
import App from './src/app.jsx';
const html = renderToString(<App />);
if (!html.includes('flame tonight?')) { console.error('FAIL'); process.exit(1); }
console.log('PASS', html.length);
EOF
npx esbuild smoke.tmp.jsx --bundle --jsx=automatic --platform=node --outfile=smoke.tmp.js && node smoke.tmp.js
rm smoke.tmp.jsx smoke.tmp.js
```

The module must stay SSR-importable: **no top-level `window`/`document`/
`localStorage` access**. `loadState()` guards `typeof localStorage`; the
mount call guards `typeof document`. Keep it that way or the smoke test dies.

## Persistence (the part you must not break)

Single localStorage key `lazy-cooking`, JSON blob:

```js
{ schemaVersion: 3,
  freezer: { base, dal, rice, meals, cauliRice, spinach, peas },  // ints
  fridge:  { eggs, paneer, shopped, rice },                        // bools
  customRecipes: [Recipe],        // user's own, id "custom-<ts36>"
  overrides: { [builtinId]: fields },  // user edits to built-ins, merged at load
  flags:     { [recipeId]: { tried: bool, notes: string } },
  weekPlan:  [recipeId] }
```

Rules:
- **Migrations are additive only.** Bump `SCHEMA_VERSION`, extend `migrate()`
  to default new fields, never drop or rename user data. The user's field
  notes and custom recipes are the most valuable data in the app.
- `migrate()` must accept any historical shape (including hand-edited JSON
  pasted into Import) and return a valid current-shape state.
- Export/Import (Freezer tab → Your data) round-trips the whole blob and is
  the user's backup + host-migration path. Never break it.

## Recipe data model

```js
{ id, name, tier: 0|1|2, time: minutes, concept: key of CONCEPTS,
  known: bool,                 // user already cooks this (kills "new skill" badge)
  needs: subset of [frozenBase, frozenDal, frozenRice, eggs, paneer, shopped],
  makes: string,               // "3–4 dinners" etc.
  shop: [string],              // whole-UK-pack units, pantry excluded
  ingredients: [string], steps: [string],   // optional (metadata-only allowed)
  note, leftover, pairHint: string,
  balance: { p, v, c: 0–2 } }  // protein/veg/carb dots, plate-as-presented
```

`needs: []` means pantry-only. The pantry is: rice, dals, besan, canned
chickpeas & tomatoes, yogurt, spices, onions, garlic, **ginger-garlic paste**
(user always stocks it — never list it as shopping), potatoes, frozen peas.

## Engine rules

- Flame tiers: 0 = ≤20 min no chopping (green), 1 = 25–45 min one pan + IP
  (turmeric), 2 = prep-day (chili). Tonight shows `tier <= flame`.
- **No hard availability filter.** Two groups: "Cook from what's in"
  (needs met) and "Worth a shop — or 20 extra minutes" (missing needs shown
  as chips; `kind: "shop"` → red, `kind: "time"` → amber substitutable).
- Scoring: tier match +3, uses frozen base/dal +3, combo +2. **Flame 0
  boosts tried:true (+2)** — exhausted nights get known-good; **flame ≥1
  nudges untested** (+1) — arsenal expansion happens when there's energy.
- `concept: "batch"` recipes never appear in Tonight.
- Balance dots render on every card; `pairHint` shows on Tonight cards when
  `balance.p < 2` (protein-assertive nudges toward the 35 g floor).

## Recipe authoring rules (apply to every new/edited entry)

1. Mains = 3–4 dinners. Portion 3 to the fridge, **freeze the rest on cook
   day** — weekends are unpredictable, day-4 portions never gamble.
2. **Whole-UK-pack quantities** (2 × 300 g mushroom packs, whole cauliflower,
   1 kg chicken thighs, whole 400 ml coconut tin, 225 g paneer packs).
   No "half a pepper" unless the remainder is routed.
3. Durable-veg bias (cabbage, carrots, cauliflower). Fragile veg only in
   recipes consuming the full pack in one cook.
4. Freezer-native forms for the fragile four: spinach, coriander, green
   chilies, bread.
5. `leftover` field routes any partial pack ("½ pot yogurt → raita Thursday").
   Yogurt always gets an exit (kadhi / raita / curd rice / marinade).
6. Protein floor ~35 g via the dish or its `pairHint`. Paneer flagged
   calorie-dense, not a default protein.
7. Techniques must fit the kit (IP/stove/oven/blender). No air fryer.
8. New dishes should extend an existing family (CONCEPTS) — arsenal expansion
   via familiar technique is the product thesis.

## Verified constants (don't "fix" these without re-sourcing)

| Constant | Value | Source |
|---|---|---|
| Rajma, soaked overnight | HP 30 min + NR; ~1.5–3 cups water / cup beans | pipingpotcurry.com, indianveggiedelight.com, masalachilli.com |
| Dal makhani, soaked | HP 30 min + NR (45+ only unsoaked); ~3–4 cups water / 1⅓ cups legumes | ministryofcurry.com, pipingpotcurry.com, culinaryshades.com |
| Tehri / veg pulao | rinsed basmati ~1:1.5 water (reduce ~¼ cup with frozen veg); HP 5 + **NR 10** (NR keeps grains separate) | indianveggiedelight.com, pipingpotcurry.com, petitepaprika.com |
| Plain basmati | 1:1¼, HP 4, NR 10 | standard |
| Khichdi | rice+moong equal, ~3.3× water, HP 8, NR 10 | standard |
| Toor/moong dal | HP 10 + NR | standard |
| IP boiled eggs | 1 cup water, HP 5, QR | standard (5-5-5 family) |
| Kadhi | 1½ c yogurt : 4 tbsp besan : 4 c water; stir till boil or it splits | standard |
| Thai jar paste | 3–4 tbsp per 400 ml coconut tin | jar guidance; jars vary |
| Brown rice | ~1:1¼, HP 22, NR 10 | standard |

When adding a recipe with pressure-cooker timings or ratios, **web-search
2–3 credible recipe sites and converge** before encoding; leave a `// src:`
comment. The user will catch an unsourced wrong number.

## UI conventions

- Palette in `C`: toasted brown `#211B14`, green `#8FAE5D` (tier 0), turmeric
  `#E8A020` (tier 1), chili `#D0512F` (tier 2). Fonts: Young Serif (display),
  Instrument Sans (UI), JetBrains Mono (data) — loaded in `public/index.html`.
- Inline styles only. No Tailwind, no CSS files, no UI libraries.
- Copy is dry and specific ("Zero shame."). Match it. No emoji in UI copy
  (glyphs like ⚑ ↻ ✓ are fine).
- Every builtin edit surfaces as an `edited` badge with per-recipe
  "Reset to default"; custom recipes get `yours` + delete-with-confirm.

## Deployment gotchas

- All asset paths are **relative** (`./app.js`) so the app works at
  `github.io/<repo>/` and at a Cloudflare Pages root. Don't introduce
  absolute paths.
- `sw.js`: network-first for `index.html`/`app.js` (deploys propagate),
  cache-first for icons/fonts. If you change what's precached or the caching
  strategy, **bump the `CACHE` version string** or users keep stale assets.
- GitHub Pages must be set to Source: "GitHub Actions" (README covers it).
  `npm ci` in the workflow requires `package-lock.json` to be committed.

## Adding features — the bar

Before adding anything, ask: does it help decide tonight's dinner, run a
prep day, or keep the freezer honest? If not, it's scope creep. The user
prefers options to evaluate over prescriptive single answers, and will push
back on unsupported claims — cite sources for any cooking constant.
