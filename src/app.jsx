import { useState, useEffect, useMemo } from "react";
import { createRoot } from "react-dom/client";

/* ============================================================
   LAZY COOKING — one-person Indian(+) meal decision engine
   Standalone PWA build. All persistence = localStorage.
   No freezer: the loop is hybrid — one batched main covers 2–3
   fridge nights, fresh quick dishes fill the rest. Everything the
   engine reasons about is "what's in the fridge right now".
   Design language: masala-dabba. Tier 0 low flame (green),
   Tier 1 medium (turmeric), Tier 2 bigger cook (chili).

   Verified constants carry a // src: comment. Everything else is
   convergent home-cooking knowledge — calibrate via field notes.
   ============================================================ */

const C = {
  bg: "#211B14", surface: "#2C241B", surfaceHi: "#362C20", border: "#3E3428",
  text: "#F4E9D8", muted: "#A89880", faint: "#7A6C58",
  green: "#8FAE5D", turmeric: "#E8A020", chili: "#D0512F",
  greenDim: "rgba(143,174,93,0.16)", turmericDim: "rgba(232,160,32,0.14)", chiliDim: "rgba(208,81,47,0.14)",
};

const TIERS = [
  { id: 0, name: "Low flame", sub: "≤20 min, no real chopping", color: C.green, dim: C.greenDim },
  { id: 1, name: "Medium flame", sub: "25–45 min, one pan + IP", color: C.turmeric, dim: C.turmericDim },
  { id: 2, name: "High flame", sub: "Bigger weekend cooks", color: C.chili, dim: C.chiliDim },
];

const CONCEPTS = {
  gravy: { label: "Onion–tomato gravy", note: "Home turf. Every dish here is the same move with a different thing dropped in — build a quick base, or pull from the base jar in the fridge." },
  dal: { label: "Dal + tadka", note: "Cook a pot of dal, keep it plain in the fridge, make the tadka fresh on reheat night — fresh tadka on 2-day-old dal tastes made-today." },
  bhurji: { label: "Bhurji & scrambles", note: "The scramble / poach-in-sauce family. You know the egg version; paneer and tofu transfer directly." },
  dry: { label: "Dry sabzi & tray bakes", note: "Hot fat + spices + one vegetable (or a marinated protein on a tray). No gravy to build. The fast sabzi and high-protein lanes." },
  onepot: { label: "One-pot & leftover rice", note: "Collapses rice + dal or rice + sabzi into one vessel, or transforms yesterday's rice. The lazy thali answers." },
  yogurt: { label: "Yogurt & besan", note: "Entirely pantry-driven. The best no-shopping dinners live here." },
  global: { label: "Global one-pans", note: "Non-Indian quick dinners that fit the kit — a jar of paste, a tin of coconut, or a splash of soy does the base-building for you." },
  batch: { label: "Batch enablers", note: "Not dinners — the small base and dal pots that keep the gravy and dal families fast for the next 2–3 nights." },
  mine: { label: "My recipes", note: "Yours. The engine treats them exactly like the built-ins." },
};

/* Pantry (always assumed): rice, dals, besan, canned chickpeas & tomatoes,
   yogurt, spices, onions, garlic, ginger-garlic paste, potatoes, and one
   standing bag of frozen peas (the only concession to the freezer — a bag,
   not a meal-prep system). Everything else is fresh and shopped. */

const NEED_INFO = {
  base: { label: "base jar in fridge", miss: "no base jar — build fresh base (+15 min)", kind: "time" },
  dal: { label: "cooked dal in fridge", miss: "no dal in — IP dal from scratch (+25 min)", kind: "time" },
  rice: { label: "leftover rice", miss: "no leftover rice — fresh IP rice (+12 min)", kind: "time" },
  eggs: { label: "eggs in fridge", miss: "buy eggs", kind: "shop" },
  paneer: { label: "paneer in fridge", miss: "buy paneer", kind: "shop" },
  shopped: { label: "fresh veg / meat in", miss: "needs a shop", kind: "shop" },
};
const NEED_KEYS = Object.keys(NEED_INFO);

/* balance: 0–2 dots each for protein / veg / carb, describing the plate as
   the card presents it. pairHint = what closes the gap (protein-assertive). */

const BUILTINS = [
  /* ================= TIER 0 — bridge nights ================= */
  {
    id: "tadka-dal", name: "Tadka dal (from the fridge pot)", tier: 0, time: 15, concept: "dal", known: false,
    needs: ["dal"], makes: "1–2 nights", shop: [],
    balance: { p: 1, v: 0, c: 2 },
    pairHint: "2 boiled eggs alongside (IP does them with the rice) or thick Greek-yogurt raita gets this to your protein floor.",
    hook: "A cooked dal portion from the fridge + a 3-minute fresh tadka. Tastes made-today.",
    ingredients: ["1 dal portion from the fridge (2 servings)", "1 tbsp ghee", "1 tsp cumin seeds", "2 garlic cloves, sliced", "pinch hing", "½ tsp chili powder (off heat)"],
    steps: [
      "Reheat the dal in a pan with a splash of water. Loosen to soup consistency.",
      "Meanwhile: rice in the IP — 1 cup rinsed basmati, 1¼ cups water, HP 4 min, NR 10. Or leftover rice.",
      "Small pan, ghee hot: cumin till it crackles, garlic till golden, hing; off heat, chili powder.",
      "Pour the tadka over the dal. Done.",
    ],
    note: "Pairs with jeera aloo in the same window for the full thali in ~25 min. Rice slot: real / cauli / half-half.",
    leftover: "",
  },
  {
    id: "egg-curry", name: "Egg curry from the base", tier: 0, time: 20, concept: "gravy", known: false,
    needs: ["base", "eggs"], makes: "2 nights (6 eggs)", shop: ["eggs, if out"],
    balance: { p: 2, v: 1, c: 1 },
    pairHint: "",
    hook: "Boiled eggs dropped into your base gravy. The lowest-effort 'real curry' that exists — and it hits the protein floor by itself.",
    ingredients: ["½–1 portion of base from the jar", "6 eggs", "½ tsp garam masala", "pinch kasuri methi", "water to loosen"],
    steps: [
      "Eggs in the IP: 1 cup water, HP 5 min, quick release, into cold water. (Or 8 min simmering.)",
      "Base into a pan with ~200 ml water, simmer 5 min.",
      "Garam masala + kasuri methi crushed between palms.",
      "Halve the eggs, slide in cut-side up, spoon gravy over. 2 min.",
    ],
    note: "Toast alongside keeps this at a 20-minute ceiling. Boiled eggs in gravy reheat fine for night two.",
    leftover: "Spare gravy → tomorrow's shakshuka base.",
  },
  {
    id: "khichdi", name: "Khichdi (IP one-pot)", tier: 0, time: 25, concept: "onepot", known: false,
    needs: [], makes: "2 nights", shop: [],
    balance: { p: 1, v: 1, c: 2 },
    pairHint: "Stir through 2 boiled eggs or eat with thick yogurt — comfort alone won't carry the protein.",
    hook: "Rice + dal in one pot, 5 minutes of actual effort. The canonical exhausted-Sunday-night dinner.",
    ingredients: ["¾ cup rice + ¾ cup moong dal, rinsed", "¾ tsp turmeric", "1½ tsp salt", "1½ tbsp ghee, 1½ tsp cumin", "5 cups water", "2 big handfuls frozen peas (default, not optional)"],
    steps: ["IP sauté: ghee, cumin till it crackles.", "Everything else in. Stir once.", "HP 8 min, NR 10.", "Yogurt, pickle, more ghee. Zero shame."],
    note: "The rice–dal paradigm collapsed into one vessel. Thickens overnight — loosen night two with hot water.",
    leftover: "",
  },
  {
    id: "chilla", name: "Besan chilla", tier: 0, time: 15, concept: "yogurt", known: false,
    needs: [], makes: "1 night", shop: [],
    balance: { p: 1, v: 1, c: 1 },
    pairHint: "Besan is decent protein but not enough — double the yogurt on the side, or one fried egg on top.",
    hook: "Savoury chickpea-flour pancakes, entirely from the pantry. The 'I never went shopping' dinner.",
    ingredients: ["1 cup besan", "water to thin-pancake consistency", "1 small onion, chopped fine", "1 green chili", "½ tsp ajwain or cumin", "¼ tsp turmeric", "salt"],
    steps: ["Whisk to a lump-free pourable batter. Rest 5 min.", "Nonstick pan, medium, film of oil. Ladle, spread thin.", "2–3 min a side till spotted brown. Makes 3–4.", "Yogurt, ketchup, or pickle."],
    note: "Grate in whatever vegetable is dying in the fridge — this recipe is the fridge's last exit.",
    leftover: "",
  },
  {
    id: "curd-rice", name: "Curd rice", tier: 0, time: 10, concept: "yogurt", known: false,
    needs: ["rice"], makes: "1 night", shop: [],
    balance: { p: 1, v: 0, c: 2 },
    pairHint: "Roasted peanuts in the tadka + 2 boiled eggs on the side if this is the whole dinner.",
    hook: "Leftover rice + yogurt + a tadka. Ten minutes, weirdly restorative.",
    ingredients: ["leftover rice, warmed", "¾ cup yogurt", "salt", "tadka: 1 tsp mustard seeds, 1 tbsp peanuts, 1 dried chili, curry leaves, 1 tsp grated ginger"],
    steps: ["Mash the warm rice slightly, stir in yogurt and salt. Should be loose.", "Tadka in hot oil: mustard pops, peanuts golden, chili, curry leaves, ginger.", "Pour over, stir. Pickle on the side."],
    note: "Rice warm, yogurt cold-ish — that contrast is the dish.",
    leftover: "Finishes whatever's left of the yogurt pot.",
  },
  {
    id: "lemon-rice", name: "Lemon rice", tier: 0, time: 12, concept: "onepot", known: false,
    needs: ["rice"], makes: "1 night", shop: [],
    balance: { p: 1, v: 0, c: 2 },
    pairHint: "Peanuts help; 2 boiled eggs make it a dinner.",
    hook: "The other leftover-rice transformer. Peanutty, sharp, bright yellow.",
    ingredients: ["leftover rice, warmed", "juice of 1 lemon", "½ tsp turmeric", "tadka: 1 tsp mustard seeds, 2 tbsp peanuts, 1 tsp chana dal, 1 dried chili, curry leaves"],
    steps: ["Tadka in 2 tbsp oil: mustard pops, peanuts and chana dal golden, chili, curry leaves, turmeric.", "Rice in, toss to coat and heat through.", "Off heat: lemon juice, salt. It should bite."],
    note: "Lemon always off heat or it turns bitter.",
    leftover: "",
  },
  {
    id: "fried-rice", name: "Egg fried rice", tier: 0, time: 15, concept: "onepot", known: false,
    needs: ["rice", "eggs"], makes: "1–2 nights", shop: ["spring onions (optional)"],
    balance: { p: 2, v: 1, c: 2 },
    pairHint: "",
    hook: "The leftover-rice transformer that actually hits the protein floor. Same slot as lemon rice, East Asian accent.",
    ingredients: ["leftover rice (cold — essential)", "3 eggs", "big handful frozen peas", "2 garlic cloves", "1½ tbsp soy sauce", "sesame oil or neutral", "spring onion if you have it"],
    steps: [
      "Hot pan, oil: scramble the eggs hard, break into pieces, set aside.",
      "More oil: garlic 20 s, frozen peas 1 min.",
      "Cold rice in, press flat, leave 1 min to crisp, then toss.",
      "Soy in around the edge (it should hiss), eggs back, toss. Spring onion off heat.",
    ],
    note: "Cold day-old rice from the fridge is the whole trick — fresh rice steams into mush.",
    leftover: "",
  },
  {
    id: "bhurji", name: "Egg bhurji", tier: 0, time: 15, concept: "bhurji", known: true,
    needs: ["eggs"], makes: "1 night", shop: ["eggs, if out"],
    balance: { p: 2, v: 1, c: 0 },
    pairHint: "Toast or leftover rice for the carb slot.",
    hook: "You know this one. Listed so the engine can offer it when the fridge is bare.",
    ingredients: ["3–4 eggs", "1 onion", "1 tomato", "chili, turmeric, salt"],
    steps: ["Your usual. Toast alongside."],
    note: "Paneer bhurji and tofu bhurji in this family are the same muscle, new dishes.",
    leftover: "",
  },
  {
    id: "masala-omelette", name: "Masala omelette + toast", tier: 0, time: 10, concept: "bhurji", known: true,
    needs: ["eggs"], makes: "1 night", shop: ["eggs, if out"],
    balance: { p: 2, v: 1, c: 1 },
    pairHint: "",
    hook: "The 10-minute floor. Three eggs, whatever's in, toast alongside — protein sorted with zero thought.",
    ingredients: ["3 eggs", "½ onion, 1 chili, coriander — all optional", "pinch turmeric, salt, pepper", "grated cheese (optional)"],
    steps: ["Beat the eggs with the aromatics and salt.", "Hot buttered pan, pour in, drag the edges as they set.", "Fold once it's just barely set. Toast alongside."],
    note: "Cheese pushes calories up but adds protein on a day the sandwich was light.",
    leftover: "",
  },
  {
    id: "tofu-bhurji", name: "Tofu bhurji", tier: 0, time: 15, concept: "bhurji", known: false,
    needs: [], makes: "1–2 nights", shop: ["1 block firm tofu (280–400 g)"],
    balance: { p: 2, v: 1, c: 0 },
    pairHint: "Toast or leftover rice for the carb slot.",
    hook: "Your egg-bhurji muscle, crumbled firm tofu instead of eggs. Higher protein, and it keeps longer than an open box of eggs.",
    ingredients: ["1 block firm tofu, pressed and crumbled", "1 onion, 1 tomato, chopped", "1 green chili", "½ tsp turmeric, ½ tsp chili powder, ¼ tsp kala namak (optional, egg-y note)", "kasuri methi"],
    steps: ["Crumble the tofu by hand — no need to be neat.", "Bhurji base: onion, chili, tomato down to jammy.", "Tofu in with turmeric + chili powder, 5 min to dry out and take colour.", "Kala namak + kasuri methi off heat."],
    note: "Press the tofu 10 min under something heavy first — wet tofu steams instead of frying.",
    leftover: "",
  },
  {
    id: "chana-chaat", name: "Quick chana chaat", tier: 0, time: 10, concept: "yogurt", known: false,
    needs: [], makes: "1 night", shop: [],
    balance: { p: 2, v: 2, c: 1 },
    pairHint: "A spoon of yogurt and a handful of sev or peanuts if this is the whole meal.",
    hook: "No-cook, pantry-only, and it clears the protein bar cold. The dinner for nights you won't touch the stove.",
    ingredients: ["2 cans chickpeas, drained", "1 onion + 1 tomato, diced small", "green chili, coriander", "juice of 1 lemon", "1 tsp chaat masala, ½ tsp toasted cumin, salt", "yogurt to spoon over (optional)"],
    steps: ["Everything in a bowl.", "Lemon, chaat masala, salt. Toss.", "Rest 5 min so it stops tasting raw. Yogurt on top."],
    note: "Warm the chickpeas 1 min in the microwave first if you want it less salad, more dinner.",
    leftover: "",
  },
  {
    id: "poha", name: "Poha", tier: 0, time: 15, concept: "onepot", known: false,
    needs: [], makes: "1–2 nights", shop: ["1 bag thick poha (flattened rice) — pantry once bought"],
    balance: { p: 1, v: 1, c: 2 },
    pairHint: "Extra peanuts help; 2 boiled eggs or a glass of milk make it a dinner, not a snack.",
    hook: "Maharashtra's breakfast, fine as a light dinner. Soak, tadka, done — no pan to watch.",
    ingredients: ["2 cups thick poha", "1 onion + 1 small potato, small dice", "handful peanuts", "1 tsp mustard seeds, curry leaves, 1 green chili", "½ tsp turmeric, salt, pinch sugar", "lemon"],
    steps: ["Rinse the poha in a sieve till just soft, drain, leave to swell. Don't oversoak.", "Tadka: mustard, peanuts, curry leaves, chili; potato till tender; onion till soft.", "Turmeric, then poha folded through gently to warm.", "Lemon + coriander off heat."],
    note: "Thick poha only — thin poha dissolves to paste. Keep a bag in the pantry as a bread alternative.",
    leftover: "",
  },

  /* ================= TIER 1 — mains + fresh dinners ================= */
  {
    id: "chana-speedrun", name: "Chana masala speedrun", tier: 1, time: 30, concept: "gravy", known: true,
    needs: ["base"], makes: "3 dinners", shop: [],
    balance: { p: 2, v: 1, c: 2 },
    pairHint: "",
    hook: "Your chole minus the soak and the base-building. Canned chickpeas + base from the jar.",
    ingredients: ["base from the jar (~1 portion)", "2 cans chickpeas, drained", "2 tsp chana masala (or 1 tsp amchur + 1 tsp garam masala)", "~400 ml water", "ginger julienne + lemon to finish"],
    steps: [
      "Base into a pan with the water, simmer 3 min.",
      "Chickpeas + spices in. Simmer 15 min, mashing a handful against the pan to thicken.",
      "Ginger julienne, squeeze of lemon.",
      "IP rice in parallel. Total ~30 min.",
    ],
    note: "The recipe that justifies keeping a base jar. Better on day 2.",
    leftover: "",
  },
  {
    id: "rajma-speedrun", name: "Rajma speedrun (canned)", tier: 1, time: 25, concept: "gravy", known: false,
    needs: ["base"], makes: "3 dinners", shop: [],
    balance: { p: 2, v: 1, c: 2 },
    pairHint: "",
    hook: "Rajma without the overnight soak. Canned kidney beans + the base jar = the chana move, different bean.",
    ingredients: ["2 cans kidney beans, drained", "base from the jar (~1 portion)", "~350 ml water", "1½ tsp garam masala, 1 tsp kasuri methi", "ginger julienne to finish"],
    steps: ["Base + water in a pan, simmer 3 min.", "Beans in, simmer 15 min, mashing a handful against the pan to thicken.", "Garam masala, kasuri methi, ginger. Rice in parallel."],
    note: "Canned is the weeknight version; the soaked IP rajma (high flame) is creamier if you've planned ahead.",
    leftover: "",
  },
  {
    id: "matar-paneer", name: "Matar paneer / aloo matar", tier: 1, time: 30, concept: "gravy", known: false,
    needs: ["base", "paneer"], makes: "3 dinners", shop: ["1–2 packs paneer (225 g each)"],
    balance: { p: 2, v: 1, c: 1 },
    pairHint: "Paneer is the calorie-dense protein — on cut weeks use 1 pack and double the peas.",
    hook: "Base jar + frozen peas + paneer. Nothing to chop at all.",
    ingredients: ["base from the jar (~1 portion)", "1–2 packs paneer, cubed", "2 cups frozen peas", "1 tsp garam masala", "2 tsp kasuri methi", "~400 ml water", "splash of cream or yogurt (optional)"],
    steps: ["Base + water, simmer 3 min.", "Peas in, 5 min. Paneer in, 5 min gentle.", "Garam masala, kasuri methi crushed in."],
    note: "No paneer? Three boiled potatoes → aloo matar, pantry only.",
    leftover: "Open pack of paneer keeps ~3 days — route to paneer bhurji.",
  },
  {
    id: "mushroom", name: "Mushroom masala (speedrun)", tier: 1, time: 30, concept: "gravy", known: true,
    needs: ["base", "shopped"], makes: "3 dinners", shop: ["2 × 300 g packs mushrooms (all in)"],
    balance: { p: 1, v: 2, c: 1 },
    pairHint: "Mushrooms aren't protein — serve over dal instead of rice, or add 2 boiled eggs.",
    hook: "Your existing dish from the base jar. 45 min becomes 30, and both packs go in so nothing rots.",
    ingredients: ["base from the jar (~1 portion)", "600 g mushrooms, quartered", "your usual finish"],
    steps: ["Sear the mushrooms hard in batches first — colour on, water off.", "Base + splash of water, simmer 10 min. Finish as usual."],
    note: "The hard sear is the upgrade over stewing them in gravy.",
    leftover: "",
  },
  {
    id: "keema-matar", name: "Keema matar", tier: 1, time: 35, concept: "gravy", known: false,
    needs: ["base"], makes: "3–4 dinners", shop: ["500 g minced lamb, chicken or turkey (whole pack)"],
    balance: { p: 2, v: 1, c: 1 },
    pairHint: "",
    hook: "Highest-protein gravy in the app per minute of effort. Mince browns fast, the base does the rest.",
    ingredients: ["500 g mince", "base from the jar (or fresh)", "2 big handfuls frozen peas", "1½ tsp garam masala, 1 tsp cumin", "~200 ml water"],
    steps: ["Brown the mince hard in a dry-ish pan — colour is flavour. Drain the excess fat.", "Base + cumin in, coat the mince, 3 min.", "Water + peas, simmer 15 min till thick.", "Garam masala at the end. Rice, or wrap in flatbread."],
    note: "Turkey mince is the leanest for a cut week; lamb is the treat. Keeps 3 days, better on day 2.",
    leftover: "",
  },
  {
    id: "butter-chicken", name: "Butter chicken (from base)", tier: 1, time: 35, concept: "gravy", known: false,
    needs: ["base", "shopped"], makes: "3–4 dinners", shop: ["800 g – 1 kg chicken thighs (whole pack)", "small pot double cream"],
    balance: { p: 2, v: 1, c: 1 },
    pairHint: "",
    hook: "The base jar, enriched. Fry the chicken, melt in the base, finish with butter, cream and a hit of kasuri methi.",
    ingredients: ["1 kg chicken thighs, in chunks", "base from the jar (or fresh)", "2 tbsp butter", "100 ml cream", "1 tbsp kasuri methi, 1 tsp garam masala, ½ tsp chili powder", "1 tsp sugar, squeeze of lemon"],
    steps: ["Brown the chicken in butter, remove.", "Base + splash of water in the same pan, simmer 5 min; blend smooth for the classic texture (optional).", "Chicken back, 12–15 min till cooked through.", "Cream, kasuri methi crushed in, sugar, garam masala. Lemon off heat."],
    note: "Restaurant-rich by design — cream and butter carry the calories, so keep the portion honest on a cut week. Better on day 2.",
    leftover: "",
  },
  {
    id: "egg-roast", name: "Kerala egg roast", tier: 1, time: 25, concept: "gravy", known: false,
    needs: ["eggs"], makes: "2 nights (6 eggs)", shop: [],
    balance: { p: 2, v: 1, c: 1 },
    pairHint: "",
    hook: "Boiled eggs in a dark, sweet-sharp onion masala. Egg curry's punchier South Indian cousin — no base jar needed.",
    ingredients: ["6 eggs, boiled", "2 onions, sliced thin", "1 tomato", "1 tbsp ginger-garlic paste", "1 tsp chili powder, ½ tsp turmeric, ½ tsp garam masala, ½ tsp fennel", "curry leaves"],
    steps: ["Eggs in the IP: 1 cup water, HP 5 min, quick release, into cold water.", "Cook the onions slow and deep — 12–15 min till truly brown. This is the dish.", "Ginger-garlic, curry leaves, powders 1 min; tomato till it breaks down.", "Halved eggs in, coat in the thick masala, 3 min."],
    note: "Almost no liquid — this is a dry-ish 'roast', not a curry. Great with rice or flatbread.",
    leftover: "",
  },
  {
    id: "kadhi", name: "Kadhi", tier: 1, time: 35, concept: "yogurt", known: false,
    needs: [], makes: "3 dinners", shop: [],
    balance: { p: 1, v: 0, c: 2 },
    pairHint: "Kadhi night needs a protein sidecar: 2 boiled eggs, or paneer cubes dropped in for the last 5 min.",
    hook: "Tangy yogurt–besan curry, 100% pantry. Your best 'no shopping, still a proper dinner' move.",
    ingredients: ["1½ cups yogurt (sour is better)", "4 tbsp besan", "¾ tsp turmeric", "4 cups water", "tadka: 1½ tsp cumin, ¾ tsp methi seeds, pinch hing, 2 dried chilies, curry leaves"],
    steps: [
      "Whisk yogurt + besan + turmeric + water till completely smooth.",
      "Tadka in a saucepan, pour the mixture in.",
      "Stir continuously until it boils (this stops it splitting), then simmer 20–25 min, occasional stir, to pouring-custard thickness.",
      "Salt at the end. Over rice — IP rice runs in parallel.",
    ],
    note: "Keeps 3 days; reheat gently, don't hard-boil.",
    leftover: "Uses most of a 500 g yogurt pot — remainder → raita or curd rice.",
  },
  {
    id: "tehri", name: "Tehri (IP veg pulao)", tier: 1, time: 35, concept: "onepot", known: false,
    needs: ["shopped"], makes: "3 dinners", shop: ["mixed veg — whatever's in (carrot, beans, potato); frozen peas fine"],
    balance: { p: 1, v: 2, c: 2 },
    pairHint: "Yogurt on the side isn't garnish here — it's the protein. Be generous, or add boiled eggs.",
    hook: "Rice + sabzi collapsed into one pot. A no-chop dish if you lean on the frozen-peas bag and quick-dice one carrot.",
    ingredients: [
      "1½ cups basmati, rinsed till clear", "3 cups mixed veg (fresh dice + frozen peas; potato chunks welcome)",
      "1 large onion, sliced", "1 tbsp ginger-garlic paste", "1 tomato",
      "whole spices: bay, 4 cloves, 4 cardamom, 1½ tsp cumin",
      "¾ tsp turmeric, 1½ tsp chili powder, 1 tbsp coriander powder",
      "2¼ cups water", // src: 1:1.5 rinsed basmati baseline, reduced slightly for veg moisture — indianveggiedelight.com + petitepaprika.com
    ],
    steps: [
      "IP sauté: ghee/oil, whole spices 30 s, onion till golden.",
      "Ginger-garlic, tomato, powders — 3 min.",
      "Veg, rice, water, salt. Scrape the bottom clean (burn-error insurance).",
      "HP 5 min, NR 10 — the natural release is what keeps the grains separate.", // src: pipingpotcurry.com (4–5 min HP + 10 NR)
    ],
    note: "Reheats well with a splash of water. The closest one-pot approximation of the full thali.",
    leftover: "",
  },
  {
    id: "paneer-bhurji", name: "Paneer bhurji", tier: 1, time: 15, concept: "bhurji", known: false,
    needs: ["paneer"], makes: "1–2 nights", shop: ["1 pack paneer (225 g)"],
    balance: { p: 2, v: 1, c: 0 },
    pairHint: "Toast, pav or leftover rice for the carb slot.",
    hook: "Your egg bhurji technique, crumbled paneer instead of eggs. Instant arsenal expansion.",
    ingredients: ["1 pack paneer, crumbled", "your bhurji base (onion, tomato, chili, turmeric)", "kasuri methi"],
    steps: ["Exactly your bhurji: onions, chili, tomato down to jammy.", "Crumbled paneer, 3–4 min. Kasuri methi at the end."],
    note: "Unopened paneer keeps ~2 weeks in the fridge — good insurance for a no-shop night.",
    leftover: "",
  },
  {
    id: "paneer-tikka-pan", name: "Pan paneer tikka", tier: 1, time: 20, concept: "dry", known: false,
    needs: ["paneer"], makes: "1–2 nights", shop: ["1 pack paneer (225 g)", "1 pepper + ½ onion in chunks (optional)"],
    balance: { p: 2, v: 1, c: 0 },
    pairHint: "Paneer is calorie-dense protein — pair with a big salad or dal rather than rice on a cut week.",
    hook: "Tandoori flavour without the tandoor: yogurt-marinated paneer charred hard in a hot pan. The dry-lane protein.",
    ingredients: ["1 pack paneer, cubed", "marinade: 3 tbsp thick yogurt, 1 tsp each chili/cumin/coriander pwd, ½ tsp turmeric, 1 tbsp ginger-garlic, 1 tsp kasuri methi, salt", "peppers + onion", "chaat masala + lemon to finish"],
    steps: ["Coat the paneer (and veg) in the marinade — 15 min if you have it.", "Screaming-hot pan, little oil: paneer in one layer, char each side, don't fiddle.", "Veg alongside till blistered.", "Chaat masala + lemon off heat."],
    note: "Same marinade works on an oven tray at 220 °C if you'd rather not stand over the pan. Uses most of a yogurt pot.",
    leftover: "Rest of the yogurt → raita on the side.",
  },
  {
    id: "dal-palak", name: "Dal palak", tier: 1, time: 20, concept: "dal", known: false,
    needs: ["dal"], makes: "1–2 nights", shop: ["1 bag fresh spinach (~200 g, used whole)"],
    balance: { p: 1, v: 2, c: 2 },
    pairHint: "Better balanced than plain dal, still short of the floor — eggs or raita close it.",
    hook: "A dal portion from the fridge + a whole bag of fresh spinach wilted in + a fresh tadka. Greener dal, no waste.",
    ingredients: ["1 dal portion from the fridge", "1 bag spinach (~200 g), roughly chopped", "garlicky tadka: ghee, cumin, 3 garlic cloves, chili powder"],
    steps: ["Reheat the dal with a splash of water; pile the spinach in to wilt, 5 min.", "Simmer 3 min so it melts into the dal.", "Heavy-garlic tadka over. Rice in the IP in parallel."],
    note: "Uses the whole bag of spinach in one cook — the fragile-veg rule in action.",
    leftover: "",
  },
  {
    id: "sambar", name: "Sambar", tier: 1, time: 35, concept: "dal", known: false,
    needs: ["shopped"], makes: "3–4 dinners", shop: ["mixed veg (carrot, pumpkin, aubergine, drumstick — any 3)", "tamarind (paste or block; pantry once bought)"],
    balance: { p: 1, v: 2, c: 2 },
    pairHint: "Yogurt or 2 boiled eggs alongside — sambar + rice is short of the floor on its own.",
    hook: "South India's dal-plus-veg-plus-tamarind. One pot, hits three plate slots, tastes better every reheat.",
    ingredients: [
      "1 cup toor dal", "3 cups mixed veg in chunks", "lime-sized ball tamarind (or 2 tbsp paste)",
      "2 tbsp sambar powder", "½ tsp turmeric, salt",
      "tadka: mustard seeds, 2 dried chili, curry leaves, pinch hing",
      "4 cups water", // src: toor dal HP 10 + NR — verified constants table
    ],
    steps: [
      "Dal + turmeric + water in the IP with the harder veg. HP 10 min, NR.", // src: toor/moong HP 10 + NR, standard
      "Whisk the dal a little. Softer veg + tamarind + sambar powder in; simmer 10 min on sauté.",
      "Tadka in hot oil, pour over. Salt.",
    ],
    note: "Keeps 3–4 days and deepens. Sambar powder + tamarind live in the pantry after the first buy.",
    leftover: "Tamarind and sambar powder = the next three sambars from the pantry.",
  },
  {
    id: "jeera-aloo", name: "Jeera aloo", tier: 1, time: 20, concept: "dry", known: false,
    needs: [], makes: "side for 2–3 nights", shop: [],
    balance: { p: 0, v: 1, c: 2 },
    pairHint: "This is the sabzi lane, not the protein — it runs next to dal, not instead of it.",
    hook: "The dry-sabzi concept, minimum viable version. Boiled potatoes in a cumin-heavy tadka.",
    ingredients: ["5 potatoes, boiled and cubed (IP 6 min HP, or microwave)", "1 tbsp cumin seeds", "¾ tsp turmeric, 1½ tsp chili powder, 1 tbsp coriander powder, ¾ tsp amchur"],
    steps: ["Generous oil, cumin till fragrant.", "Powders 10 seconds, then potatoes before anything burns.", "Toss, then leave alone on medium so the edges crisp. Salt, amchur off heat."],
    note: "Re-crisps in a hot pan. The 10-minute lane that completes the thali next to dal + rice.",
    leftover: "",
  },
  {
    id: "aloo-gobi", name: "Aloo gobi (tray version)", tier: 1, time: 35, concept: "dry", known: false,
    needs: ["shopped"], makes: "side for 3 nights", shop: ["1 whole cauliflower (all of it)"],
    balance: { p: 0, v: 2, c: 1 },
    pairHint: "Side, not centre — pair with dal or the shawarma bake's leftover chicken.",
    hook: "Same dry-tadka concept; the oven-tray version is the lazy one worth learning.",
    ingredients: ["1 cauliflower in florets + 3 potatoes in wedges", "3 tbsp oil, 1½ tsp cumin", "¾ tsp turmeric, 1½ tsp chili powder, 1 tbsp coriander powder, salt", "amchur/lemon to finish"],
    steps: ["Toss everything in oil + spices on a tray.", "220 °C for 25–30 min, turning once.", "Amchur or lemon off the tray."],
    note: "Nearly hands-off — runs while dal reheats and the IP does rice. Pan version: cumin tadka, lid on low 15, lid off to crisp.",
    leftover: "",
  },
  {
    id: "shakshuka", name: "Shakshuka", tier: 1, time: 25, concept: "bhurji", known: false,
    needs: ["eggs"], makes: "sauce for 2 nights, eggs fresh each night", shop: ["1 pepper (optional)", "crusty bread"],
    balance: { p: 2, v: 2, c: 1 },
    pairHint: "",
    hook: "Your egg-curry cousin from the Middle East lane: tomato-pepper sauce, eggs poached straight in.",
    ingredients: ["1 onion, sliced", "1 pepper, sliced (or skip)", "3 garlic cloves", "1 tsp paprika + 1 tsp cumin + chili to taste", "1 can tomatoes", "3 eggs per night", "feta or yogurt to finish (optional)"],
    steps: [
      "Soften onion + pepper in olive oil, 6–8 min. Garlic + spices 1 min.",
      "Can of tomatoes, crush, simmer 10 min till thick and jammy.",
      "Wells in the sauce, crack the eggs in, lid on, 5–6 min till whites set, yolks soft.",
      "Bread, toasted, for mopping.",
    ],
    note: "Make double sauce; keep half in the fridge. Crack fresh eggs into reheated sauce tomorrow — never reheat a poached egg.",
    leftover: "Sauce keeps 3 days and doubles as pasta sauce or egg-curry base.",
  },

  /* ================= GLOBAL — non-Indian one-pans ================= */
  {
    id: "thai-curry", name: "Thai curry (jar-paste)", tier: 1, time: 30, concept: "global", known: false,
    needs: ["shopped"], makes: "3 dinners", shop: ["1 jar Thai red or green paste (fridge, keeps months)", "1 × 400 ml tin coconut milk (whole tin — nothing stranded)", "500 g chicken thighs (or tofu)", "green beans or a pepper"],
    balance: { p: 2, v: 2, c: 1 },
    pairHint: "Light coconut milk on cut weeks; rice slot: real / cauli / half-half.",
    hook: "The jar of paste is store-bought bhuna masala — fry it, add coconut, done. Same shortcut logic as a jar of base.",
    ingredients: ["3–4 tbsp Thai curry paste (jars vary — start at 3, taste)", "1 × 400 ml tin coconut milk", "500 g chicken thighs, in strips", "2 big handfuls green beans / pepper / frozen veg", "1 tsp fish sauce or salt", "lime"],
    steps: [
      "Fry the paste in the thick cream from the top of the tin, 2 min, till it smells serious.",
      "Chicken in, coat, 3 min.",
      "Rest of the tin + a splash of water. Simmer 12–15 min.",
      "Veg in for the last 5. Fish sauce, big squeeze of lime off heat.",
    ],
    note: "Whole tin used by design. IP rice in parallel; jasmine if you're feeling proper (same 1:1¼, HP 4, NR 10).",
    leftover: "The paste jar = 3 future curries from the fridge door.",
  },
  {
    id: "fish-curry", name: "Coconut fish curry", tier: 1, time: 25, concept: "global", known: false,
    needs: ["shopped"], makes: "2–3 dinners", shop: ["500 g firm white fish (whole pack — cook it all)", "1 × 400 ml tin coconut milk"],
    balance: { p: 2, v: 1, c: 1 },
    pairHint: "",
    hook: "Fish is the fastest-cooking protein you own — 6 minutes in coconut. A whole pack becomes 2–3 dinners.",
    ingredients: ["500 g firm white fish, in big chunks", "1 tin coconut milk", "1 onion, 1 tbsp ginger-garlic", "1 tomato", "1 tsp turmeric, 1 tsp chili powder, ½ tsp mustard seeds, curry leaves", "tamarind or lime"],
    steps: ["Tadka: mustard, curry leaves; onion soft; ginger-garlic; powders; tomato to break down.", "Coconut milk + a splash of water, simmer 5 min.", "Fish in gently, 6–8 min till just flaking — don't stir hard.", "Tamarind or lime off heat."],
    note: "Fish reheats poorly past day 2 — this is the shorter-shelf-life main; eat it first in the week.",
    leftover: "Whole tin of coconut used; the pack cooked in one go.",
  },
  {
    id: "oyakodon", name: "Oyakodon (chicken & egg bowl)", tier: 0, time: 20, concept: "global", known: false,
    needs: ["rice", "eggs"], makes: "1–2 nights", shop: ["chicken thigh (300 g)"],
    balance: { p: 2, v: 1, c: 2 },
    pairHint: "",
    hook: "Japan's leftover-rice rescue: chicken simmered in sweet-soy, barely-set egg poured over, all onto warm rice. Double protein.",
    ingredients: ["300 g chicken thigh, bite-size", "1 onion, sliced", "3 eggs, loosely beaten", "sauce: 4 tbsp soy, 2 tbsp mirin (or 1 tbsp sugar), 4 tbsp water", "leftover rice, warmed", "spring onion"],
    steps: ["Simmer the onion in the sauce 3 min in a small pan.", "Chicken in, 6–7 min till cooked through.", "Pour the beaten egg over in a spiral; lid on 1–2 min till just set — leave it soft.", "Slide over warm rice, spring onion."],
    note: "The egg should be barely set, almost saucy — that's the dish, not underdone.",
    leftover: "",
  },
  {
    id: "mapo-tofu", name: "Mapo tofu", tier: 1, time: 25, concept: "global", known: false,
    needs: [], makes: "2 nights", shop: ["1 block soft/silken tofu (300–400 g)", "1 jar doubanjiang (chili bean paste; fridge, keeps months)", "150 g pork or turkey mince (optional)"],
    balance: { p: 2, v: 0, c: 1 },
    pairHint: "The tofu + mince clears the floor; serve over rice, don't add more protein.",
    hook: "Sichuan's answer to bhurji — silken tofu in a numbing chili-bean sauce. The jar of doubanjiang is the shortcut base.",
    ingredients: ["1 block soft tofu, cubed", "150 g mince (or skip for veg)", "1½ tbsp doubanjiang", "3 garlic cloves + 1 tbsp ginger, minced", "1 tsp soy + 1 tsp cornflour in ½ cup water", "spring onion; Sichuan pepper if you have it"],
    steps: ["Brown the mince in oil.", "Push aside; fry the doubanjiang + garlic + ginger 1 min till the oil goes red.", "Splash of water, slide the tofu in, simmer 4 min — nudge, don't stir.", "Cornflour slurry to thicken, soy, spring onion."],
    note: "Silken tofu is fragile by design — shake the pan instead of stirring. Doubanjiang is salty; go easy on extra soy.",
    leftover: "The jar = many future 20-minute dinners.",
  },
  {
    id: "chicken-stir-fry", name: "Garlic-soy chicken stir-fry", tier: 1, time: 20, concept: "global", known: false,
    needs: ["shopped"], makes: "2 nights", shop: ["400 g chicken thigh or breast", "any crunchy veg (broccoli, pepper, green beans, cabbage)"],
    balance: { p: 2, v: 2, c: 1 },
    pairHint: "",
    hook: "The universal weeknight: protein + veg + a soy-garlic sauce, hot and fast. Whatever veg is dying goes in.",
    ingredients: ["400 g chicken, thin strips", "4 cups mixed crunchy veg", "sauce: 3 tbsp soy, 1 tbsp vinegar or lime, 1 tsp sugar, 2 garlic cloves, 1 tbsp ginger, 1 tsp cornflour", "neutral oil, sesame oil to finish"],
    steps: ["Very hot pan, oil: chicken in one layer, sear hard, remove.", "Veg in, toss 3–4 min — keep it crunchy.", "Chicken back, sauce in, toss 1 min till glossy.", "Sesame oil off heat. Rice alongside."],
    note: "High heat and not crowding the pan are the whole technique — cook in two batches if the pan's small.",
    leftover: "",
  },
  {
    id: "med-chicken-bake", name: "Lemon-oregano chicken tray bake", tier: 1, time: 45, concept: "dry", known: false,
    needs: ["shopped"], makes: "3–4 dinners", shop: ["1 kg chicken thighs (whole pack)", "2 peppers + 1 courgette, or a tin of chickpeas"],
    balance: { p: 2, v: 2, c: 1 },
    pairHint: "",
    hook: "The shawarma bake's Mediterranean cousin. Same 10-minutes-then-oven logic, brighter flavour, no marinade to overthink.",
    ingredients: ["1 kg chicken thighs", "marinade: 4 tbsp olive oil, juice of 1 lemon, 1 tbsp dried oregano, 4 garlic cloves, 1 tsp paprika, salt", "2 peppers + 1 courgette (or drained chickpeas for more protein)", "feta to crumble over (optional)"],
    steps: ["Toss the chicken + veg in the marinade on a tray.", "220 °C, 30–35 min till the chicken is charred at the edges.", "Feta + a final squeeze of lemon off the tray."],
    note: "Chickpeas instead of courgette push the protein up and add the carb slot. Reheats well 3 days.",
    leftover: "",
  },
  {
    id: "shawarma-bake", name: "Chicken shawarma tray bake", tier: 1, time: 45, concept: "dry", known: false,
    needs: ["shopped"], makes: "3–4 dinners", shop: ["1 kg chicken thighs (whole pack)", "2 peppers + 2 red onions"],
    balance: { p: 2, v: 2, c: 0 },
    pairHint: "Highest protein-per-effort in the app. Wrap in flatbread, or over rice + yogurt.",
    hook: "Yogurt-marinade tray bake — tandoori logic via the Middle East. 10 minutes of your attention, the oven does the rest.",
    ingredients: [
      "1 kg chicken thighs", "marinade: 4 tbsp yogurt, 2 tsp cumin, 2 tsp paprika, 1 tsp coriander pwd, ½ tsp turmeric, ½ tsp cinnamon, 3 garlic cloves, juice of ½ lemon, salt",
      "2 peppers + 2 red onions, in chunks", "garlic-yogurt sauce: rest of the yogurt + garlic + lemon + salt",
    ],
    steps: [
      "Massage the marinade into the thighs (10 min counts; overnight is better).",
      "Tray: veg underneath, chicken on top. 220 °C, 30–35 min till charred at the edges.",
      "Rest 5 min, slice.",
      "Garlic-yogurt sauce from the remaining pot.",
    ],
    note: "Reheats well 3 days; also the best sandwich-lunch leftover in the app.",
    leftover: "Yogurt pot fully routed: marinade + sauce.",
  },

  /* ================= TIER 2 — bigger weekend cooks ================= */
  {
    id: "rajma", name: "Rajma (IP, soaked)", tier: 2, time: 60, concept: "gravy", known: false,
    needs: [], makes: "4 dinners", shop: [],
    balance: { p: 2, v: 1, c: 2 },
    pairHint: "",
    hook: "Exactly your chole move with a different bean. Zero new technique, one new dish — and it's the chili gateway.",
    ingredients: [
      "1½ cups rajma, soaked overnight (or 1 hr in just-boiled water)",
      "your onion–tomato base (fresh, or from the jar)",
      "3 cups water", // src: 1.5–3 cups per cup of soaked beans across pipingpotcurry / indianveggiedelight / masalachilli
      "1½ tsp garam masala, 1 tsp kasuri methi",
    ],
    steps: [
      "Build the base in the IP on sauté (or melt in a jar portion).",
      "Drained rajma + water. HP 30 min, NR.", // src: consensus for soaked beans — pipingpotcurry.com, indianveggiedelight.com, masalachilli.com
      "Mash a ladleful against the wall to thicken. Garam masala, kasuri methi.",
    ],
    note: "Keeps 3–4 days in the fridge and is better on day 2. Overnight soak also makes it digestible; don't skip.",
    leftover: "",
  },
  {
    id: "chicken-batch", name: "Chicken curry (big cook)", tier: 2, time: 60, concept: "gravy", known: true,
    needs: ["shopped"], makes: "4 dinners", shop: ["1 kg chicken thighs (whole pack)"],
    balance: { p: 2, v: 1, c: 1 },
    pairHint: "",
    hook: "Your dish, cooked to the whole 1 kg pack — one afternoon covers four dinners across the week.",
    ingredients: ["1 kg chicken thighs", "your base (or a jar portion + fresh finish)", "your usual spicing"],
    steps: ["Your usual method — from a base-jar portion it's ~30 min instead of an hour.", "Cool and portion to the fridge; eat within 3–4 days."],
    note: "Thighs survive reheating far better than breast.",
    leftover: "",
  },
  {
    id: "dal-makhani", name: "Dal makhani (IP, soaked)", tier: 2, time: 60, concept: "dal", known: false,
    needs: [], makes: "4 dinners", shop: [],
    balance: { p: 2, v: 0, c: 1 },
    pairHint: "Rich by design — this is the rare-occasion slot, not the default.",
    hook: "The weekend-luxury dal. 10 minutes of effort, the IP does the rest, and it's better every day it sits.",
    ingredients: [
      "1 cup whole urad + ⅓ cup rajma, soaked overnight",
      "1 onion + 1 tbsp ginger-garlic + 1 can tomatoes (or a jar base portion)",
      "1½ tsp chili powder, ¾ tsp garam masala",
      "4 cups water", // src: ~3–4 cups per 1¼ cups soaked legumes — ministryofcurry.com, pipingpotcurry.com
      "2 tbsp butter + splash of cream",
    ],
    steps: [
      "Sauté the base in the IP (or melt in a jar portion).",
      "Soaked dals + water. HP 30 min, NR.", // src: soaked consensus 30 min — ministryofcurry.com, pipingpotcurry.com, culinaryshades.com (45+ only for unsoaked)
      "Mash partially, then sauté-simmer 10 min with the butter — the longer it burbles, the better.",
      "Cream off heat.",
    ],
    note: "Tastes better on day 2 anyway; keeps 3–4 days. Soak matters: unsoaked needs 45+ min and comes out less creamy.",
    leftover: "",
  },
  {
    id: "palak-paneer", name: "Palak paneer", tier: 2, time: 40, concept: "gravy", known: false,
    needs: ["paneer"], makes: "3 dinners", shop: ["1 pack paneer (225 g)", "spinach — 2 fresh bags (~400–500 g), used whole"],
    balance: { p: 2, v: 2, c: 0 },
    pairHint: "",
    hook: "Fresh spinach, blanched fast and blended smooth. With a base-jar portion it drops to ~25 min.",
    ingredients: ["400–500 g fresh spinach, blanched 2 min then squeezed", "base from the jar (or fresh: onion, garlic, tomato)", "1 pack paneer", "½ tsp garam masala, splash of cream, squeeze of lemon"],
    steps: [
      "Blanch the spinach 2 min in boiling water, drop into cold water, squeeze dry, blend.",
      "Base into the pan, loosen with water; spinach purée in, simmer 5 min.",
      "Paneer, garam masala, cream. Lemon off heat.",
    ],
    note: "Blanch-and-shock keeps it bright green. Uses both bags of spinach in one go — no wilted remainder.",
    leftover: "",
  },

  /* ================= BATCH ENABLERS (never shown in Tonight) ================= */
  {
    id: "base-batch", name: "Small bhuna masala base", tier: 1, time: 30, concept: "batch", known: true,
    needs: [], makes: "2–3 gravy dinners' worth · keeps 2–3 days in the fridge", shop: [],
    balance: { p: 0, v: 1, c: 0 },
    pairHint: "",
    hook: "Your onion–tomato base, batched small and kept in a fridge jar — enough to make the week's gravy dishes fast, not enough to fill the fridge.",
    ingredients: ["3 onions, chopped", "1½ tbsp ginger-garlic paste", "3 tomatoes or 1 can", "1½ tsp turmeric, 1 tsp chili powder, 1 tbsp coriander powder", "3 tbsp oil, salt"],
    steps: [
      "Brown the onions properly — 12–15 min, deep golden. This is where all the flavour lives; don't rush it.",
      "Ginger-garlic 2 min, powders 30 s.",
      "Tomatoes in; cook till the oil separates and it's a thick paste — 10–12 min.",
      "Cool. Into a jar, film of oil on top, into the fridge.",
    ],
    note: "Runs on the stove while the IP does dal or rice. A small base keeps the gravy family fast without gambling on day-4 leftovers.",
    leftover: "",
  },
  {
    id: "dal-batch", name: "Dal, batched for the week", tier: 1, time: 30, concept: "batch", known: true,
    needs: [], makes: "5–6 servings · eat over 2–3 nights", shop: [],
    balance: { p: 1, v: 0, c: 1 },
    pairHint: "",
    hook: "Your dal, doubled and deliberately under-finished. The tadka happens fresh on each reheat night — that's the whole trick.",
    ingredients: ["2 cups toor or moong dal, rinsed", "¾ tsp turmeric, salt", "1 tomato (optional)", "7 cups water"],
    steps: [
      "Everything in the IP. HP 10 min, NR.", // toor/moong 8–12 min HP is the standard band
      "Whisk smooth-ish. NO tadka yet.",
      "Cool; keep plain in the fridge. Tonight's share gets a fresh tadka.",
    ],
    note: "Plain dal + fresh tadka on night 2–3 is indistinguishable from same-day. Pre-tadka'd dal goes flat.",
    leftover: "",
  },
];

const COMBOS = [
  {
    id: "combo-thali", name: "The 25-minute thali", tier: 0, time: 25,
    parts: ["tadka-dal", "jeera-aloo"], needs: ["dal"], shop: [],
    makes: "thali tonight · aloo covers 2 more nights",
    balance: { p: 1, v: 1, c: 2 },
    pairHint: "Boil 2 eggs in the IP alongside the rice — same cycle, protein floor met.",
    hook: "Dal from the fridge + fresh tadka, jeera aloo on the stove, rice in the IP — all in parallel. The full rice–dal–sabzi paradigm, one person, 25 minutes.",
  },
  {
    id: "combo-kadhi", name: "Kadhi–chawal + crisp aloo", tier: 1, time: 40,
    parts: ["kadhi", "jeera-aloo"], needs: [], shop: [],
    makes: "3 nights of kadhi + sabzi",
    balance: { p: 1, v: 1, c: 2 },
    pairHint: "Drop paneer cubes into the kadhi's last 5 minutes on at least one of the nights.",
    hook: "Entirely from the pantry. Kadhi simmers unattended while the potatoes crisp and the IP does rice.",
  },
];

/* ============================================================
   Persistence — localStorage, schema-versioned
   ============================================================ */
const KEY = "lazy-cooking";
const SCHEMA_VERSION = 4;

const defaultState = () => ({
  schemaVersion: SCHEMA_VERSION,
  fridge: { base: false, dal: false, rice: false, eggs: true, paneer: false, shopped: false },
  customRecipes: [],
  overrides: {},
  flags: {},
  weekPlan: [],
});

/* Historical need keys → current (schema v4 dropped the freezer). */
const NEED_REMAP = { frozenBase: "base", frozenDal: "dal", frozenRice: "rice" };
const remapNeeds = (arr) => (Array.isArray(arr) ? arr.map((n) => NEED_REMAP[n] || n) : arr);

function migrate(raw) {
  const d = defaultState();
  if (!raw || typeof raw !== "object") return d;
  // v1–v3 (freezer era) had freezer counts + a fridge with eggs/paneer/shopped/rice.
  // v4 removes the freezer: any freezer portion that existed folds into "in the fridge".
  // Migrations never drop user data — custom recipes and field notes are the crown jewels.
  const oldFreezer = raw.freezer && typeof raw.freezer === "object" ? raw.freezer : {};
  const oldFridge = raw.fridge && typeof raw.fridge === "object" ? raw.fridge : {};
  const fridge = {
    base: !!oldFridge.base || (oldFreezer.base || 0) > 0,
    dal: !!oldFridge.dal || (oldFreezer.dal || 0) > 0,
    rice: !!oldFridge.rice || (oldFreezer.rice || 0) > 0,
    eggs: typeof oldFridge.eggs === "boolean" ? oldFridge.eggs : d.fridge.eggs,
    paneer: !!oldFridge.paneer,
    shopped: !!oldFridge.shopped,
  };
  const customRecipes = Array.isArray(raw.customRecipes)
    ? raw.customRecipes.map((r) => ({ ...r, needs: remapNeeds(r.needs) }))
    : [];
  const overrides = raw.overrides && typeof raw.overrides === "object"
    ? Object.fromEntries(Object.entries(raw.overrides).map(([k, v]) =>
        [k, v && typeof v === "object" && v.needs ? { ...v, needs: remapNeeds(v.needs) } : v]))
    : {};
  return {
    schemaVersion: SCHEMA_VERSION,
    fridge,
    customRecipes,
    overrides,
    flags: raw.flags && typeof raw.flags === "object" ? raw.flags : {},
    weekPlan: Array.isArray(raw.weekPlan) ? raw.weekPlan : [],
  };
}

function loadState() {
  try {
    if (typeof localStorage === "undefined") return defaultState();
    const raw = localStorage.getItem(KEY);
    return migrate(raw ? JSON.parse(raw) : null);
  } catch {
    return defaultState();
  }
}

function saveState(s) {
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(KEY, JSON.stringify(s));
  } catch (e) {
    console.error("save failed", e);
  }
}

/* ============================================================
   Engine
   ============================================================ */
function mergedRecipes(state) {
  const builtins = BUILTINS.map((r) => (state.overrides[r.id] ? { ...r, ...state.overrides[r.id], id: r.id, modified: true } : r));
  const customs = state.customRecipes.map((r) => ({ known: true, balance: { p: 0, v: 0, c: 0 }, ...r, custom: true }));
  return [...builtins, ...customs];
}

function availability(state) {
  const f = state.fridge;
  return { base: f.base, dal: f.dal, rice: f.rice, eggs: f.eggs, paneer: f.paneer, shopped: f.shopped };
}

function score(r, flame, flags) {
  let s = 0;
  if (r.tier === flame) s += 3;
  const needs = r.needs || [];
  if (needs.includes("base") || needs.includes("dal")) s += 3; // leans on a staple you already batched
  if (r.parts) s += 2;
  const tried = flags[r.id]?.tried;
  if (flame === 0 && tried) s += 2; // exhausted nights get known-good, not experiments
  if (flame >= 1 && !r.known && !r.parts && !tried) s += 1; // otherwise nudge the untested
  if (flame === 0) s += Math.max(0, 20 - r.time) / 10;
  return s;
}

function buildGroups(flame, state) {
  const avail = availability(state);
  const pool = [...COMBOS, ...mergedRecipes(state).filter((r) => r.concept !== "batch")].filter((r) => r.tier <= flame);
  const ready = [], planIt = [];
  for (const r of pool) {
    const missing = (r.needs || []).filter((n) => !avail[n] && NEED_INFO[n]);
    (missing.length === 0 ? ready : planIt).push({ r, missing });
  }
  const bySc = (a, b) => score(b.r, flame, state.flags) - score(a.r, flame, state.flags);
  ready.sort(bySc);
  planIt.sort(bySc);
  return { ready: ready.slice(0, 8), planIt: planIt.slice(0, 8) };
}

function whyLine(r, state) {
  const bits = [];
  const needs = r.needs || [];
  if (needs.includes("dal")) bits.push("uses the dal already in the fridge");
  if (needs.includes("base")) bits.push("pulls from the base jar");
  if (needs.includes("rice") && !needs.includes("dal") && !needs.includes("base")) bits.push("turns leftover rice into dinner");
  if (needs.length === 0) bits.push("pantry only — no shopping needed");
  if (state.flags[r.id]?.tried) bits.push("tried & true");
  else if (!r.known && !r.parts) bits.push("new dish, familiar technique");
  if (r.parts) bits.push("full rice–dal–sabzi, run in parallel");
  return bits.join(" · ") || "quick and already in your wheelhouse";
}

/* ============================================================
   UI atoms
   ============================================================ */
const Mono = ({ children, color, size }) => (
  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: size || "0.78rem", color: color || C.muted }}>{children}</span>
);

const TierDot = ({ tier }) => {
  const t = TIERS[tier];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "0.72rem", fontWeight: 600, padding: "2px 9px", borderRadius: 99, background: t.dim, color: t.color }}>
      <span style={{ width: 7, height: 7, borderRadius: 99, background: t.color }} />
      {t.name}
    </span>
  );
};

const BalanceDots = ({ b }) => {
  if (!b) return null;
  const rows = [["P", b.p, C.chili], ["V", b.v, C.green], ["C", b.c, C.turmeric]];
  return (
    <span style={{ display: "inline-flex", gap: 10 }} title="Protein / Veg / Carb, 0–2">
      {rows.map(([label, v, col]) => (
        <span key={label} style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
          <Mono color={C.faint} size="0.68rem">{label}</Mono>
          {[0, 1].map((i) => (
            <span key={i} style={{ width: 6, height: 6, borderRadius: 99, background: i < v ? col : "transparent", border: `1px solid ${i < v ? col : C.border}` }} />
          ))}
        </span>
      ))}
    </span>
  );
};

const Flame = ({ level, active, color }) => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M12 22c4.4 0 7-2.9 7-6.6 0-2.8-1.6-4.9-3-6.7-1.2-1.6-2.4-3.1-2.4-5.7 0 0-6 2.6-6 8.4 0-1-1.2-2.4-1.2-2.4C5.5 10.5 5 12.6 5 15.4 5 19.1 7.6 22 12 22z"
      fill={active ? color : "none"} stroke={active ? color : C.faint} strokeWidth="1.6" strokeLinejoin="round" />
    {level >= 1 && active && (
      <path d="M12 21c2.2 0 3.5-1.5 3.5-3.3 0-1.9-1.4-3-2.3-4.4-.5.9-2.1 1.6-2.1 3.4-.4-.4-.8-1.1-.8-1.1-.6.9-1.8 1.7-1.8 3.1C8.5 19.5 9.8 21 12 21z" fill={C.bg} opacity="0.55" />
    )}
  </svg>
);

const Badge = ({ color, bg, children }) => (
  <span style={{ fontSize: "0.6rem", textTransform: "uppercase", letterSpacing: "0.06em", padding: "2px 6px", borderRadius: 5, background: bg, color, fontWeight: 600 }}>{children}</span>
);

const btn = (variant) => ({
  padding: "8px 14px", borderRadius: 10, fontSize: "0.82rem", fontWeight: 600, cursor: "pointer",
  fontFamily: "inherit",
  background: variant === "primary" ? C.turmericDim : variant === "danger" ? C.chiliDim : C.surface,
  color: variant === "primary" ? C.turmeric : variant === "danger" ? C.chili : C.muted,
  border: `1px solid ${variant === "primary" ? C.turmeric + "77" : variant === "danger" ? C.chili + "77" : C.border}`,
});

/* ============================================================
   Recipe form (add + edit)
   ============================================================ */
const MAKES_OPTIONS = ["1 night", "1–2 nights", "2 nights", "3 dinners", "3–4 dinners", "4 dinners", "side for 2–3 nights"];

function RecipeForm({ initial, isBuiltin, onSave, onCancel }) {
  const [f, setF] = useState(() => ({
    name: initial?.name || "",
    time: initial?.time || 30,
    tier: initial?.tier ?? 1,
    makes: initial?.makes || "3–4 dinners",
    concept: initial?.concept || "mine",
    needs: NEED_KEYS.reduce((acc, k) => ({ ...acc, [k]: (initial?.needs || []).includes(k) }), {}),
    shop: (initial?.shop || []).join("\n"),
    ingredients: (initial?.ingredients || []).join("\n"),
    steps: (initial?.steps || []).join("\n"),
    note: initial?.note || "",
    pairHint: initial?.pairHint || "",
    balance: initial?.balance ? { ...initial.balance } : { p: 0, v: 0, c: 0 },
  }));
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const valid = f.name.trim().length > 0 && Number(f.time) > 0;

  const lines = (s) => s.split("\n").map((x) => x.trim()).filter(Boolean);
  const save = () => onSave({
    name: f.name.trim(), time: Number(f.time), tier: f.tier, makes: f.makes, concept: f.concept,
    needs: NEED_KEYS.filter((k) => f.needs[k]),
    shop: lines(f.shop), ingredients: lines(f.ingredients), steps: lines(f.steps),
    note: f.note.trim(), pairHint: f.pairHint.trim(), balance: f.balance,
  });

  const label = { fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.08em", color: C.faint, display: "block", margin: "14px 0 5px" };
  const input = { width: "100%", boxSizing: "border-box", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, padding: "9px 11px", fontSize: "0.9rem", fontFamily: "inherit" };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(15,12,8,0.78)", display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={onCancel}>
      <div style={{ width: "100%", maxWidth: 480, maxHeight: "92vh", overflowY: "auto", background: C.surfaceHi, border: `1px solid ${C.border}`, borderRadius: "18px 18px 0 0", padding: 20 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ fontFamily: "'Young Serif', serif", fontSize: "1.2rem", color: C.text, margin: 0 }}>
            {initial ? `Edit: ${initial.name}` : "Add a recipe"}
          </h2>
          <button onClick={onCancel} aria-label="Close" style={{ ...btn(), borderRadius: 99, width: 34, height: 34, padding: 0 }}>✕</button>
        </div>
        {isBuiltin && <p style={{ color: C.faint, fontSize: "0.76rem", marginTop: 6 }}>Edits to a built-in are stored as your override — reset any time.</p>}

        <label style={label}>Name *</label>
        <input style={input} value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Mum's chicken curry" />

        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1 }}>
            <label style={label}>Minutes *</label>
            <input style={input} type="number" min="1" value={f.time} onChange={(e) => set("time", e.target.value)} />
          </div>
          <div style={{ flex: 2 }}>
            <label style={label}>Makes</label>
            <select style={input} value={f.makes} onChange={(e) => set("makes", e.target.value)}>
              {MAKES_OPTIONS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>

        <label style={label}>Flame tier</label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          {TIERS.map((t) => (
            <button key={t.id} onClick={() => set("tier", t.id)} style={{
              padding: "9px 4px", borderRadius: 10, fontSize: "0.76rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
              background: f.tier === t.id ? t.dim : C.surface, color: f.tier === t.id ? t.color : C.faint,
              border: `1.5px solid ${f.tier === t.id ? t.color : C.border}`,
            }}>{t.name}</button>
          ))}
        </div>

        <label style={label}>Depends on (unchecked = pantry-only)</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
          {NEED_KEYS.map((k) => (
            <button key={k} onClick={() => set("needs", { ...f.needs, [k]: !f.needs[k] })} aria-pressed={f.needs[k]} style={{
              padding: "6px 11px", borderRadius: 99, fontSize: "0.74rem", fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
              background: f.needs[k] ? C.turmericDim : C.surface, color: f.needs[k] ? C.turmeric : C.faint,
              border: `1px solid ${f.needs[k] ? C.turmeric + "88" : C.border}`,
            }}>{NEED_INFO[k].label}</button>
          ))}
        </div>

        <label style={label}>Family</label>
        <select style={input} value={f.concept} onChange={(e) => set("concept", e.target.value)}>
          {Object.entries(CONCEPTS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>

        <label style={label}>Balance (per dinner as eaten)</label>
        {[["p", "Protein", C.chili], ["v", "Veg", C.green], ["c", "Carb", C.turmeric]].map(([k, name, col]) => (
          <div key={k} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <span style={{ width: 58, color: C.muted, fontSize: "0.8rem" }}>{name}</span>
            {[0, 1, 2].map((v) => (
              <button key={v} onClick={() => set("balance", { ...f.balance, [k]: v })} style={{
                width: 34, height: 28, borderRadius: 8, cursor: "pointer", fontFamily: "'JetBrains Mono', monospace", fontSize: "0.78rem",
                background: f.balance[k] === v ? col + "26" : C.surface, color: f.balance[k] === v ? col : C.faint,
                border: `1px solid ${f.balance[k] === v ? col : C.border}`,
              }}>{v}</button>
            ))}
          </div>
        ))}

        <label style={label}>Shopping beyond the pantry (one per line)</label>
        <textarea style={{ ...input, minHeight: 54 }} value={f.shop} onChange={(e) => set("shop", e.target.value)} placeholder={"1 kg chicken thighs\n1 pack paneer"} />

        <label style={label}>Ingredients (one per line — optional for dishes you know by heart)</label>
        <textarea style={{ ...input, minHeight: 84 }} value={f.ingredients} onChange={(e) => set("ingredients", e.target.value)} />

        <label style={label}>Method (one step per line — optional)</label>
        <textarea style={{ ...input, minHeight: 84 }} value={f.steps} onChange={(e) => set("steps", e.target.value)} />

        <label style={label}>Note</label>
        <input style={input} value={f.note} onChange={(e) => set("note", e.target.value)} placeholder="Keeps 3 days; better on day 2" />

        <label style={label}>Pairing hint</label>
        <input style={input} value={f.pairHint} onChange={(e) => set("pairHint", e.target.value)} placeholder="Add 2 boiled eggs to hit the protein floor" />

        <div style={{ display: "flex", gap: 10, marginTop: 18, marginBottom: 6 }}>
          <button onClick={save} disabled={!valid} style={{ ...btn("primary"), flex: 1, opacity: valid ? 1 : 0.45 }}>Save</button>
          <button onClick={onCancel} style={{ ...btn(), flex: 1 }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   Recipe detail
   ============================================================ */
function RecipeDetail({ recipe, state, commit, onEdit, onClose }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  if (!recipe) return null;
  const lookup = Object.fromEntries(mergedRecipes(state).map((r) => [r.id, r]));
  const isCombo = !!recipe.parts;
  const parts = isCombo ? recipe.parts.map((id) => lookup[id]).filter(Boolean) : [recipe];
  const shopItems = isCombo ? parts.flatMap((p) => p.shop || []) : recipe.shop || [];
  const flag = state.flags[recipe.id] || { tried: false, notes: "" };
  const inPlan = state.weekPlan.includes(recipe.id);

  const setFlag = (patch) => commit({ ...state, flags: { ...state.flags, [recipe.id]: { ...flag, ...patch } } });
  const togglePlan = () => commit({ ...state, weekPlan: inPlan ? state.weekPlan.filter((x) => x !== recipe.id) : [...state.weekPlan, recipe.id] });
  const resetOverride = () => {
    const o = { ...state.overrides };
    delete o[recipe.id];
    commit({ ...state, overrides: o });
    onClose();
  };
  const deleteCustom = () => {
    commit({
      ...state,
      customRecipes: state.customRecipes.filter((r) => r.id !== recipe.id),
      weekPlan: state.weekPlan.filter((x) => x !== recipe.id),
    });
    onClose();
  };

  const sect = { fontSize: "0.66rem", textTransform: "uppercase", letterSpacing: "0.1em", color: C.faint, marginBottom: 5 };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(15,12,8,0.72)", display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={onClose}>
      <div style={{ width: "100%", maxWidth: 480, maxHeight: "90vh", overflowY: "auto", background: C.surfaceHi, border: `1px solid ${C.border}`, borderRadius: "18px 18px 0 0", padding: 20 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
          <h2 style={{ fontFamily: "'Young Serif', serif", fontSize: "1.3rem", color: C.text, margin: 0, lineHeight: 1.2 }}>{recipe.name}</h2>
          <button onClick={onClose} aria-label="Close" style={{ ...btn(), borderRadius: 99, width: 34, height: 34, padding: 0, flexShrink: 0 }}>✕</button>
        </div>

        <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 9, margin: "9px 0 4px" }}>
          <TierDot tier={recipe.tier} />
          <Mono>{recipe.time} min</Mono>
          <Mono color={C.green}>makes: {recipe.makes}</Mono>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
          <BalanceDots b={recipe.balance} />
          {flag.tried && <Badge color={C.green} bg={C.greenDim}>✓ tried & true</Badge>}
          {recipe.modified && <Badge color={C.turmeric} bg={C.turmericDim}>edited</Badge>}
          {recipe.custom && <Badge color={C.muted} bg={C.surface}>yours</Badge>}
        </div>

        {recipe.hook && <p style={{ color: C.muted, fontSize: "0.88rem", lineHeight: 1.5, margin: "4px 0 12px" }}>{recipe.hook}</p>}
        {recipe.pairHint && (
          <p style={{ background: C.chiliDim, borderRadius: 10, padding: "9px 12px", color: C.text, fontSize: "0.82rem", lineHeight: 1.45, margin: "0 0 12px" }}>
            ⚑ {recipe.pairHint}
          </p>
        )}

        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 12px", marginBottom: 14 }}>
          <div style={sect}>Shopping beyond the pantry</div>
          {shopItems.length === 0
            ? <span style={{ color: C.green, fontSize: "0.84rem" }}>Nothing — the pantry covers it.</span>
            : <span style={{ color: C.text, fontSize: "0.84rem" }}>{shopItems.join(" · ")}</span>}
        </div>

        {parts.map((p, i) => (
          <div key={p.id} style={i > 0 ? { borderTop: `1px solid ${C.border}`, marginTop: 16, paddingTop: 14 } : {}}>
            {isCombo && <div style={{ fontFamily: "'Young Serif', serif", color: C.text, fontSize: "1.02rem", marginBottom: 8 }}>{p.name} <Mono>· {p.time} min</Mono></div>}
            {(p.ingredients || []).length > 0 && (
              <>
                <div style={sect}>Ingredients</div>
                <ul style={{ margin: "0 0 12px", padding: 0, listStyle: "none" }}>
                  {p.ingredients.map((ing, j) => <li key={j} style={{ color: C.text, fontSize: "0.86rem", padding: "2px 0" }}>· {ing}</li>)}
                </ul>
              </>
            )}
            {(p.steps || []).length > 0 && (
              <>
                <div style={sect}>Method</div>
                <ol style={{ margin: 0, padding: 0, listStyle: "none" }}>
                  {p.steps.map((s, j) => (
                    <li key={j} style={{ display: "flex", gap: 10, padding: "3px 0", color: C.text, fontSize: "0.88rem", lineHeight: 1.45 }}>
                      <Mono color={TIERS[p.tier].color}>{j + 1}</Mono><span>{s}</span>
                    </li>
                  ))}
                </ol>
              </>
            )}
            {p.note && <p style={{ background: C.surface, borderRadius: 10, padding: "9px 12px", color: C.muted, fontSize: "0.8rem", lineHeight: 1.5, marginTop: 10 }}>{p.note}</p>}
            {p.leftover && <p style={{ color: C.turmeric, fontSize: "0.78rem", lineHeight: 1.45, marginTop: 8 }}>↻ {p.leftover}</p>}
          </div>
        ))}

        {/* field notes + actions */}
        <div style={{ borderTop: `1px solid ${C.border}`, marginTop: 16, paddingTop: 14 }}>
          <div style={sect}>Field notes (your calibration log)</div>
          <textarea
            value={flag.notes}
            onChange={(e) => setFlag({ notes: e.target.value })}
            placeholder="e.g. HP 9 min next time · 1¾ cups water was right"
            style={{ width: "100%", boxSizing: "border-box", minHeight: 56, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, padding: "9px 11px", fontSize: "0.84rem", fontFamily: "'JetBrains Mono', monospace" }}
          />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
            <button onClick={() => setFlag({ tried: !flag.tried })} style={btn(flag.tried ? "primary" : undefined)}>
              {flag.tried ? "✓ Tried & true" : "Mark tried & true"}
            </button>
            {!isCombo && <button onClick={() => onEdit(recipe)} style={btn()}>Edit</button>}
            <button onClick={togglePlan} style={btn(inPlan ? "primary" : undefined)}>{inPlan ? "✓ In week plan" : "+ Week plan"}</button>
            {recipe.modified && <button onClick={resetOverride} style={btn()}>Reset to default</button>}
            {recipe.custom && (
              confirmDelete
                ? <button onClick={deleteCustom} style={btn("danger")}>Confirm delete</button>
                : <button onClick={() => setConfirmDelete(true)} style={btn("danger")}>Delete</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   Tabs
   ============================================================ */
function Tonight({ state, commit, openRecipe }) {
  const [flame, setFlame] = useState(0);
  const { ready, planIt } = buildGroups(flame, state);
  const toggles = [
    { key: "base", label: "Base jar in" },
    { key: "dal", label: "Cooked dal in" },
    { key: "rice", label: "Leftover rice" },
    { key: "eggs", label: "Eggs in" },
    { key: "paneer", label: "Paneer in" },
    { key: "shopped", label: "Fresh veg / meat in" },
  ];

  const Card = ({ item, highlight }) => {
    const { r, missing } = item;
    const tried = state.flags[r.id]?.tried;
    return (
      <button onClick={() => openRecipe(r)} style={{
        display: "block", width: "100%", textAlign: "left", borderRadius: 12, padding: 14, marginBottom: 10, cursor: "pointer", fontFamily: "inherit",
        background: highlight ? TIERS[r.tier].dim : C.surface,
        border: `1px solid ${highlight ? TIERS[r.tier].color + "55" : C.border}`,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 4, alignItems: "baseline" }}>
          <span style={{ fontFamily: "'Young Serif', serif", color: C.text, fontSize: "1rem" }}>
            {highlight ? "→ " : ""}{r.name}{tried ? " ✓" : ""}
          </span>
          <Mono color={TIERS[r.tier].color}>{r.time} min</Mono>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 5, flexWrap: "wrap" }}>
          <Mono color={C.faint} size="0.72rem">makes: {r.makes}</Mono>
          <BalanceDots b={r.balance} />
        </div>
        {missing.length === 0 ? (
          <>
            <p style={{ color: C.muted, fontSize: "0.8rem", lineHeight: 1.45, margin: 0 }}>{whyLine(r, state)}</p>
            {r.pairHint && (r.balance?.p ?? 2) < 2 && (
              <p style={{ color: C.chili, fontSize: "0.74rem", lineHeight: 1.4, margin: "5px 0 0" }}>⚑ {r.pairHint}</p>
            )}
          </>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
            {missing.map((m) => {
              const info = NEED_INFO[m];
              return (
                <span key={m} style={{
                  fontSize: "0.68rem", padding: "3px 9px", borderRadius: 99,
                  background: info.kind === "shop" ? C.chiliDim : C.turmericDim,
                  color: info.kind === "shop" ? C.chili : C.turmeric,
                }}>{info.miss}</span>
              );
            })}
          </div>
        )}
      </button>
    );
  };

  return (
    <div>
      <h1 style={{ fontFamily: "'Young Serif', serif", fontSize: "1.5rem", color: C.text, margin: 0 }}>What's the flame tonight?</h1>
      <p style={{ color: C.muted, fontSize: "0.86rem", margin: "5px 0 16px" }}>Pick your energy. Everything shows — sorted into cook-now vs worth-a-shop.</p>

      <div role="radiogroup" aria-label="Energy level" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
        {TIERS.map((t) => (
          <button key={t.id} role="radio" aria-checked={flame === t.id} onClick={() => setFlame(t.id)} style={{
            borderRadius: 12, padding: "12px 4px", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, cursor: "pointer", fontFamily: "inherit",
            background: flame === t.id ? t.dim : C.surface, border: `1.5px solid ${flame === t.id ? t.color : C.border}`,
          }}>
            <Flame level={t.id} active={flame === t.id} color={t.color} />
            <span style={{ color: flame === t.id ? t.color : C.muted, fontSize: "0.78rem", fontWeight: 600 }}>{t.name}</span>
            <span style={{ color: C.faint, fontSize: "0.64rem", textAlign: "center", lineHeight: 1.25 }}>{t.sub}</span>
          </button>
        ))}
      </div>

      <div style={{ fontSize: "0.66rem", textTransform: "uppercase", letterSpacing: "0.1em", color: C.faint, marginBottom: 8 }}>What's in the fridge</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 18 }}>
        {toggles.map((t) => {
          const on = state.fridge[t.key];
          return (
            <button key={t.key} aria-pressed={on} onClick={() => commit({ ...state, fridge: { ...state.fridge, [t.key]: !on } })} style={{
              padding: "6px 12px", borderRadius: 99, fontSize: "0.74rem", fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
              background: on ? C.turmericDim : C.surface, color: on ? C.turmeric : C.faint,
              border: `1px solid ${on ? C.turmeric + "80" : C.border}`,
            }}>{t.label}</button>
          );
        })}
      </div>

      {ready.length > 0 && (
        <>
          <div style={{ fontSize: "0.66rem", textTransform: "uppercase", letterSpacing: "0.12em", color: C.green, marginBottom: 8 }}>Cook from what's in</div>
          {ready.map((item, i) => <Card key={item.r.id} item={item} highlight={i === 0} />)}
        </>
      )}
      {planIt.length > 0 && (
        <>
          <div style={{ fontSize: "0.66rem", textTransform: "uppercase", letterSpacing: "0.12em", color: C.turmeric, margin: "18px 0 8px" }}>Worth a shop — or 20 extra minutes</div>
          {planIt.map((item) => <Card key={item.r.id} item={item} highlight={false} />)}
        </>
      )}
      {flame === 2 && <p style={{ color: C.faint, fontSize: "0.78rem" }}>High flame? A bigger cook (rajma, chicken curry, dal makhani) pays off most — one pot covers several fridge nights.</p>}
    </div>
  );
}

function Arsenal({ state, openRecipe, onAdd }) {
  const [tierFilter, setTierFilter] = useState(null);
  const recipes = mergedRecipes(state);
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <h1 style={{ fontFamily: "'Young Serif', serif", fontSize: "1.5rem", color: C.text, margin: 0 }}>The arsenal</h1>
        <button onClick={onAdd} style={btn("primary")}>＋ Add recipe</button>
      </div>
      <p style={{ color: C.muted, fontSize: "0.86rem", margin: "5px 0 16px" }}>Grouped by technique — each family is one move learned once. Mains cover 2–4 fridge dinners; quick dishes fill the fresh nights.</p>

      <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
        {TIERS.map((t) => (
          <button key={t.id} onClick={() => setTierFilter(tierFilter === t.id ? null : t.id)} style={{
            padding: "6px 12px", borderRadius: 99, fontSize: "0.74rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
            background: tierFilter === t.id ? t.dim : C.surface, color: tierFilter === t.id ? t.color : C.faint,
            border: `1px solid ${tierFilter === t.id ? t.color : C.border}`,
          }}>{t.name}</button>
        ))}
      </div>

      {Object.keys(CONCEPTS).map((g) => {
        const items = recipes.filter((r) => r.concept === g && (tierFilter === null || r.tier === tierFilter));
        if (items.length === 0) return null;
        return (
          <div key={g} style={{ marginBottom: 22 }}>
            <div style={{ fontFamily: "'Young Serif', serif", color: C.text, fontSize: "1.02rem" }}>{CONCEPTS[g].label}</div>
            <p style={{ color: C.faint, fontSize: "0.76rem", lineHeight: 1.45, margin: "3px 0 9px" }}>{CONCEPTS[g].note}</p>
            {items.map((r) => {
              const tried = state.flags[r.id]?.tried;
              return (
                <button key={r.id} onClick={() => openRecipe(r)} style={{
                  display: "flex", width: "100%", justifyContent: "space-between", alignItems: "center", gap: 10, textAlign: "left",
                  background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "11px 14px", marginBottom: 8, cursor: "pointer", fontFamily: "inherit",
                }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ color: C.text, fontSize: "0.92rem", fontWeight: 600, display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                      {r.name}
                      {tried && <Badge color={C.green} bg={C.greenDim}>✓</Badge>}
                      {r.modified && <Badge color={C.turmeric} bg={C.turmericDim}>edited</Badge>}
                      {r.custom && <Badge color={C.muted} bg={C.surfaceHi}>yours</Badge>}
                      {!r.known && !tried && !r.custom && <Badge color={C.green} bg={C.greenDim}>new skill</Badge>}
                    </div>
                    <Mono size="0.72rem">{r.time} min · {r.makes}</Mono>
                  </div>
                  <TierDot tier={r.tier} />
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function Kitchen({ state, commit, openRecipe }) {
  const [importText, setImportText] = useState("");
  const [msg, setMsg] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);

  const recipes = mergedRecipes(state);
  const lookup = Object.fromEntries([...recipes, ...COMBOS].map((r) => [r.id, r]));
  const plan = state.weekPlan.map((id) => lookup[id]).filter(Boolean);
  const shopping = [...new Set(plan.flatMap((r) => (r.parts ? r.parts.flatMap((pid) => lookup[pid]?.shop || []) : r.shop || [])))];

  const exportJSON = () => JSON.stringify(state, null, 2);
  const download = () => {
    try {
      const blob = new Blob([exportJSON()], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "lazy-cooking-backup.json";
      a.click();
      URL.revokeObjectURL(a.href);
      setMsg("Backup downloaded.");
    } catch { setMsg("Download failed — use Copy instead."); }
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(exportJSON()); setMsg("Backup copied to clipboard."); }
    catch { setMsg("Clipboard blocked — use Download."); }
  };
  const doImport = () => {
    try {
      const next = migrate(JSON.parse(importText));
      commit(next);
      setImportText("");
      setMsg("Imported — recipes, notes, and fridge state restored.");
    } catch { setMsg("That didn't parse as a Lazy Cooking backup."); }
  };
  const doReset = () => { commit(defaultState()); setConfirmReset(false); setMsg("Reset to factory."); };

  const sect = { fontSize: "0.66rem", textTransform: "uppercase", letterSpacing: "0.12em", color: C.faint, margin: "18px 0 8px" };

  return (
    <div>
      <h1 style={{ fontFamily: "'Young Serif', serif", fontSize: "1.5rem", color: C.text, margin: 0 }}>Kitchen</h1>
      <p style={{ color: C.muted, fontSize: "0.86rem", margin: "5px 0 16px" }}>Plan the week's cook and its shopping list. Your data — backup, restore, reset — lives here too.</p>

      {/* week plan + merged shopping list */}
      <div style={{ background: C.surface, border: `1px solid ${plan.length ? C.turmeric + "55" : C.border}`, borderRadius: 12, padding: 14, marginBottom: 16 }}>
        <div style={{ fontSize: "0.66rem", textTransform: "uppercase", letterSpacing: "0.12em", color: C.turmeric, marginBottom: 8 }}>This week's plan</div>
        {plan.length === 0 ? (
          <p style={{ color: C.faint, fontSize: "0.8rem", margin: 0 }}>Empty. Add dishes from any recipe card ("+ Week plan") and the shopping list assembles itself here. A good week: one batched main (2–3 fridge nights) + a couple of fresh quick dishes.</p>
        ) : (
          <>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 10 }}>
              {plan.map((r) => (
                <span key={r.id} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: C.surfaceHi, border: `1px solid ${C.border}`, borderRadius: 99, padding: "5px 7px 5px 12px", fontSize: "0.76rem", color: C.text }}>
                  <span onClick={() => openRecipe(r)} style={{ cursor: "pointer" }}>{r.name}</span>
                  <button onClick={() => commit({ ...state, weekPlan: state.weekPlan.filter((x) => x !== r.id) })} aria-label={`Remove ${r.name}`}
                    style={{ background: "none", border: "none", color: C.faint, cursor: "pointer", fontSize: "0.8rem", padding: 0, fontFamily: "inherit" }}>✕</button>
                </span>
              ))}
            </div>
            <div style={{ fontSize: "0.66rem", textTransform: "uppercase", letterSpacing: "0.1em", color: C.faint, marginBottom: 5 }}>Shopping list (pantry excluded)</div>
            {shopping.length === 0
              ? <p style={{ color: C.green, fontSize: "0.82rem", margin: "0 0 8px" }}>Nothing to buy — the pantry covers the whole plan.</p>
              : <ul style={{ margin: "0 0 8px", padding: 0, listStyle: "none" }}>
                  {shopping.map((s, i) => <li key={i} style={{ color: C.text, fontSize: "0.84rem", padding: "2px 0" }}>☐ {s}</li>)}
                </ul>}
            <button onClick={() => commit({ ...state, weekPlan: [] })} style={btn()}>Clear plan</button>
          </>
        )}
      </div>

      <div style={{ ...sect, marginTop: 0 }}>Your data</div>
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14 }}>
        <p style={{ color: C.muted, fontSize: "0.78rem", lineHeight: 1.5, margin: "0 0 10px" }}>
          Everything lives in this browser's localStorage — recipes, edits, tried-flags, notes, fridge state, week plan. Back it up occasionally; the backup also migrates you to any future host.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
          <button onClick={download} style={btn("primary")}>Download backup</button>
          <button onClick={copy} style={btn()}>Copy backup</button>
          {confirmReset
            ? <button onClick={doReset} style={btn("danger")}>Confirm reset</button>
            : <button onClick={() => setConfirmReset(true)} style={btn("danger")}>Reset app</button>}
        </div>
        <textarea value={importText} onChange={(e) => setImportText(e.target.value)} placeholder="Paste a backup here to restore…"
          style={{ width: "100%", boxSizing: "border-box", minHeight: 64, background: C.surfaceHi, border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, padding: "9px 11px", fontSize: "0.78rem", fontFamily: "'JetBrains Mono', monospace" }} />
        <button onClick={doImport} disabled={!importText.trim()} style={{ ...btn(), marginTop: 8, opacity: importText.trim() ? 1 : 0.45 }}>Import</button>
        {msg && <p style={{ color: C.green, fontSize: "0.76rem", margin: "10px 0 0" }}>{msg}</p>}
      </div>
    </div>
  );
}

/* ============================================================
   App shell
   ============================================================ */
export default function App() {
  const [state, setState] = useState(loadState);
  const [tab, setTab] = useState("tonight");
  const [opened, setOpened] = useState(null); // recipe object
  const [formTarget, setFormTarget] = useState(null); // {recipe|null}

  const commit = (next) => { setState(next); saveState(next); };

  // keep the opened detail in sync with edits
  const openedLive = useMemo(() => {
    if (!opened) return null;
    if (opened.parts) return COMBOS.find((c) => c.id === opened.id) || opened;
    return mergedRecipes(state).find((r) => r.id === opened.id) || null;
  }, [opened, state]);

  const handleSaveForm = (fields) => {
    const editing = formTarget?.recipe;
    if (editing) {
      if (editing.custom) {
        commit({ ...state, customRecipes: state.customRecipes.map((r) => (r.id === editing.id ? { ...r, ...fields } : r)) });
      } else {
        commit({ ...state, overrides: { ...state.overrides, [editing.id]: fields } });
      }
    } else {
      const id = "custom-" + Date.now().toString(36);
      commit({ ...state, customRecipes: [...state.customRecipes, { id, known: true, ...fields }] });
    }
    setFormTarget(null);
  };

  const tabs = [
    { id: "tonight", label: "Tonight", icon: "◉" },
    { id: "arsenal", label: "Arsenal", icon: "☰" },
    { id: "kitchen", label: "Kitchen", icon: "▤" },
  ];

  return (
    <div style={{ background: C.bg, minHeight: "100vh", fontFamily: "'Instrument Sans', system-ui, sans-serif" }}>
      <style>{`
        * { -webkit-tap-highlight-color: transparent; box-sizing: border-box; }
        button:focus-visible, input:focus-visible, textarea:focus-visible, select:focus-visible { outline: 2px solid ${C.turmeric}; outline-offset: 2px; }
        @media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
      `}</style>

      <div style={{ maxWidth: 480, margin: "0 auto", padding: "24px 16px 100px" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 9, marginBottom: 18 }}>
          <span style={{ fontFamily: "'Young Serif', serif", color: C.turmeric, fontSize: "0.94rem" }}>Lazy Cooking</span>
          <span style={{ color: C.faint, fontSize: "0.66rem", letterSpacing: "0.1em", textTransform: "uppercase" }}>one cook · one kitchen</span>
        </div>

        {tab === "tonight" && <Tonight state={state} commit={commit} openRecipe={setOpened} />}
        {tab === "arsenal" && <Arsenal state={state} openRecipe={setOpened} onAdd={() => setFormTarget({ recipe: null })} />}
        {tab === "kitchen" && <Kitchen state={state} commit={commit} openRecipe={setOpened} />}
      </div>

      <nav aria-label="Sections" style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "rgba(28,23,17,0.94)", borderTop: `1px solid ${C.border}`, backdropFilter: "blur(8px)" }}>
        <div style={{ maxWidth: 480, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(3, 1fr)" }}>
          {tabs.map((t) => (
            <button key={t.id} onClick={() => { setTab(t.id); setOpened(null); }} aria-current={tab === t.id ? "page" : undefined} style={{
              background: "none", border: "none", cursor: "pointer", fontFamily: "inherit",
              padding: "11px 0 9px", display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
              color: tab === t.id ? C.turmeric : C.faint,
            }}>
              <span aria-hidden="true" style={{ fontSize: "1rem" }}>{t.icon}</span>
              <span style={{ fontSize: "0.66rem", fontWeight: 600 }}>{t.label}</span>
            </button>
          ))}
        </div>
        <div style={{ height: "env(safe-area-inset-bottom)" }} />
      </nav>

      {openedLive && (
        <RecipeDetail recipe={openedLive} state={state} commit={commit}
          onEdit={(r) => { setFormTarget({ recipe: r }); }}
          onClose={() => setOpened(null)} />
      )}
      {formTarget && (
        <RecipeForm initial={formTarget.recipe} isBuiltin={formTarget.recipe && !formTarget.recipe.custom}
          onSave={handleSaveForm} onCancel={() => setFormTarget(null)} />
      )}
    </div>
  );
}

/* mount (guarded so the SSR smoke test can import this module) */
if (typeof document !== "undefined") {
  const el = document.getElementById("root");
  if (el) createRoot(el).render(<App />);
}
