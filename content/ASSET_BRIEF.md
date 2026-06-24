# Ohmlet — Image Asset Brief

What to generate, and exactly what each image should look like. Two independent sets:
**Set A (components)** are plain objects, NO mascot. **Set B (mascot)** is the Ohmlet
character. I generate every circuit *schematic* myself in code, so you never need to make
those.

When a file is dropped at the exact path below, the lessons pick it up automatically.

---

## Global style rules (apply to every image)

- **Format:** PNG with a **transparent background**. No drop-shadow baked in, no frame, no border.
- **Canvas:** square, ~512×512. Subject centered with a little padding around it.
- **No text/labels** baked into the image — the app adds the labels itself.
- **Style:** clean, friendly, lightly stylized — bold dark outlines, soft flat shading.
  Recognizable as the *real* part a learner holds on their bench (not abstract icons, not
  hyper-photoreal). Think "premium app illustration," consistent across the whole set.
- **Palette:** neutral subject colours, with Ohmlet ink `#0a0a0a` for outlines. Reserve the
  electric yellow `#f3e515` for the mascot/accents, not for every component.
- **Consistency matters more than any single image:** same line weight, same lighting
  (gentle, top-left), same scale logic across the set. A learner should feel they belong together.

---

## Set A — Component images (NO mascot, just the object)

Path: `frontend/public/components/`
Used for: "tap the resistor" image questions, and match-the-picture-to-its-name.

| Filename | What it is | Exactly what to show |
|---|---|---|
| `resistor.png` | Axial resistor | Small horizontal cylinder (beige or pale-blue body) with **4 colour bands** and two metal wire legs. The classic through-hole resistor. |
| `led.png` | 5 mm LED | Translucent **red** domed LED, two legs (one slightly longer), a faint glow at the tip. |
| `capacitor-electrolytic.png` | Electrolytic capacitor | Upright **cylinder** (black or blue sleeve) with two legs and a printed stripe marking the negative side. |
| `capacitor-ceramic.png` | Ceramic capacitor | Small **orange/tan disc** on two legs (the little "lentil" cap). |
| `diode.png` | Diode | Small **black cylinder** with a single **silver band** at one end, two legs. |
| `transistor-npn.png` | NPN transistor (TO-92) | **Half-cylinder black body, flat front face**, three legs splaying down (a 2N2222 look). |
| `mosfet.png` | MOSFET (TO-220) | **Black rectangular body with a metal tab + screw hole on top**, three legs below. |
| `ldr.png` | Light-dependent resistor | Round disc with a **wavy/squiggle snake pattern** on its face, two legs. |
| `potentiometer.png` | Rotary potentiometer | Blue/black box body with a **round shaft/knob on top**, three legs. |
| `push-button.png` | Tactile push button | Small **square 4-leg button**, silver top on a black base. |
| `breadboard.png` | Breadboard | White rectangular board with the **grid of holes** and red/blue power rails down the sides. |
| `arduino-uno.png` | Arduino Uno | Teal-blue PCB with **USB-B port + barrel jack**, black header strips, the square chip. Top-down or slight angle. |
| `jumper-wires.png` | Jumper wires | A small **fan of 3–4 colourful male-to-male jumper wires** with pin ends. |
| `battery-9v.png` | 9V battery | Rectangular battery with the **two snap terminals** on top. |
| `coin-cell.png` | Coin cell | Round silver **CR2032** disc battery, shown face + slight edge. |
| `buzzer.png` | Piezo buzzer | Small **black cylinder** with a sound hole on top and two legs. |
| `ic-dip.png` | Logic IC (DIP) | Wide **black chip with pins down both long sides** and a **notch** at one end (a 14/16-pin DIP). |
| `op-amp.png` | Op-amp (8-pin DIP) | Same family but **smaller, 8 pins** (4 each side) with the notch — clearly a little chip. |
| `relay-module.png` | Relay module | Small blue PCB carrying a **cube-shaped relay** and blue **screw terminals**. |
| `dc-motor.png` | DC hobby motor | Small **metal cylinder** with a protruding shaft and two solder tabs. |
| `servo.png` | Servo motor | Blue **SG90-style** servo body with the white **horn arm** on top and a 3-wire cable. |
| `multimeter.png` | Digital multimeter | Handheld meter with a **screen, a rotary dial**, and two probe leads (red + black). |

---

## Set B — Ohmlet mascot expressions

Path: `frontend/public/mascot/`
Used for: answer feedback, lesson intros, celebrations, streaks.

> **Keep the character identical across all 10** — same proportions, same colours, same
> lightning-bolt detail. Generate the one you love first (e.g. `happy`), then ask for
> variations *of that exact image* so it stays on-model. Full body, transparent background.

| Filename | Expression / pose | Where it's used |
|---|---|---|
| `idle.png` | Neutral, friendly, slight smile, standing | Default / resting state |
| `happy.png` | Big smile, maybe a thumbs-up | Correct answer |
| `celebrate.png` | Arms up, eyes bright, mid-cheer | Level-up / lesson complete |
| `think.png` | Hand to chin, looking up, pondering | Hint / "let's reason this out" |
| `oops.png` | Wince, small sweat-drop, sheepish | Wrong answer |
| `encourage.png` | Warm, clapping or "keep going" gesture | After a miss / streak nudge |
| `point.png` | Pointing to one side | Beside a diagram or instruction |
| `probe.png` | Holding a multimeter probe, "lab mode" | Build / live-tutor moments |
| `asleep.png` | Eyes closed, little "Zzz" | Lost streak / inactivity |
| `wave.png` | Waving hello | Onboarding / lesson intro |

---

## Priority if you're rate-limited

If you can only do some per day, this order gives the fastest visible lift:
1. `resistor`, `led`, `capacitor-electrolytic`, `diode`, `transistor-npn`, `ldr`, `arduino-uno`,
   `breadboard` (the Unit 1–2 components — they appear first and most often).
2. The mascot set (the whole emotional layer turns on at once).
3. The remaining components.
