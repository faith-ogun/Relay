# Ohmlet — Achievement Card Art Prompts (50)

Image-generation prompts for the collectible mascot achievement cards (#68). One
prompt per real achievement in `frontend/components/ohmlet/data/achievements.tsx`
(there are exactly 50). Each prompt matches that card's real **title**, **family
palette**, **symbol**, and **rarity tier**, so the generated set drops straight
into the trophy case.

> Branding rule: these are premium collectible trading cards. Describe that
> aesthetic, never name any real trading-card franchise. The hero is always the
> **Ohmlet** in an electronics context so it never reads as food.

---

## How to use (ChatGPT / GPT-image / DALL·E)

1. **Work in one chat thread.** Paste the **Master Style Block** below first as its
   own message so the model locks the look, then send the 50 prompts one at a time.
   The shared style keeps all 50 cards looking like one set, which is the whole
   point of a collectible series.
2. **If you generate a prompt standalone** (fresh chat), paste the Master Style
   Block immediately above that single prompt.
3. **Output spec:** portrait card, **3:4 aspect ratio** (the app renders
   `aspect-[3/4]`), high detail, e.g. 1024×1365 or larger. Ask for a transparent
   or bleed-safe margin so the title banner is not cropped.
4. **Naming:** save each file as its card `id` (in brackets in each prompt), e.g.
   `build-1.png`, `streak-30.png`. That is how the app will reference them.
5. **Consistency pass:** if one card drifts (wrong mascot shape, off palette),
   reply "keep the exact same mascot design and card frame, only change the scene"
   and regenerate.

---

## Canonical mascot (paste this inside the Master Style Block)

**The Ohmlet** is a plump, friendly **egg-shaped character whose body is a ceramic
resistor**: smooth cream/eggshell shell with **two or three colored resistor-band
stripes** wrapped around its middle, and **two bent metal component-lead wires** as
little arms (and sometimes legs). Big warm expressive eyes, simple smile, a tiny
**yellow lightning-bolt** accent. Matte designer-vinyl-toy finish, soft rounded
forms, no human hair, no teeth. It is a mascot, not food. Always shown with
electronics: breadboards, jumper wires, LEDs, a soldering iron, probes.

---

## Master Style Block (paste once at the top of the thread)

> Design a collectible **trading-card illustration**, portrait orientation, **3:4
> aspect ratio**. Subject: **the Ohmlet** — a plump egg-shaped character whose body
> is a ceramic resistor (cream shell, colored resistor-band stripes, bent
> metal-lead wire arms, big friendly eyes, tiny yellow lightning-bolt accent, matte
> vinyl-toy finish; a mascot, never food), always in a hobby-electronics setting.
> Style: clean, premium, characterful 3D-render-meets-illustration, soft studio
> lighting, bold readable silhouette, subtle circuit-trace patterns in the
> background. Card layout: rounded-corner frame, a small **rarity gem** top-right, a
> faint oversized **family symbol** watermark behind the mascot, and a **title
> banner across the bottom** with the card name in a bold uppercase display font.
> Brand accent color is electric yellow #f3e515. No real text errors, no franchise
> logos, no humans. Keep the SAME mascot design and frame across every card; only
> the scene, palette, symbol, and rarity treatment change.

### Rarity treatment (apply per card)

- **Common** — brushed slate / steel frame, soft even glow, calm background.
- **Rare** — polished blue or indigo frame, brighter rim light, faint holographic sheen.
- **Epic** — violet / purple frame, energetic light particles, clear holo shimmer.
- **Legendary** — ornate **gold-foil** frame, full rainbow holographic foil, dramatic
  light rays, premium "chase card" feel. Crown-family legendaries are the most
  ornate of all.

---

## The 50 prompts

### Builds — the core loop (symbol: hexagon / bolt)

1. **[build-1] First Spark** — *Common, blue.* The Ohmlet presses its very first LED
   into a fresh breadboard; a single bright spark-bolt leaps from the contact, lighting
   up its wide proud eyes. Symbol: lightning bolt. Blue palette, steel frame.

2. **[build-5] Getting the Hang** — *Common, blue.* The Ohmlet confidently holding a
   small fan of five electronic components at a breadboard, getting comfortable.
   Symbol: hexagon. Blue palette, steel frame.

3. **[build-10] Bench Regular** — *Rare, indigo.* The Ohmlet at a tidy home workbench,
   a mug beside it, ten little finished circuits lined up in a neat row behind. Symbol:
   hexagon. Indigo palette, polished blue frame, faint holo.

4. **[build-25] Prolific Builder** — *Rare, indigo.* The Ohmlet on a rolling workshop
   stool, surrounded by a wall of twenty-five mini-builds, energised. Symbol: hexagon.
   Indigo palette, blue frame, faint holo.

5. **[build-50] Master Maker** — *Epic, violet.* The Ohmlet in a maker's apron raising
   a soldering iron like a wand, fifty glowing builds arrayed around it. Symbol:
   hexagon. Violet palette, purple frame, holo shimmer.

6. **[build-100] Centurion** — *Legendary, gold.* The Ohmlet as a heroic centurion
   with a breadboard shield and soldering-iron spear, gleaming gold armor, a hundred
   builds behind it. Symbol: hexagon. Gold-foil frame, full holographic foil.

7. **[build-250] Workshop Legend** — *Legendary, crown.* The Ohmlet enthroned in a
   grand workshop wearing a crown made of resistors, friends' broken projects floating
   to it to be fixed. Symbol: crown. Ornate gold-foil frame, rainbow holo.

8. **[build-500] Hall of Famer** — *Legendary, crown.* A museum "hall of fame" plinth:
   a polished bust of the Ohmlet, a brass plaque, a gallery of five hundred builds
   receding behind. Symbol: crown. Ornate gold-foil frame, rainbow holo.

### Streaks — loss aversion (symbol: flame)

9. **[streak-3] Consistent Builder** — *Common, amber.* The Ohmlet with a small cozy
   flame floating above its head, a little 3-day calendar at its feet, warm and content.
   Amber palette, steel frame.

10. **[streak-7] Week Warrior** — *Rare, amber.* The Ohmlet brandishing a flaming
    soldering-iron like a torch-sword, seven flame-marks trailing behind. Amber palette,
    blue frame, faint holo.

11. **[streak-14] Fortnight Fire** — *Rare, rose.* The Ohmlet standing firm inside a
    growing blaze, fourteen tally marks glowing, determined expression. Rose palette,
    blue frame, faint holo.

12. **[streak-30] Monthly Maker** — *Epic, rose.* The Ohmlet riding a comet of flame
    across a night sky, a full 30-day calendar burning bright. Rose palette, purple
    frame, holo shimmer.

13. **[streak-60] Unstoppable** — *Epic, violet.* The Ohmlet bursting forward through a
    barrier with a long violet fire trail, motion lines, fierce focus. Violet palette,
    purple frame, holo shimmer.

14. **[streak-100] Century Streak** — *Legendary, gold.* The Ohmlet wreathed in golden
    phoenix-like fire, a radiant "100", reborn and triumphant. Gold-foil frame, full
    holographic foil.

15. **[streak-365] Year of Volts** — *Legendary, crown.* The Ohmlet at the center of a
    great flaming wheel of 365 calendar days, crowned in fire, serene mastery. Symbol:
    flame inside a crown motif. Ornate gold-foil frame, rainbow holo.

### XP — progression (symbol: bolt)

16. **[xp-500] Warmed Up** — *Common, green.* The Ohmlet doing a light stretch beside a
    glowing green XP meter reading 500, a small bolt spark. Green palette, steel frame.

17. **[xp-1k] Charged Up** — *Common, green.* The Ohmlet plugged into a charging cable,
    a full battery icon above, contented green glow. Green palette, steel frame.

18. **[xp-2_5k] High Voltage** — *Rare, teal.* The Ohmlet crackling with teal
    electricity arcing between its lead-wire arms, eyes bright. Teal palette, blue frame,
    faint holo.

19. **[xp-5k] Power User** — *Rare, teal.* The Ohmlet at a glowing control panel of
    dials and gauges, fully in command, teal light. Teal palette, blue frame, faint holo.

20. **[xp-10k] Ohm Hero** — *Epic, violet.* The Ohmlet as a caped superhero with a
    lightning-bolt chest emblem, heroic pose, violet energy. Violet palette, purple
    frame, holo shimmer.

21. **[xp-25k] Resistance is Futile** — *Legendary, gold.* The Ohmlet standing calm and
    immovable as a torrent of energy streams around it, golden aura, unbothered. Gold-foil
    frame, full holographic foil.

22. **[xp-50k] Grid Master** — *Legendary, crown.* The Ohmlet conducting a glowing
    electric power-grid city below like an orchestra, crowned, energy ribbons everywhere.
    Symbol: bolt inside a crown motif. Ornate gold-foil frame, rainbow holo.

### Units — curriculum depth (symbol: diamond / crown)

23. **[unit-1] Unit Cleared** — *Common, blue.* The Ohmlet planting a little flag atop a
    completed glowing learning-module diamond. Blue palette, steel frame.

24. **[unit-3] Quarter Master** — *Rare, indigo.* The Ohmlet balancing three stacked
    glowing diamond modules, pleased. Indigo palette, blue frame, faint holo.

25. **[unit-6] Halfway Home** — *Epic, violet.* The Ohmlet at a mountain's halfway
    ledge, six planted flags behind and six peaks ahead, resolute. Symbol: diamond.
    Violet palette, purple frame, holo shimmer.

26. **[unit-12] Scholar** — *Legendary, gold.* The Ohmlet in a graduation cap holding a
    diploma, twelve glowing stars in an arc above. Symbol: crown. Gold-foil frame, full
    holographic foil.

### Precision — flawless builds (symbol: diamond)

27. **[perfect-1] Clean Circuit** — *Rare, teal.* The Ohmlet in tiny white gloves
    admiring one flawlessly routed circuit, a single sparkle of perfection. Teal palette,
    blue frame, faint holo.

28. **[perfect-5] Steady Hands** — *Epic, violet.* The Ohmlet doing precise tweezer work
    on a board, perfectly still and zen, focused breath. Symbol: diamond. Violet palette,
    purple frame, holo shimmer.

29. **[perfect-25] Flawless** — *Legendary, gold.* The Ohmlet as a master jeweller with
    a loupe inspecting a perfect diamond made of circuitry, golden light. Symbol: diamond.
    Gold-foil frame, full holographic foil.

### Drawing assessment (symbol: diamond)

30. **[draw-1] First Sketch** — *Common, blue.* The Ohmlet at a drafting table sketching
    its first schematic with a pencil, tongue-out concentration. Blue palette, steel frame.

31. **[draw-10] Draughtsman** — *Rare, indigo.* The Ohmlet with rolled blueprint scrolls
    and a T-square, ten neat schematics pinned behind. Indigo palette, blue frame, faint
    holo.

32. **[draw-50] Schematic Savant** — *Epic, violet.* The Ohmlet surrounded by floating
    holographic schematics it reads effortlessly, fingertips tracing a node. Symbol:
    diamond. Violet palette, purple frame, holo shimmer.

### Live tutor sessions (symbol: bolt)

33. **[live-1] Tutor, Engaged** — *Common, blue.* The Ohmlet appearing on a phone-on-a-
    stand pointed at a workbench, giving a friendly wave to the learner. Blue palette,
    steel frame.

34. **[live-10] Bench Buddy** — *Rare, indigo.* The Ohmlet leaning in beside a build
    like a real lab partner, pointing helpfully at a wire. Indigo palette, blue frame,
    faint holo.

35. **[live-50] Live Wire** — *Epic, violet.* The Ohmlet as an energetic coach with a
    headset, several glowing bench-cam screens around it, mid-encouragement. Symbol: bolt.
    Violet palette, purple frame, holo shimmer.

### 3D digital twins (symbol: star)

36. **[twin-1] Digital Twin** — *Rare, teal.* The Ohmlet beside a glowing translucent 3D
    hologram of its finished build, presenting it like a trophy. Teal palette, blue frame,
    faint holo.

37. **[twin-5] Twin Collector** — *Epic, purple.* The Ohmlet in a small gallery of five
    floating 3D holographic builds on pedestals, admiring its collection. Symbol: star.
    Purple palette, purple frame, holo shimmer.

38. **[twin-25] Mirror Maker** — *Legendary, gold.* The Ohmlet in a grand museum hall
    lined with twenty-five glowing holographic twins, golden spotlights. Symbol: star.
    Gold-foil frame, full holographic foil.

### Community: likes received (symbol: star)

39. **[likes-10] Crowd Pleaser** — *Common, rose.* The Ohmlet on a small stage taking a
    modest bow as little heart icons float up. Rose palette, steel frame.

40. **[likes-50] Community Star** — *Epic, purple.* The Ohmlet lit by a single spotlight
    as a crowd of tiny fans cheers from the dark. Symbol: star. Purple palette, purple
    frame, holo shimmer.

41. **[likes-250] Local Hero** — *Legendary, gold.* The Ohmlet wearing a hero's sash,
    statue-worthy pose on a plinth, golden confetti raining. Symbol: star. Gold-foil
    frame, full holographic foil.

### Community: posts shared (symbol: star)

42. **[post-1] Show & Tell** — *Common, blue.* The Ohmlet holding its build up to a
    camera/feed, a brave proud-nervous smile. Blue palette, steel frame.

43. **[post-10] Storyteller** — *Rare, indigo.* The Ohmlet narrating from an open
    scrapbook-feed of ten builds, gesturing to the story. Indigo palette, blue frame,
    faint holo.

44. **[post-50] Prolific Poster** — *Epic, violet.* The Ohmlet at a broadcast desk
    pushing many glowing posts out into a feed-galaxy. Symbol: star. Violet palette,
    purple frame, holo shimmer.

### Community: comments (symbol: star)

45. **[comment-5] Helping Hand** — *Common, green.* The Ohmlet extending a friendly
    lead-wire hand to pull up a smaller worried egg-builder. Green palette, steel frame.

46. **[comment-50] Mentor** — *Epic, purple.* The Ohmlet as a wise mentor teaching a
    small semicircle of little eggs gathered around a breadboard. Symbol: star. Purple
    palette, purple frame, holo shimmer.

### Challenges and league (symbol: crown)

47. **[chal-1] Challenger** — *Common, amber.* The Ohmlet stepping through an arena
    gateway with fists raised, a challenge banner overhead. Amber palette, steel frame.

48. **[chal-5] Challenge Seeker** — *Rare, indigo.* The Ohmlet eagerly collecting a row
    of challenge medals onto a ribbon. Symbol: crown. Indigo palette, blue frame, faint
    holo.

49. **[league-1] Podium Finish** — *Rare, purple.* The Ohmlet on the top step of a
    three-tier podium holding a small trophy, modest grin. Symbol: crown. Purple palette,
    blue frame, faint holo.

50. **[league-5] League Champion** — *Legendary, crown.* The Ohmlet hoisting a giant
    championship cup overhead, crowned, confetti and golden light streaming. Symbol:
    crown. Ornate gold-foil frame, rainbow holographic foil.

---

## After you generate them

- Drop the 50 files (named by `id`) into `frontend/public/cards/` (or wherever we
  wire the asset path), then swap the `CardShape` SVG centerpiece in
  `AchievementsView.tsx` for the image, keeping the holo frame and rarity glow.
- Keep a **locked / silhouette** variant in mind: the app greys out unearned cards,
  so a desaturated or shadowed version of each render is the natural "locked" state.
- The four rarity tiers already map to real drop-rarity numbers in the data, so the
  legendary foil treatment should be visibly rarer and more lavish than common.
