import { useState, useEffect, useMemo } from "react";
import { createRoot } from "react-dom/client";

/* ============================================================
   CURRY COPILOT — one-person Indian(+) meal-prep decision engine
   Standalone PWA build. All persistence = localStorage.
   Design language: masala-dabba. Tier 0 low flame (green),
   Tier 1 medium (turmeric), Tier 2 prep-day (chili).

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
  { id: 2, name: "High flame", sub: "Prep-day projects", color: C.chili, dim: C.chiliDim },
];

const CONCEPTS = {
  gravy: { label: "Onion–tomato gravy", note: "Home turf. Every dish here is the same move with a different thing dropped in." },
  dal: { label: "Dal + tadka", note: "Batch the dal, freeze it plain, make the tadka fresh on reheat night — fresh tadka on frozen dal tastes made-today." },
  bhurji: { label: "Bhurji & shakshuka", note: "The scramble/poach-in-sauce family. You know the egg version; everything else transfers." },
  dry: { label: "Dry sabzi & tray bakes", note: "Hot fat + spices + one vegetable (or a marinated protein on a tray). No gravy to build. The fast sabzi and high-protein lanes." },
  onepot: { label: "One-pot & leftover rice", note: "Collapses rice + dal or rice + sabzi into one vessel, or transforms yesterday's rice. The lazy thali answers." },
  yogurt: { label: "Yogurt & besan", note: "Entirely pantry-driven. The best no-shopping dinners live here." },
  coconut: { label: "Paste & coconut (Thai)", note: "The jar of paste is store-bought bhuna masala — same shortcut logic, different continent." },
  batch: { label: "Batch enablers", note: "Not dinners — multipliers. An hour here buys weeks of lazy nights." },
  mine: { label: "My recipes", note: "Yours. The engine treats them exactly like the built-ins." },
};

/* Pantry (always assumed): rice, dals, besan, canned chickpeas & tomatoes,
   yogurt, spices, onions, garlic, ginger-garlic paste, potatoes, frozen peas. */

const NEED_INFO = {
  frozenBase: { label: "frozen base portion", miss: "no base portions — build fresh base (+20 min)", kind: "time" },
  frozenDal: { label: "frozen dal portion", miss: "no dal portions — IP dal from scratch (+25 min)", kind: "time" },
  frozenRice: { label: "leftover / frozen rice", miss: "no leftover rice — fresh IP rice (+12 min)", kind: "time" },
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
    id: "tadka-dal", name: "Tadka dal from frozen", tier: 0, time: 15, concept: "dal", known: false,
    needs: ["frozenDal"], makes: "1–2 nights", shop: [],
    balance: { p: 1, v: 0, c: 2 },
    pairHint: "2 boiled eggs alongside (IP does them with the rice) or thick Greek-yogurt raita gets this to your protein floor.",
    hook: "A frozen portion + a 3-minute fresh tadka. Tastes made-today.",
    ingredients: ["1 frozen dal portion (2 servings)", "1 tbsp ghee", "1 tsp cumin seeds", "2 garlic cloves, sliced", "pinch hing", "½ tsp chili powder (off heat)"],
    steps: [
      "Reheat the dal in a pan with a splash of water. Loosen to soup consistency.",
      "Meanwhile: rice in the IP — 1 cup rinsed basmati, 1¼ cups water, HP 4 min, NR 10. Or a frozen rice/cauli portion.",
      "Small pan, ghee hot: cumin till it crackles, garlic till golden, hing; off heat, chili powder.",
      "Pour the tadka over the dal. Done.",
    ],
    note: "Pairs with jeera aloo in the same window for the full thali in ~25 min. Rice slot: real / cauli / half-half.",
    leftover: "",
  },
  {
    id: "egg-curry", name: "Egg curry from frozen base", tier: 0, time: 20, concept: "gravy", known: false,
    needs: ["frozenBase", "eggs"], makes: "2 nights (6 eggs)", shop: ["eggs, if out"],
    balance: { p: 2, v: 1, c: 1 },
    pairHint: "",
    hook: "Boiled eggs dropped into your gravy. The lowest-effort 'real curry' that exists — and it hits the protein floor by itself.",
    ingredients: ["½–1 frozen base portion", "6 eggs", "½ tsp garam masala", "pinch kasuri methi", "water to loosen"],
    steps: [
      "Eggs in the IP: 1 cup water, HP 5 min, quick release, into cold water. (Or 8 min simmering.)",
      "Base into a pan with ~200 ml water, simmer 5 min.",
      "Garam masala + kasuri methi crushed between palms.",
      "Halve the eggs, slide in cut-side up, spoon gravy over. 2 min.",
    ],
    note: "Toast from the freezer keeps this at a 20-minute ceiling. Boiled eggs in gravy reheat fine for night two.",
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
    ingredients: ["1 cup besan", "water to thin-pancake consistency", "1 small onion, chopped fine", "1 green chili (freezer)", "½ tsp ajwain or cumin", "¼ tsp turmeric", "salt"],
    steps: ["Whisk to a lump-free pourable batter. Rest 5 min.", "Nonstick pan, medium, film of oil. Ladle, spread thin.", "2–3 min a side till spotted brown. Makes 3–4.", "Yogurt, ketchup, or pickle."],
    note: "Grate in whatever vegetable is dying in the fridge — this recipe is the fridge's last exit.",
    leftover: "",
  },
  {
    id: "curd-rice", name: "Curd rice", tier: 0, time: 10, concept: "yogurt", known: false,
    needs: ["frozenRice"], makes: "1 night", shop: [],
    balance: { p: 1, v: 0, c: 2 },
    pairHint: "Roasted peanuts in the tadka + 2 boiled eggs on the side if this is the whole dinner.",
    hook: "Leftover rice + yogurt + a tadka. Ten minutes, weirdly restorative.",
    ingredients: ["leftover/frozen rice, warmed", "¾ cup yogurt", "salt", "tadka: 1 tsp mustard seeds, 1 tbsp peanuts, 1 dried chili, curry leaves (freezer), 1 tsp grated ginger"],
    steps: ["Mash the warm rice slightly, stir in yogurt and salt. Should be loose.", "Tadka in hot oil: mustard pops, peanuts golden, chili, curry leaves, ginger.", "Pour over, stir. Pickle on the side."],
    note: "Rice warm, yogurt cold-ish — that contrast is the dish.",
    leftover: "Finishes whatever's left of the yogurt pot.",
  },
  {
    id: "lemon-rice", name: "Lemon rice", tier: 0, time: 12, concept: "onepot", known: false,
    needs: ["frozenRice"], makes: "1 night", shop: [],
    balance: { p: 1, v: 0, c: 2 },
    pairHint: "Peanuts help; 2 boiled eggs make it a dinner.",
    hook: "The other leftover-rice transformer. Peanutty, sharp, bright yellow.",
    ingredients: ["leftover/frozen rice, warmed", "juice of 1 lemon", "½ tsp turmeric", "tadka: 1 tsp mustard seeds, 2 tbsp peanuts, 1 tsp chana dal, 1 dried chili, curry leaves"],
    steps: ["Tadka in 2 tbsp oil: mustard pops, peanuts and chana dal golden, chili, curry leaves, turmeric.", "Rice in, toss to coat and heat through.", "Off heat: lemon juice, salt. It should bite."],
    note: "Lemon always off heat or it turns bitter.",
    leftover: "",
  },
  {
    id: "fried-rice", name: "Egg fried rice", tier: 0, time: 15, concept: "onepot", known: false,
    needs: ["frozenRice", "eggs"], makes: "1–2 nights", shop: ["spring onions (optional)"],
    balance: { p: 2, v: 1, c: 2 },
    pairHint: "",
    hook: "The leftover-rice transformer that actually hits the protein floor. Same slot as lemon rice, East Asian accent.",
    ingredients: ["leftover/frozen rice (cold — essential)", "3 eggs", "big handful frozen peas", "2 garlic cloves", "1½ tbsp soy sauce", "sesame oil or neutral", "spring onion if you have it"],
    steps: [
      "Hot pan, oil: scramble the eggs hard, break into pieces, set aside.",
      "More oil: garlic 20 s, frozen peas 1 min.",
      "Cold rice in, press flat, leave 1 min to crisp, then toss.",
      "Soy in around the edge (it should hiss), eggs back, toss. Spring onion off heat.",
    ],
    note: "Cold day-old rice is the whole trick — fresh rice steams into mush. Frozen rice straight from the bag works.",
    leftover: "",
  },
  {
    id: "bhurji", name: "Egg bhurji", tier: 0, time: 15, concept: "bhurji", known: true,
    needs: ["eggs"], makes: "1 night", shop: ["eggs, if out"],
    balance: { p: 2, v: 1, c: 0 },
    pairHint: "Freezer toast or leftover rice for the carb slot.",
    hook: "You know this one. Listed so the engine can offer it when the fridge is bare.",
    ingredients: ["3–4 eggs", "1 onion", "1 tomato", "chili, turmeric, salt"],
    steps: ["Your usual. Toast from the freezer alongside."],
    note: "Paneer bhurji and shakshuka in this family are the same muscle, new dishes.",
    leftover: "",
  },

  /* ================= TIER 1 — 3–4-dinner mains ================= */
  {
    id: "chana-speedrun", name: "Chana masala speedrun", tier: 1, time: 30, concept: "gravy", known: true,
    needs: ["frozenBase"], makes: "3–4 dinners", shop: [],
    balance: { p: 2, v: 1, c: 2 },
    pairHint: "",
    hook: "Your chole minus the soak and the base-building. Canned chickpeas + frozen base.",
    ingredients: ["1 frozen base portion", "2 cans chickpeas, drained", "2 tsp chana masala (or 1 tsp amchur + 1 tsp garam masala)", "~400 ml water", "ginger julienne + lemon to finish"],
    steps: [
      "Base portion into a pan with the water, simmer 3 min.",
      "Chickpeas + spices in. Simmer 15 min, mashing a handful against the pan to thicken.",
      "Ginger julienne, squeeze of lemon.",
      "IP rice in parallel. Total ~30 min.",
    ],
    note: "The recipe that justifies the frozen-base system. Better on day 2.",
    leftover: "",
  },
  {
    id: "matar-paneer", name: "Matar paneer / aloo matar", tier: 1, time: 30, concept: "gravy", known: false,
    needs: ["frozenBase", "paneer"], makes: "3–4 dinners", shop: ["1–2 packs paneer (225 g each)"],
    balance: { p: 2, v: 1, c: 1 },
    pairHint: "Paneer is the calorie-dense protein — on cut weeks use 1 pack and double the peas.",
    hook: "Frozen base + frozen peas + paneer. Nothing to chop at all.",
    ingredients: ["1 frozen base portion", "1–2 packs paneer, cubed", "2 cups frozen peas", "1 tsp garam masala", "2 tsp kasuri methi", "~400 ml water", "splash of cream or yogurt (optional)"],
    steps: ["Base + water, simmer 3 min.", "Peas in, 5 min. Paneer in, 5 min gentle.", "Garam masala, kasuri methi crushed in."],
    note: "No paneer? Three boiled potatoes → aloo matar, pantry only.",
    leftover: "Open pack of paneer keeps ~3 days — route to paneer bhurji.",
  },
  {
    id: "mushroom", name: "Mushroom masala (speedrun)", tier: 1, time: 30, concept: "gravy", known: true,
    needs: ["frozenBase", "shopped"], makes: "3 dinners", shop: ["2 × 300 g packs mushrooms (all in)"],
    balance: { p: 1, v: 2, c: 1 },
    pairHint: "Mushrooms aren't protein — serve over dal instead of rice, or add 2 boiled eggs.",
    hook: "Your existing dish from frozen base. 45 min becomes 30, and both packs go in so nothing rots.",
    ingredients: ["1 frozen base portion", "600 g mushrooms, quartered", "your usual finish"],
    steps: ["Sear mushrooms hard in batches first — colour on, water off.", "Base + splash of water, simmer 10 min. Finish as usual."],
    note: "The hard sear is the upgrade over stewing them in gravy.",
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
    needs: ["shopped"], makes: "3 dinners", shop: ["1 bag frozen mixed veg (rest lives in the freezer fine)"],
    balance: { p: 1, v: 2, c: 2 },
    pairHint: "Yogurt on the side isn't garnish here — it's the protein. Be generous, or add boiled eggs.",
    hook: "Rice + sabzi collapsed into one pot. Frozen mixed veg makes it a no-chop dish.",
    ingredients: [
      "1½ cups basmati, rinsed till clear", "3 cups mixed veg (frozen is fine; potato chunks welcome)",
      "1 large onion, sliced", "1 tbsp ginger-garlic paste", "1 tomato",
      "whole spices: bay, 4 cloves, 4 cardamom, 1½ tsp cumin",
      "¾ tsp turmeric, 1½ tsp chili powder, 1 tbsp coriander powder",
      "2 cups water (2¼ if all veg are fresh)", // src: 1:1.5 rinsed basmati baseline, reduced for frozen-veg moisture — indianveggiedelight.com + petitepaprika.com
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
    pairHint: "Freezer toast/pav or leftover rice for the carb slot.",
    hook: "Your egg bhurji technique, crumbled paneer instead of eggs. Instant arsenal expansion.",
    ingredients: ["1 pack paneer, crumbled", "your bhurji base (onion, tomato, chili, turmeric)", "kasuri methi"],
    steps: ["Exactly your bhurji: onions, chili, tomato down to jammy.", "Crumbled paneer, 3–4 min. Kasuri methi at the end."],
    note: "Unopened paneer keeps ~2 weeks — good fridge insurance for London weekends.",
    leftover: "",
  },
  {
    id: "dal-palak", name: "Dal palak (frozen × frozen)", tier: 1, time: 20, concept: "dal", known: false,
    needs: ["frozenDal"], makes: "1–2 nights", shop: [],
    balance: { p: 1, v: 2, c: 2 },
    pairHint: "Better balanced than plain dal, still short of the floor — eggs or raita close it.",
    hook: "Frozen dal portion + frozen spinach cubes + fresh tadka. Two freezer items become a greener dal.",
    ingredients: ["1 frozen dal portion", "3–4 frozen spinach cubes (~150 g)", "garlicky tadka: ghee, cumin, 3 garlic cloves, chili powder"],
    steps: ["Reheat dal with a splash of water; drop the spinach cubes in to melt, 5 min.", "Simmer 3 min so it stops tasting of freezer.", "Heavy-garlic tadka over. Rice in the IP in parallel."],
    note: "The standing frozen-spinach bag earns its slot here and in palak paneer.",
    leftover: "",
  },
  {
    id: "jeera-aloo", name: "Jeera aloo", tier: 1, time: 20, concept: "dry", known: false,
    needs: [], makes: "side for 2–3 nights", shop: [],
    balance: { p: 0, v: 1, c: 2 },
    pairHint: "This is the sabzi lane, not the protein — it runs next to dal, not instead of it.",
    hook: "The dry-sabzi concept, minimum viable version. Boiled potatoes in a cumin-heavy tadka.",
    ingredients: ["5 potatoes, boiled and cubed (IP 6 min HP, or microwave)", "1 tbsp cumin seeds", "¾ tsp turmeric, 1½ tsp chili powder, 1 tbsp coriander powder, ¾ tsp amchur"],
    steps: ["Generous oil, cumin till fragrant.", "Powders 10 seconds, then potatoes before anything burns.", "Toss, then leave alone on medium so edges crisp. Salt, amchur off heat."],
    note: "Re-crisps in a hot pan. The 10-minute lane that completes the thali next to frozen dal + rice.",
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
    needs: ["eggs"], makes: "sauce for 2 nights, eggs fresh each night", shop: ["1 pepper (optional)", "crusty bread — freezer bread works"],
    balance: { p: 2, v: 2, c: 1 },
    pairHint: "",
    hook: "Your egg-curry cousin from the Middle East lane: tomato-pepper sauce, eggs poached straight in.",
    ingredients: ["1 onion, sliced", "1 pepper, sliced (or skip)", "3 garlic cloves", "1 tsp paprika + 1 tsp cumin + chili to taste", "1 can tomatoes", "3 eggs per night", "feta or yogurt to finish (optional)"],
    steps: [
      "Soften onion + pepper in olive oil, 6–8 min. Garlic + spices 1 min.",
      "Can of tomatoes, crush, simmer 10 min till thick and jammy.",
      "Wells in the sauce, crack the eggs in, lid on, 5–6 min till whites set, yolks soft.",
      "Bread from the freezer, toasted, for mopping.",
    ],
    note: "Make double sauce; keep half. Crack fresh eggs into reheated sauce tomorrow — never reheat a poached egg.",
    leftover: "Sauce keeps 3 days and doubles as pasta sauce or egg-curry base.",
  },
  {
    id: "thai-curry", name: "Thai curry (jar-paste)", tier: 1, time: 30, concept: "coconut", known: false,
    needs: ["shopped"], makes: "3 dinners", shop: ["1 jar Thai red or green paste (fridge, keeps months)", "1 × 400 ml tin coconut milk (whole tin — nothing stranded)", "500 g chicken thighs (or tofu)", "green beans or a pepper"],
    balance: { p: 2, v: 2, c: 1 },
    pairHint: "Light coconut milk on cut weeks; rice slot: real / cauli / half-half.",
    hook: "The jar of paste is store-bought bhuna masala — fry it, add coconut, done. Same shortcut logic as your frozen base.",
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
    id: "shawarma-bake", name: "Chicken shawarma tray bake", tier: 1, time: 45, concept: "dry", known: false,
    needs: ["shopped"], makes: "3–4 dinners", shop: ["1 kg chicken thighs (whole pack)", "2 peppers + 2 red onions"],
    balance: { p: 2, v: 2, c: 0 },
    pairHint: "Highest protein-per-effort in the app. Wrap in freezer flatbread, or over rice + yogurt.",
    hook: "Yogurt-marinade tray bake — tandoori logic via the Middle East. 10 minutes of your attention, the oven does the rest.",
    ingredients: [
      "1 kg chicken thighs", "marinade: 4 tbsp yogurt, 2 tsp cumin, 2 tsp paprika, 1 tsp coriander pwd, ½ tsp turmeric, ½ tsp cinnamon, 3 garlic cloves, juice of ½ lemon, salt",
      "2 peppers + 2 red onions, in chunks", "garlic-yogurt sauce: rest of the yogurt + garlic + lemon + salt",
    ],
    steps: [
      "Massage marinade into the thighs (10 min counts; overnight is better).",
      "Tray: veg underneath, chicken on top. 220 °C, 30–35 min till charred at the edges.",
      "Rest 5 min, slice.",
      "Garlic-yogurt sauce from the remaining pot.",
    ],
    note: "Reheats well 3 days; also the best sandwich-lunch leftover in the app.",
    leftover: "Yogurt pot fully routed: marinade + sauce.",
  },

  /* ================= TIER 2 — prep-day projects ================= */
  {
    id: "base-batch", name: "Bhuna masala batch (the enabler)", tier: 2, time: 50, concept: "batch", known: true,
    needs: [], makes: "3 portions · each = one 3–4-dinner main", shop: [],
    balance: { p: 0, v: 1, c: 0 },
    pairHint: "",
    hook: "Your onion–tomato base at scale, frozen in portions sized for a full batch cook. Every gravy dish starts here.",
    ingredients: ["6 onions, chopped", "3 tbsp ginger-garlic paste", "6 tomatoes or 2 cans", "1 tbsp turmeric, 2 tsp chili powder, 2 tbsp coriander powder", "6 tbsp oil, salt"],
    steps: [
      "Brown the onions properly — 15–20 min, deep golden. This is where all the flavour lives; don't rush it.",
      "Ginger-garlic 2 min, powders 30 s.",
      "Tomatoes in; cook till the oil separates and it's a thick paste — 12–15 min.",
      "Cool. Portion into 3 (~200 g each). Freeze flat.",
    ],
    note: "Runs on the stove while the IP does dal — that's the Full Sunday plan. Works out well under a tablespoon of oil per eventual dinner.",
    leftover: "",
  },
  {
    id: "dal-batch", name: "Big dal batch (freeze 2)", tier: 2, time: 40, concept: "batch", known: true,
    needs: [], makes: "6 servings · eat 2, freeze 2 × 2", shop: [],
    balance: { p: 1, v: 0, c: 1 },
    pairHint: "",
    hook: "Your dal, doubled, deliberately under-finished. The tadka happens fresh on reheat night — that's the whole trick.",
    ingredients: ["2 cups toor or moong dal, rinsed", "¾ tsp turmeric, salt", "1 tomato (optional)", "7 cups water"],
    steps: [
      "Everything in the IP. HP 10 min, NR.", // toor/moong 8–12 min HP is the standard band
      "Whisk smooth-ish. NO tadka yet.",
      "Tonight's share gets fresh tadka; freeze 2 flat portions of 2 servings, plain.",
    ],
    note: "Frozen plain dal + fresh tadka is indistinguishable from same-day dal. Frozen tadka'd dal is not.",
    leftover: "",
  },
  {
    id: "rajma", name: "Rajma (IP)", tier: 2, time: 60, concept: "gravy", known: false,
    needs: [], makes: "4 dinners", shop: [],
    balance: { p: 2, v: 1, c: 2 },
    pairHint: "",
    hook: "Exactly your chole move with a different bean. Zero new technique, one new dish — and it's the chili gateway.",
    ingredients: [
      "1½ cups rajma, soaked overnight (or 1 hr in just-boiled water)",
      "your onion–tomato base (fresh, or 1 frozen portion)",
      "3 cups water", // src: 1.5–3 cups per cup of soaked beans across pipingpotcurry / indianveggiedelight / masalachilli
      "1½ tsp garam masala, 1 tsp kasuri methi",
    ],
    steps: [
      "Build the base in the IP on sauté (or melt a frozen portion).",
      "Drained rajma + water. HP 30 min, NR.", // src: consensus for soaked beans — pipingpotcurry.com, indianveggiedelight.com, masalachilli.com
      "Mash a ladleful against the wall to thicken. Garam masala, kasuri methi.",
    ],
    note: "Freezes brilliantly — the frozen-meals slot's best tenant. Overnight soak also makes it digestible; don't skip.",
    leftover: "",
  },
  {
    id: "chicken-batch", name: "Chicken curry (batch)", tier: 2, time: 60, concept: "gravy", known: true,
    needs: ["shopped"], makes: "4 dinners", shop: ["1 kg chicken thighs (whole pack)"],
    balance: { p: 2, v: 1, c: 1 },
    pairHint: "",
    hook: "Your dish. Batched to the whole 1 kg pack: 3 fridge dinners + 1 freezer portion as insurance.",
    ingredients: ["1 kg chicken thighs", "your base (or 1 frozen portion + fresh finish)", "your usual spicing"],
    steps: ["Your usual method — from a frozen base portion it's ~30 min instead of an hour.", "Portion on cook day: 3 to the fridge, 1 to the freezer."],
    note: "Thighs survive reheating far better than breast.",
    leftover: "",
  },
  {
    id: "dal-makhani", name: "Dal makhani (IP, soaked)", tier: 2, time: 60, concept: "dal", known: false,
    needs: [], makes: "4+ dinners · freeze half", shop: [],
    balance: { p: 2, v: 0, c: 1 },
    pairHint: "Rich by design — this is the rare-occasion slot, not the default. Freeze half before you can eat it.",
    hook: "The weekend-luxury dal. 10 minutes of effort, the IP does the rest, and it freezes better than almost anything.",
    ingredients: [
      "1 cup whole urad + ⅓ cup rajma, soaked overnight",
      "1 onion + 1 tbsp ginger-garlic + 1 can tomatoes (or 1 frozen base portion)",
      "1½ tsp chili powder, ¾ tsp garam masala",
      "4 cups water", // src: ~3–4 cups per 1¼ cups soaked legumes — ministryofcurry.com, pipingpotcurry.com
      "2 tbsp butter + splash of cream",
    ],
    steps: [
      "Sauté the base in the IP (or melt a frozen portion).",
      "Soaked dals + water. HP 30 min, NR.", // src: soaked consensus 30 min — ministryofcurry.com, pipingpotcurry.com, culinaryshades.com (45+ only for unsoaked)
      "Mash partially, then sauté-simmer 10 min with the butter — the longer it burbles, the better.",
      "Cream off heat.",
    ],
    note: "Tastes better on day 2 anyway. Soak matters: unsoaked needs 45+ min and comes out less creamy.",
    leftover: "",
  },
  {
    id: "palak-paneer", name: "Palak paneer (frozen-spinach cheat)", tier: 2, time: 40, concept: "gravy", known: false,
    needs: ["paneer"], makes: "3 dinners", shop: ["1 pack paneer (225 g)", "450 g frozen spinach — skip if the standing bag is stocked"],
    balance: { p: 2, v: 2, c: 0 },
    pairHint: "",
    hook: "Frozen spinach removes all the washing/blanching pain. With a frozen base portion it drops to ~25 min.",
    ingredients: ["450 g frozen spinach, thawed", "1 frozen base portion (or fresh: onion, garlic, tomato)", "1 pack paneer", "½ tsp garam masala, splash of cream, squeeze of lemon"],
    steps: [
      "Base into the pan, loosen with water.",
      "Spinach in, simmer 8–10 min; stick-blend right in the pan for smooth, or leave rustic.",
      "Paneer, garam masala, cream. Lemon off heat.",
    ],
    note: "The stick blender earns its drawer space here.",
    leftover: "",
  },
];

const COMBOS = [
  {
    id: "combo-thali", name: "The 25-minute thali", tier: 0, time: 25,
    parts: ["tadka-dal", "jeera-aloo"], needs: ["frozenDal"], shop: [],
    makes: "thali tonight · aloo covers 2 more nights",
    balance: { p: 1, v: 1, c: 2 },
    pairHint: "Boil 2 eggs in the IP alongside the rice — same cycle, protein floor met.",
    hook: "Frozen dal + fresh tadka, jeera aloo on the stove, rice in the IP — all in parallel. The full rice–dal–sabzi paradigm, one person, 25 minutes.",
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

const PLANS = [
  {
    id: "full-sunday", title: "Full Sunday at home", time: "~90 min, two lanes",
    outcome: "3–4 dinners ready · 2 frozen dal portions · 2 frozen base portions (each a future 3–4-dinner main)",
    lanes: {
      "Instant Pot": [
        "0:00 — Big dal batch: dal, turmeric, salt, water. HP 10, NR.",
        "0:35 — Dal out. Tonight's share aside, 2 portions frozen plain.",
        "0:40 — Rice for tonight: HP 4, NR 10.",
      ],
      Stove: [
        "0:00 — Start the bhuna masala batch (the long onion browning happens while the IP is locked anyway).",
        "0:45 — Base done. Keep 1 portion in the pan, freeze 2.",
        "0:50 — Turn the kept portion into the week's main: chicken curry, chana, or matar paneer.",
        "1:20 — Fresh tadka on tonight's dal. Portion the main: 3 fridge, rest to freezer. Plate.",
      ],
    },
    note: "One session stocks the entire system. Every 2–3 weeks keeps the freezer topped up.",
  },
  {
    id: "half-day", title: "Half day / low-key Sunday", time: "~45–60 min",
    outcome: "One main = 3–4 dinners (3 fridge + 1 frozen)",
    lanes: {
      "Instant Pot": [
        "0:00 — One-pot main: rajma, chicken curry, or dal makhani. Sauté the base in the pot, add, pressure cook.",
        "Last 15 — Rice on the stove for once, or freezer rice tomorrow.",
      ],
      Stove: ["Optional: bhuna masala batch alongside — it's mostly stirring.", "Or: shawarma tray bake instead of the IP main — 10 min of effort, oven does the rest."],
    },
    note: "One good main covers Sun–Wed. Tier-0 recipes bridge the rest.",
  },
  {
    id: "london-sunday", title: "Back from London, Sunday night", time: "0 min shopping · 15–25 min cooking",
    outcome: "Tonight fed from freezer/pantry · Monday's batch cook queued",
    lanes: {
      Tonight: [
        "Freezer has dal → tadka dal or dal palak + IP rice (15–20 min).",
        "Freezer has base + eggs in fridge → egg curry (20 min).",
        "Freezer empty → khichdi, shakshuka, or besan chilla (pantry + eggs).",
      ],
      "Monday, after work + shop": [
        "Chana speedrun or matar paneer from frozen base (30 min) → 3–4 dinners, covers Tue–Thu.",
        "No base left? Tehri one-pot (35 min, 3 dinners) or Thai jar-paste curry (30 min).",
      ],
    },
    note: "This scenario is what the freezer portions exist for. Empty freezer before a London weekend = your cue for a Saturday top-up.",
  },
  {
    id: "saturday-prep", title: "Saturday prep, London Sunday", time: "~90 min Saturday",
    outcome: "Sunday-night dinner pre-portioned · 3–4 dinners for the week",
    lanes: {
      Saturday: [
        "Run the Full Sunday plan, one day early.",
        "Portion one serving of the main separately — Sunday night's zero-effort dinner.",
        "Freeze a rice portion too: flat bag, breaks apart, 3 min in the microwave.",
      ],
      "Sunday night": ["Reheat the set-aside portion. That's it. That's the plan."],
    },
    note: "The best version of the London problem is the one you solved yesterday.",
  },
];

/* ============================================================
   Persistence — localStorage, schema-versioned
   ============================================================ */
const KEY = "lazy-cooking";
const SCHEMA_VERSION = 3;

const defaultState = () => ({
  schemaVersion: SCHEMA_VERSION,
  freezer: { base: 0, dal: 0, rice: 0, meals: 0, cauliRice: 0, spinach: 0, peas: 0 },
  fridge: { eggs: true, paneer: false, shopped: false, rice: false },
  customRecipes: [],
  overrides: {},
  flags: {},
  weekPlan: [],
});

function migrate(raw) {
  const d = defaultState();
  if (!raw || typeof raw !== "object") return d;
  // v1/v2 (artifact era) had only freezer + fridge; later versions add fields.
  // Migrations are additive: never drop user data.
  return {
    ...d,
    ...raw,
    schemaVersion: SCHEMA_VERSION,
    freezer: { ...d.freezer, ...(raw.freezer || {}) },
    fridge: { ...d.fridge, ...(raw.fridge || {}) },
    customRecipes: Array.isArray(raw.customRecipes) ? raw.customRecipes : [],
    overrides: raw.overrides && typeof raw.overrides === "object" ? raw.overrides : {},
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
  const { freezer, fridge } = state;
  return {
    frozenBase: freezer.base > 0,
    frozenDal: freezer.dal > 0,
    frozenRice: freezer.rice > 0 || fridge.rice,
    eggs: fridge.eggs,
    paneer: fridge.paneer,
    shopped: fridge.shopped,
  };
}

function score(r, flame, flags) {
  let s = 0;
  if (r.tier === flame) s += 3;
  if ((r.needs || []).includes("frozenDal") || (r.needs || []).includes("frozenBase")) s += 3;
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
  return { ready: ready.slice(0, 6), planIt: planIt.slice(0, 6) };
}

function whyLine(r, state) {
  const bits = [];
  const needs = r.needs || [];
  if (needs.includes("frozenDal")) bits.push(`uses 1 of ${state.freezer.dal} frozen dal portions`);
  if (needs.includes("frozenBase")) bits.push(`uses a frozen base portion (${state.freezer.base} left)`);
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
const MAKES_OPTIONS = ["1 night", "1–2 nights", "2 nights", "3 dinners", "3–4 dinners", "side for 2–3 nights"];

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
    { key: "eggs", label: "Eggs in fridge" },
    { key: "paneer", label: "Paneer in fridge" },
    { key: "shopped", label: "Fresh veg in" },
    { key: "rice", label: "Leftover rice" },
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

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
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
      <div style={{ marginBottom: 18 }}>
        <Mono size="0.72rem">
          freezer: {state.freezer.base} base · {state.freezer.dal} dal · {state.freezer.rice} rice · {state.freezer.cauliRice} cauli · {state.freezer.meals} meals
        </Mono>
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
      {flame === 2 && <p style={{ color: C.faint, fontSize: "0.78rem" }}>High flame with time to shop? The Prep day tab is where it pays off most.</p>}
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
      <p style={{ color: C.muted, fontSize: "0.86rem", margin: "5px 0 16px" }}>Grouped by technique — each family is one move learned once. Mains scale to 3–4 dinners.</p>

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

function Prep({ state, commit, openRecipe }) {
  const [open, setOpen] = useState("full-sunday");
  const recipes = mergedRecipes(state);
  const lookup = Object.fromEntries([...recipes, ...COMBOS].map((r) => [r.id, r]));
  const plan = state.weekPlan.map((id) => lookup[id]).filter(Boolean);
  const shopping = [...new Set(plan.flatMap((r) => (r.parts ? r.parts.flatMap((pid) => lookup[pid]?.shop || []) : r.shop || [])))];

  return (
    <div>
      <h1 style={{ fontFamily: "'Young Serif', serif", fontSize: "1.5rem", color: C.text, margin: 0 }}>Prep day</h1>
      <p style={{ color: C.muted, fontSize: "0.86rem", margin: "5px 0 16px" }}>Pick the weekend you're actually having — IP and stove run as parallel lanes.</p>

      {/* week plan + merged shopping list */}
      <div style={{ background: C.surface, border: `1px solid ${plan.length ? C.turmeric + "55" : C.border}`, borderRadius: 12, padding: 14, marginBottom: 16 }}>
        <div style={{ fontSize: "0.66rem", textTransform: "uppercase", letterSpacing: "0.12em", color: C.turmeric, marginBottom: 8 }}>This week's plan</div>
        {plan.length === 0 ? (
          <p style={{ color: C.faint, fontSize: "0.8rem", margin: 0 }}>Empty. Add dishes from any recipe card ("+ Week plan") and the Monday shopping list assembles itself here.</p>
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
              ? <p style={{ color: C.green, fontSize: "0.82rem", margin: "0 0 8px" }}>Nothing to buy — the pantry and freezer cover the whole plan.</p>
              : <ul style={{ margin: "0 0 8px", padding: 0, listStyle: "none" }}>
                  {shopping.map((s, i) => <li key={i} style={{ color: C.text, fontSize: "0.84rem", padding: "2px 0" }}>☐ {s}</li>)}
                </ul>}
            <button onClick={() => commit({ ...state, weekPlan: [] })} style={btn()}>Clear plan</button>
          </>
        )}
      </div>

      {PLANS.map((p) => {
        const isOpen = open === p.id;
        return (
          <div key={p.id} style={{ background: C.surface, border: `1px solid ${isOpen ? C.turmeric + "66" : C.border}`, borderRadius: 12, marginBottom: 10, overflow: "hidden" }}>
            <button onClick={() => setOpen(isOpen ? null : p.id)} aria-expanded={isOpen} style={{
              display: "flex", width: "100%", justifyContent: "space-between", alignItems: "center", gap: 8,
              background: "none", border: "none", textAlign: "left", padding: "13px 14px", cursor: "pointer", fontFamily: "inherit",
            }}>
              <div>
                <div style={{ fontFamily: "'Young Serif', serif", color: C.text, fontSize: "1rem" }}>{p.title}</div>
                <Mono size="0.72rem">{p.time}</Mono>
              </div>
              <span style={{ color: C.faint, transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>▾</span>
            </button>
            {isOpen && (
              <div style={{ padding: "0 14px 14px" }}>
                <p style={{ background: C.turmericDim, color: C.turmeric, fontSize: "0.78rem", lineHeight: 1.45, borderRadius: 10, padding: "9px 11px", margin: "0 0 12px" }}>Yields: {p.outcome}</p>
                {Object.entries(p.lanes).map(([lane, steps]) => (
                  <div key={lane} style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: "0.66rem", textTransform: "uppercase", letterSpacing: "0.12em", color: C.faint, marginBottom: 6 }}>{lane}</div>
                    {steps.map((s, i) => (
                      <div key={i} style={{ display: "flex", gap: 10, padding: "3px 0", color: C.text, fontSize: "0.85rem", lineHeight: 1.45 }}>
                        <span style={{ color: C.turmeric }}>—</span><span>{s}</span>
                      </div>
                    ))}
                  </div>
                ))}
                <p style={{ color: C.muted, fontSize: "0.78rem", lineHeight: 1.5, margin: 0 }}>{p.note}</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Freezer({ state, commit }) {
  const [importText, setImportText] = useState("");
  const [msg, setMsg] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);

  const portionSlots = [
    { key: "base", label: "Bhuna masala portions", hint: "1 portion = one 3–4-dinner main in ~30 min, no chopping" },
    { key: "dal", label: "Plain dal portions", hint: "2 servings each · tadka fresh on reheat night, never before freezing" },
    { key: "rice", label: "Rice portions", hint: "Flat bags, break-apart, 3 min in the microwave — reheated rice = resistant-starch bonus" },
    { key: "meals", label: "Full frozen meals", hint: "Day-4 portions frozen on cook day + rajma / dal makhani halves" },
  ];
  const standing = [
    { key: "cauliRice", label: "Cauli rice bags", hint: "The rice-slot stretcher: half-half with real rice, or solo on default nights" },
    { key: "spinach", label: "Frozen spinach", hint: "Dal palak + palak paneer live off this" },
    { key: "peas", label: "Frozen peas", hint: "Khichdi, matar paneer, fried rice — the universal veg dot" },
  ];
  const slotTotal = portionSlots.reduce((a, s) => a + state.freezer[s.key], 0);

  const step = (key, d) => {
    const v = Math.max(0, Math.min(9, state.freezer[key] + d));
    commit({ ...state, freezer: { ...state.freezer, [key]: v } });
  };

  const Counter = ({ s }) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "11px 14px", marginBottom: 9 }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ color: C.text, fontSize: "0.9rem", fontWeight: 600 }}>{s.label}</div>
        <div style={{ color: C.faint, fontSize: "0.72rem", lineHeight: 1.35 }}>{s.hint}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <button onClick={() => step(s.key, -1)} aria-label={`Remove one: ${s.label}`} style={{ ...btn(), width: 36, height: 36, borderRadius: 99, padding: 0, fontSize: "1.05rem" }}>−</button>
        <Mono color={C.turmeric} size="1rem">{state.freezer[s.key]}</Mono>
        <button onClick={() => step(s.key, 1)} aria-label={`Add one: ${s.label}`} style={{ ...btn(), width: 36, height: 36, borderRadius: 99, padding: 0, fontSize: "1.05rem", color: C.text }}>＋</button>
      </div>
    </div>
  );

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
      setMsg("Imported — recipes, notes, and freezer restored.");
    } catch { setMsg("That didn't parse as a Lazy Cooking backup."); }
  };
  const doReset = () => { commit(defaultState()); setConfirmReset(false); setMsg("Reset to factory."); };

  const sect = { fontSize: "0.66rem", textTransform: "uppercase", letterSpacing: "0.12em", color: C.faint, margin: "18px 0 8px" };

  return (
    <div>
      <h1 style={{ fontFamily: "'Young Serif', serif", fontSize: "1.5rem", color: C.text, margin: 0 }}>Freezer</h1>
      <p style={{ color: C.muted, fontSize: "0.86rem", margin: "5px 0 16px" }}>This drives the Tonight suggestions. Update it when you batch or when you raid it.</p>

      <div style={{ ...sect, marginTop: 0 }}>Portions (count toward slots)</div>
      {portionSlots.map((s) => <Counter key={s.key} s={s} />)}
      <p style={{ color: slotTotal > 6 ? C.chili : C.faint, fontSize: "0.78rem", margin: "4px 0 0" }}>
        {slotTotal} slot{slotTotal === 1 ? "" : "s"} in use{slotTotal > 6 ? " — past your usual freezer space; eat before you batch again." : " · aim ≤6 with your freezer."}
      </p>
      {slotTotal === 0 && (
        <div style={{ background: C.chiliDim, border: `1px solid ${C.chili}55`, borderRadius: 12, padding: 14, marginTop: 10 }}>
          <p style={{ color: C.text, fontSize: "0.84rem", lineHeight: 1.5, margin: 0 }}>
            Empty freezer + a London weekend coming = a rough Sunday night. The 50-minute bhuna masala batch (Prep day) is the fix.
          </p>
        </div>
      )}

      <div style={sect}>Standing items (flat bags, don't count)</div>
      {standing.map((s) => <Counter key={s.key} s={s} />)}

      <div style={sect}>Your data</div>
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14 }}>
        <p style={{ color: C.muted, fontSize: "0.78rem", lineHeight: 1.5, margin: "0 0 10px" }}>
          Everything lives in this browser's localStorage — recipes, edits, tried-flags, notes, freezer counts. Back it up occasionally; the backup also migrates you to any future host.
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
    { id: "prep", label: "Prep day", icon: "▤" },
    { id: "freezer", label: "Freezer", icon: "❄" },
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
        {tab === "prep" && <Prep state={state} commit={commit} openRecipe={setOpened} />}
        {tab === "freezer" && <Freezer state={state} commit={commit} />}
      </div>

      <nav aria-label="Sections" style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "rgba(28,23,17,0.94)", borderTop: `1px solid ${C.border}`, backdropFilter: "blur(8px)" }}>
        <div style={{ maxWidth: 480, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(4, 1fr)" }}>
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
