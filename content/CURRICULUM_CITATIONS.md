# Curriculum citations — source grounding per lesson

> Which source book(s) each authored lesson is grounded in. Kept in the repo as
> the provenance record (per the pipeline in [`CURRICULUM_PLAN.md`](./CURRICULUM_PLAN.md)),
> not surfaced in the app. The books are reference/grounding to author *original*
> lessons, never reproduced verbatim.
>
> Sources live in `content/Books/md/`. Page references are to the markdown
> conversions (OCR), so they are approximate.

## Source key

- **STG** — *All New Electronics Self-Teaching Guide* (Kybett & Boysen). Structured
  teach-then-question; the closest match to our lesson format. Ch.1 "DC Review and
  Pre-Test" covers current, Ohm's law, series/parallel.
- **PEI** — *Practical Electronics for Inventors* (Scherz & Monk). Ch.2 theory
  (current, voltage, resistance, conductors/insulators, power), Ch.3 components
  (resistor color codes §3.5.3).
- **ME** — *Make: Electronics* (Platt). Discovery-based; Experiments 1–2 cover the
  first circuit, LEDs, polarity, and current-limiting resistors.
- **EAC** — *Encyclopedia of Electronic Components* Vols 1–3 (Platt et al.). Per-part
  reference (resistors, LEDs, LDRs).
- Universal standard = a fact (e.g. the resistor colour digits) consistent across
  all sources; not unique to one book.

---

## Unit 1 — Foundations

### Circuits & Current

**The Closed Loop** (new)
- Current flows only around a complete, unbroken loop; one break stops it
  everywhere: STG Ch.1 "Current Flow" (current flows "in any complete circuit").
- Switch = a controlled break in the loop: ME Experiment 2 (toggle switches make
  the LED go on/off by opening/closing the loop).

**Conductors and Insulators** (new)
- Conductors (copper) vs insulators (rubber, glass, plastic): PEI §2.6 "Insulators,
  Conductors, and Semiconductors".
- Silver conducts slightly better than copper but is too expensive for wiring:
  PEI §2.5/§2.6 ("both copper and silver are great conductors, silver is simply too
  expensive for practical use").

**Voltage Basics** (existing, retro-grounded)
- Voltage = potential difference / electrical pressure: PEI §2.3 "Voltage"; STG Ch.1
  (the battery "provides a potential difference to a circuit that will enable a
  current to flow").
- DC vs AC, voltage dividers (Vout = Vin·R2/(R1+R2)): PEI Ch.2; STG. Verified correct.

**Current Flow Intuition** (existing, retro-grounded)
- Current = flow of charge, measured in amps; conventional current vs electron flow:
  STG Ch.1 "Current Flow".
- Series = same current everywhere; parallel = current splits: STG Ch.1 "Resistors
  in Series / in Parallel". Ohm's law for the LED resistor example: ME Exp.2 (3.5V
  drop at 20 mA). Verified correct.

### Resistance & Ohm's Law

**What Resistance Is** (new)
- Resistance opposes current, measured in ohms; larger R → smaller I: STG Ch.1
  ("larger resistance results in smaller current for any given voltage").
- Water analogy and its limits: PEI §2.3.5 "Water Analogies".
- I = V/R worked example (5V / 1000Ω = 5 mA): STG Ch.1 Ohm's-law problems.

**Resistors and Ohm's Law** (existing, retro-grounded)
- V = I × R, the most basic equation; rearranging for I and R: STG Ch.1 "Ohm's Law"
  ("This is the most basic equation in electricity"). Verified correct.

**Reading Resistor Color Codes** (new)
- 4-band scheme = digit, digit, multiplier (power of 10), tolerance; no 4th band =
  20%: PEI §3.5.3 "Reading Resistor Labels".
- Colour-to-digit values (Black 0 … White 9) and worked examples (Brown-Black-Red =
  1 kΩ; Red-Red-Brown = 220 Ω; Yellow-Violet-Orange = 47 kΩ): universal standard,
  consistent across PEI §3.5.3 and EAC Vol.1 (resistors). NOTE: this lesson is
  text-only today; a real banded-resistor photo would strengthen it (see
  CURRICULUM_PLAN §5, "real photo" cases).

**Power and Heat** (new)
- P = V × I, measured in watts; worked example: PEI Ch.2 §2.7 "Heat and Power" and
  Ch.2 example (0.05 A × 24 V = 1.2 W).
- Resistors dissipate power as heat; hence power ratings: PEI §2.7; EAC Vol.1
  (resistor power ratings).

### LEDs & Current Limiting

**LEDs and Polarity** (existing, retro-grounded)
- LED conducts one way only; long lead = anode = positive, connects toward the
  resistor; reversed = no light: ME Exp.2 ("The long lead on the LED must connect
  with the resistor … if the LED does not go on at all, you've probably connected it
  the wrong way around"). Verified correct.
- Never a bare LED (needs a current-limiting resistor): ME Exp.1–2. Verified.

**Powering an LED Safely** (new)
- LED needs a series current-limiting resistor; ~15–20 mA target: ME Exp.2; EAC
  Vol.2 (LEDs).
- Resistor sizing R = (Vsupply − Vled)/I = (5−2)/0.015 ≈ 200 Ω → 220 Ω standard:
  Ohm's law applied (STG Ch.1) with the LED forward-drop concept (ME Exp.2, which
  uses a ~3.5 V drop at 20 mA; we use a 2 V red-LED drop). Verified arithmetic.

### Series, Parallel & Measuring

**Series vs Parallel** (existing, retro-grounded)
- Series: one path, same current, resistances add (R_T = R1 + R2); parallel:
  branches, current splits, each branch sees full voltage: STG Ch.1 "Resistors in
  Series / in Parallel". One-resistor-per-parallel-LED for matched brightness:
  standard practice (EAC Vol.2 LEDs). Verified correct.

**Measuring Your Circuit** (new)
- Voltmeter measures across a component (in parallel); ammeter measures through the
  path (in series): PEI Ch.2/Appendix on multimeter use (voltmeter example: "you
  measure 24 V across an unmarked resistor … with an ammeter you measure 50 mA").
- Divider midpoint of two equal resistors across 5 V = 2.5 V; I = V/R = 5 mA:
  STG Ch.1 (Ohm's law + divider). Verified arithmetic.

---

## Lessons grounded earlier (Units 2–3), retro-checked

**Breadboard Confidence Drill** — breadboard internal connections (rows of 5 tied,
centre gap separates halves, edge rails are power): standard breadboard reference,
ME Exp.8 (breadboard layout). Verified.

**Short Circuits and Safety** — a short is a low-resistance path that bypasses the
load, current spikes (I = V/R with R→0): STG Ch.1 (Ohm's law); PEI Ch.2 (heat/power
consequence). Verified.

**The Voltage Divider** — Vout = Vin·R2/(R1+R2); swap a fixed resistor for an LDR to
make a light sensor: PEI Ch.2 (dividers) and EAC Vol.3 (Sensors, LDR/photoresistor).
Verified.

**Sensor Signal Sanity Checks** — analogRead range 0–1023 (10-bit ADC), divider as
sensor interface, stuck-reading diagnostics: EAC Vol.3 (Sensors); Arduino analog
input behaviour (Exploring Arduino, Blum). Verified.

---

## Unit 2 — On the Breadboard

All breadboard mechanics grounded in **ME** (Make: Electronics, Ch.2, the
solderless breadboard, solid-core 22-gauge wire, toggle/pushbutton switches) and
standard breadboard reference.

- **Power Rails** (new) — edge bus rails carry + and −, every hole along a rail
  connected: ME Ch.2 breadboard layout. Verified.
- **Jumper Wires** (new) — solid-core ~22-gauge wire is ideal, stranded frays:
  ME Ch.2 (Figs 2-7/2-8). Verified.
- **From Schematic to Breadboard** (new) — schematic = connections by symbol vs
  physical layout; the "both legs in one row shorts it" rule: ME Ch.2; standard.
- **Build a Series LED Circuit** (new) — power → resistor → LED → ground, resistor
  limits current: ME Exp.2; Ohm's law (STG). Verified.
- **Build a Parallel Circuit** (new) — a resistor per branch, branches see full
  voltage, branch currents add: STG Ch.1 (parallel); EAC Vol.2 (LEDs). Verified.
- **Switches in a Circuit** (new) — switch = controlled break; momentary vs toggle,
  SPST: ME Ch.2 (toggle + pushbutton switches). Verified.
- **Common Wiring Mistakes** (new) — reversed LED, missing resistor, short, both
  legs in one row: ME Ch.1–2; STG. Verified.
- **Debugging a Dead Circuit** (new) — check power → loop → orientation → values →
  measure: standard fault-finding method (ME; PEI multimeter use). Verified.
- **Unit 2 Checkpoint** (new) — mixed retrieval over the above; no new claims.

## Unit 3 — Sensors & Signals

Variable-resistance components grounded in **EAC Vol.3 (Sensors)** and **ME**.

- **Potentiometers** (new) — a resistor with a sliding wiper that varies voltage
  and current; used as an adjustable divider: ME Exp. ("Look Inside Your
  Potentiometer", the coil + wiper; "vary voltage and current by varying
  resistance"). Verified.
- **The LDR** (new) — photoresistor of cadmium sulfide; light frees charge
  carriers so resistance falls in light and rises in dark; passive, non-polarised:
  EAC Vol.3 Ch.20 "Photoresistor" (How It Works). Verified.
- **Thermistors** (new) — NTC thermistor resistance falls as temperature rises
  (negative temperature coefficient); passive, non-polarised, read with a divider:
  EAC Vol.3 Ch.23 "NTC thermistor". Verified.
- **Divider as a Sensor** (new) — sensor + fixed resistor divider converts changing
  resistance into a readable voltage; worked values (LDR 1k bright → ~4.5V, dark
  200k → low): PEI Ch.2 (dividers); EAC Vol.3. Arithmetic verified.
- **Analog vs Digital** (new) — digital = two states, analog = continuous; 10-bit
  ADC maps 0–5V to 0–1023, midpoint ≈ 512: Exploring Arduino (Blum); EAC Vol.3.
  Verified.
- **Planning the Light Alarm** (new) — sense → decide → act system shape for the
  LDR alarm: synthesis of the divider (PEI) + LDR (EAC Vol.3); the flagship build.
- **Setting the Threshold** (new) — choose a threshold between the bright and dark
  readings with margin: standard sensor-thresholding practice; reasoning verified.
- **Wiring the Light Alarm** (new) — LDR + 10k divider → A0, LED with its own
  resistor as output: matches the existing `ldr_alarm` diagram + Sensor Signal
  Sanity Checks lesson. Verified.
- **Unit 3 Checkpoint** (new) — mixed retrieval; no new claims.

## Unit 4 — Meet the Arduino

All Arduino code grounded in **EA** (Exploring Arduino, Blum), Chapters 1–2.

- **What Is a Microcontroller** (new) — a small computer on a chip that reads
  inputs, runs your code, drives outputs, and keeps the stored program: EA Ch.1.
- **The Arduino Pins** (new) — digital pins 0–13 (HIGH/LOW), analog inputs A0–A5
  (0–5V), 5V/GND power pins, ADC measures 0–5V: EA Ch.1–2 (board tour). Verified.
- **The Sketch: setup and loop** (new) — setup() runs once, loop() runs forever:
  EA Ch.1 ("setup() is executed once… loop() repeats forever"). Verified.
- **Naming Pins with Variables** (new) — const int LED = 13; for readable,
  portable code: EA Ch.1–2 (const int LED=9 example, LED_BUILTIN portability).
- **pinMode and Outputs** (new) — pinMode(pin, OUTPUT/INPUT) in setup(); pins
  default to INPUT: EA Ch.1 ("All pins default to inputs unless you explicitly
  tell the Arduino to treat them as outputs"). Verified.
- **digitalWrite: On and Off** (new) — HIGH = 5V, LOW = 0V, holds state: EA Ch.1
  ("HIGH (5V) or LOW (0V)… remains in this state until changed"). Verified.
- **Blink** (new) — the canonical sketch (pinMode in setup; digitalWrite HIGH,
  delay, LOW, delay in loop): EA Ch.1 Listing (Blink). Verified verbatim-free.
- **The Serial Monitor** (new) — Serial.begin(9600), Serial.println(val), baud
  must match: EA Ch.3 (Listing 3-1, "A common value is 9600 baud"). Verified.
- **Uploading Your Code** (new) — compile then send over USB; board stores + runs:
  EA Ch.1 (upload flow). Verified.
- **Reading Errors** (new) — missing semicolon / brace; fix the first error first:
  general Arduino/C convention (EA Ch.1–2). Verified.
- **Unit 4 Checkpoint** (new) — mixed retrieval; no new claims.

## Unit 5 — Inputs, Outputs & Code

Grounded in **EA** (Exploring Arduino, Blum) Ch.2–3.

- **Reading a Button** (new) — pinMode INPUT + digitalRead returns HIGH/LOW:
  EA Ch.2 (digital inputs). Verified.
- **Pull-up and Pull-down Resistors** (new) — a floating pin reads noise; a
  pull-down holds it LOW by default (pull-up HIGH): EA Ch.2 ("the input pin is
  said to be floating… reading it could cause unexpected results"). Verified.
- **Debouncing a Button** (new) — mechanical contacts bounce for a few ms; wait
  before re-reading: EA Ch.2 ("debounce a button in software"). Verified.
- **analogRead in Code** (new) — analogRead(A0) returns 0–1023 for 0–5V; no
  pinMode needed: EA Ch.3 ("a number between 0 and 1023"). Verified.
- **analogWrite and PWM** (new) — fast switching averages to an apparent level;
  analogWrite 0–255 for dimming/speed: EA Ch.2 (PWM). Verified.
- **Making Sound with tone()** (new) — tone(pin, freq) / noTone(pin), higher freq
  = higher pitch: standard Arduino tone() reference. Verified.
- **if: Making Decisions** (new) — if (condition) runs a block; <, >, == :
  standard C/Arduino control flow. Verified.
- **Coding the Light Alarm** (new) — analogRead → if (reading < threshold) →
  digitalWrite: synthesis of EA Ch.2–3 mapped onto the Unit 3 alarm. The
  sense/decide/act callback. Verified logic.
- **Calibrating in Code** (new) — print readings, note bright vs dark, set the
  threshold between them: EA Ch.3 (Serial-monitor calibration of a pot/sensor).
  Verified.
- **Unit 5 Checkpoint** (new) — mixed retrieval; no new claims.

## Notes for the pipeline

- Every factual claim above traces to a source; this is the manual version of the
  per-step `sources[]` citation the automated pipeline will enforce
  (CURRICULUM_PLAN §8).
- Lessons that would be materially stronger with a **real photo** (flagged for the
  illustration backlog): *Reading Resistor Color Codes* (banded resistor), and any
  future component-identification lessons.
- New exercise types introduced with this unit: `predict_reading`,
  `predict_behavior`, `choose_resistor` (the predict → commit → reveal family).
