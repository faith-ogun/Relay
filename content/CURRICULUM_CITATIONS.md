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

## Unit 6 — Capacitors, RC & Timing

Grounded in **EAC Vol.1** (Charles Platt, "Capacitor" chapter), **ME** (Make:
Electronics, Experiments 8–10 on capacitors, time, and the relay/555 oscillator),
and **PEI** §2.23 (capacitors). Authored to the quality bar (difficulty-tiered
pools, balanced distractors, method-only hints); lints clean.

- **What a Capacitor Does** (new) — stores charge on two plates separated by a
  dielectric; opposes a sudden change in voltage; holds charge when disconnected;
  passes AC / blocks DC: EAC Vol.1 "Capacitor — How It Works"; PEI §2.23. Verified.
- **Farads and Capacitor Values** (new) — farad is huge; 1 F = 1,000,000 µF,
  1 µF = 1,000 nF = 1,000,000 pF; "104" = 100 nF = 0.1 µF: EAC Vol.1 "Values /
  Farads" ("1F = 1,000,000μF, and 1μF = 1,000,000pF"). Verified.
- **Capacitor Types and Polarity** (new) — ceramic non-polarised, electrolytic
  polarised (negative lead marked, can fail/vent if reversed; poor for AC): ME
  p.1467 ("Ceramic capacitors have no polarity… Electrolytics do have polarity");
  PEI §2.23.2 (negative lead marked; not for AC). Verified.
- **Charging Through a Resistor** (new) — series R limits current so Vc rises
  gradually (fast then slowing), approaching but never quite reaching the supply;
  charged cap blocks steady DC: EAC Vol.1 "The Time Constant"; STG Ch.1 (RC). Verified.
- **The Time Constant** (new) — τ = R × C (ohms × farads = seconds); ~63% per τ;
  ~99% (treated as full) after 5τ: EAC Vol.1 ("the number of seconds… to acquire
  approximately 63% of the difference… five time constants are considered adequate");
  STG Ch.1 ("time constant (τ)"). Arithmetic verified (1 kΩ × 1000 µF = 1 s, etc.).
- **Calculating RC Timing** (new) — rearrange τ = RC for R or C; the µF→farad
  conversion trap; 5τ for full charge: same sources. All worked values verified.
- **Smoothing and Decoupling** (new) — reservoir/smoothing electrolytic fills
  supply dips; 100 nF ceramic decoupling at chip power pins supplies fast bursts;
  pairing big + small covers both timescales: EAC Vol.1 "How To Use It — Bypass /
  Smoothing Capacitor"; standard practice. Verified.
- **Coupling and Blocking DC** (new) — series cap blocks DC, passes AC; reactance
  Xc = 1/(2πfC) falls with frequency and → ∞ at DC: EAC Vol.1 "Coupling Capacitor /
  Capacitive Reactance"; PEI §2.23. Verified.
- **The RC Low-Pass Filter** (new) — R series + C to ground, output across C;
  fc = 1/(2πRC); swap → high-pass: EAC Vol.1 "Low-Pass / High-Pass Filter"; PEI
  Ch.2. fc worked example (1.6 kΩ, 0.1 µF ≈ 1 kHz) verified. Uses the `rc_low_pass`
  DSL diagram.
- **RC Timing in Practice** (new) — RC as delay/debounce/fade; RC vs millis()/delay()
  in code: ME (relay oscillator / time experiments); Exploring Arduino (Blum, code
  timing). Reasoning verified.
- **The 555 Timer** (new) — timer/oscillator chip, astable (free-running) vs
  monostable (one-shot), timing set by external R and C, t ≈ 0.7·R·C per phase:
  ME (Hans Camenzind / 555 oscillator experiment); standard 555 reference. The
  0.7·R·C figure verified (10 kΩ, 100 µF ≈ 0.7 s/phase).
- **Unit 6 Checkpoint** (new) — mixed retrieval over the unit; no new claims.

## Unit 7 — Transistors & Switching

Grounded in **STG** Ch.3 (Kybett & Boysen, the BJT, base/collector/emitter, β),
**EAC Vol.1** (Platt, flyback/freewheeling diode for back-EMF), and **PEI** Ch.4
(Scherz & Monk, transistors and MOSFETs). Authored to the quality bar; lints clean.
Uses the `transistor_switch` DSL diagram (NPN low-side switch + relay coil +
flyback diode).

- **What a Transistor Is** (new) — BJT has base, collector, emitter; a small base
  current controls a large collector current; NPN: collector current flows only
  when base current flows: STG Ch.3 ("when base current flows in a transistor,
  collector current will also flow"). Verified.
- **The Transistor as a Switch** (new) — cutoff (off) vs saturation (fully on); an
  Arduino pin sources only ~20–40 mA so big loads need a transistor: STG Ch.3/4
  (transistor as a switch); Arduino pin limits (Exploring Arduino). Verified.
- **Current Gain (Beta)** (new) — β = Ic/Ib, typical 10–300, datasheet hFE; Ib =
  Ic/β; design for the minimum β: STG Ch.3 ("ratio of collector current to base
  current… called the current gain… β… Typical values of β range from 10 to 300";
  "referred to as hFE"; worked Ib = Ic/β). Verified arithmetic.
- **Sizing the Base Resistor** (new) — base-emitter ~0.7V; Rb = (Vpin − 0.7)/Ib;
  in saturation Ic is set by the load, not β×Ib: STG Ch.3 (base current via the
  base resistor; ~0.7V junction drop); Ohm's law. Worked values verified
  ((5−0.7)/0.0043 ≈ 1 kΩ).
- **Low-Side vs High-Side Switching** (new) — NPN low-side (load to V+, transistor
  to ground); high-side needs PNP/P-MOSFET because an NPN base would sit above the
  supply: standard practice; PEI Ch.4. Verified.
- **Switching Bigger Loads** (new) — power BJT vs MOSFET; on-state drop → heat
  (P = V×I); pick a part with current/voltage headroom: PEI Ch.4; EAC. Verified.
- **Back-EMF from Coils** (new) — an inductor opposes a change in current and kicks
  back a large reverse spike at switch-off, mirror image of a capacitor: EAC Vol.1
  (inductor/back-EMF; "inductive load that generates back-EMF when… switched"). Verified.
- **The Flyback Diode** (new) — rectifier diode across the coil, cathode to +V, so
  it blocks normal current and only conducts the reverse spike; AC needs an RC
  snubber instead: EAC Vol.1 p.961 ("a rectifier diode in parallel with the load
  (with its polarity blocking normal current flow)… flyback diode or freewheeling
  diode… In AC circuits… a snubber"). Verified.
- **Drive the Relay** (new, CAPSTONE) — the council's showcase hard lesson: switch a
  12V/120 mA coil from a 5V/20 mA pin. Ib(min)=120/100=1.2 mA, ~3.5× overdrive →
  4.3 mA, Rb=(5−0.7)/0.0043 ≈ 1 kΩ, flyback diode cathode to +12V; verify the coil
  switches AND the pin current stayed safe: synthesis of STG (β, Rb) + EAC (flyback).
  All numbers verified. Matches CURRICULUM_PLAN §11b "Drive the Relay" spec.
- **MOSFETs vs BJTs** (new) — MOSFET = voltage-controlled gate, ~no steady gate
  current, low on-resistance (I²R heat), logic-level part turns on at 5V; gate/
  drain/source ≈ base/collector/emitter; flyback rule unchanged: PEI Ch.4
  (MOSFETs). Verified.
- **NPN vs PNP** (new) — NPN turns on with base HIGH (low-side); PNP with base LOW
  (high-side); mirror-image supply/current: STG Ch.3 ("difference in using a PNP
  versus an NPN… the polarity of the supply voltage… is reversed"). Verified.
- **Unit 7 Checkpoint** (new) — mixed retrieval over the unit; no new claims.

## Unit 8 — Op-Amps & Signal Conditioning

Grounded in **AoE ch.4** (Horowitz & Hill: the golden rules, inverting/non-inverting
amplifiers, the follower), **PEI ch.8** (Scherz & Monk: op-amp circuits, gain
formulas, single-supply biasing), and **EAC Vol.2** (Platt & Jansson: op-amp,
comparator, hysteresis). Calculation/concept-driven (no new diagram); lints clean.

- **What an Op-Amp Is** (new) — two inputs (− inverting, + non-inverting), one
  output, huge open-loop gain (~100k+), dual supply traditionally: AoE 4.1; PEI 8.
- **The Golden Rules** (new) — (I) with negative feedback the inputs are forced
  equal; (II) the inputs draw no current: AoE 4.1.3 ("The inputs draw no current";
  the output swings so the input difference is ~0). Verified.
- **Negative Feedback** (new) — output fed back to the − input sets a stable gain
  and prevents saturation: PEI 8 ("negative feedback… the gain of an op amp can be
  controlled"). Verified.
- **The Non-Inverting Amplifier** (new) — Av = 1 + Rf/Rg, in phase, min gain 1:
  AoE 4.2 / PEI 8.4.2. All worked gains verified.
- **The Inverting Amplifier** (new) — Av = −Rf/Rin, virtual ground at the − input,
  summing extension: AoE 4.2.1 ("Vout/R2 = −Vin/R1"); PEI 8 ("−RF/Rin"). Verified.
- **The Voltage Follower** (new) — unity gain buffer, high Zin / low Zout, stops a
  high-impedance source sagging under load: AoE 4.2.3; PEI 8. Verified.
- **The Comparator** (new) — compares two inputs, output swings to a rail; op-amp
  open-loop vs dedicated comparator (open-collector needs a pull-up): EAC Vol.2 ch.6
  (Comparator). Verified.
- **Adding Hysteresis** (new) — positive feedback gives two thresholds (a Schmitt
  trigger), killing chatter at the threshold: EAC Vol.2 ch.6 (Hysteresis). Verified.
- **Real Op-Amp Limits** (new) — input offset voltage, input bias current, finite
  slew rate (V/µs), gain-bandwidth tradeoff, output rail limits / rail-to-rail:
  PEI 8 (offset, bias current); AoE 4 (slew rate, GBW). Verified.
- **Single-Supply Op-Amps** (new) — no negative rail, output 0 to Vcc only, bias to
  mid-rail (~Vcc/2) with a buffered divider so AC fits: PEI 8 (single-supply
  operation). Verified.
- **Conditioning a Sensor Signal** (new) — buffer high-Z, amplify weak signals to
  use the ADC range, level-shift, filter; ties back to the LDR/thermistor units:
  synthesis of the above. Worked gains (0.5V→5V = ×10; 40mV→5V ≈ ×125) verified.
- **Unit 8 Checkpoint** (new) — mixed retrieval; no new claims.

## Unit 9 — Filters, Oscillators & Signals

Grounded in **STG ch.7** (Kybett & Boysen: resonance, the 0.707 half-power point,
bandwidth, bandpass/notch), **PEI ch.9-10** (Scherz & Monk: filters, oscillators),
and **AoE** (filters, RMS, decibels). Calculation/concept-driven; reuses the
`rc_low_pass` DSL diagram for the filter lessons. Lints clean.

- **Signals and Waveforms** (new) — sine/square/triangle, period and frequency
  f = 1/T: STG ch.6 (waveforms); standard. Verified.
- **Measuring AC Voltage** (new) — peak, peak-to-peak (Vpp = 2Vp), RMS; sine
  conversions Vrms = Vp/√2, Vp = √2·Vrms; 230V RMS ≈ 325V peak: STG ch.6 ("Vp = √2
  × Vrms … Vpp = 2Vp"). Verified arithmetic.
- **Thinking in Frequencies** (new) — a signal as a sum of frequencies; tone vs
  harmonics vs noise; why filter by frequency: AoE / PEI (frequency domain). Verified.
- **High-Pass and Low-Pass** (new) — RC low-pass (output across C) vs high-pass
  (swap R/C, output across R, blocks DC); coupling cap = high-pass: PEI ch.9; ties
  to Unit 6. Verified. Uses `rc_low_pass`.
- **The Cutoff Frequency** (new) — fc = 1/(2πRC); cutoff = 0.707 = half-power point
  (0.707² = 0.5): STG ch.7 ("0.707, or 70.7 percent … half power points"). Verified
  (1.6kΩ, 0.1µF ≈ 1 kHz).
- **Decibels and Roll-Off** (new) — dB = 20·log10(Vout/Vin); −3dB cutoff, ×10 =
  +20dB, single-pole roll-off −20dB/decade: AoE (decibels, roll-off). Verified.
- **Band-Pass and Notch Filters** (new) — bandpass = HP + LP; notch/band-reject;
  bandwidth BW = f2 − f1: STG ch.7 ("bandpass filter"; "notch filter, or band-reject
  filter"; "bandwidth … f1 from f2"). Verified (300/3000 Hz → 2700 Hz).
- **Resonance and LC Circuits** (new) — inductor stores magnetic energy; LC resonant
  f = 1/(2π√(LC)); tuning a radio; Q/selectivity: STG ch.7 (resonance); PEI. Verified
  (f ∝ 1/√C, so 4× C halves f).
- **What an Oscillator Is** (new) — generates a continuous waveform; amplifier +
  positive feedback: STG ("Oscillator … produces a continuous output signal").
  Verified; ties to the 555 (Unit 6).
- **The Relaxation Oscillator** (new) — RC charge/discharge across thresholds gives
  a square wave; this is the 555 astable: EAC Vol.1 / Make: Electronics (relay/555
  oscillator). Verified (2× R and C → ¼ frequency).
- **Reading a Waveform** (new) — scope: volts (vertical) vs time (horizontal),
  period → frequency, divisions × scale: standard scope practice. Verified arithmetic.
- **Unit 9 Checkpoint** (new) — mixed retrieval; no new claims.

## Unit 10 — Power Supplies & Regulation

Grounded in **STG ch.2 & 11** (Kybett & Boysen: zener diode, rectification),
**EAC Vol.1 ch.17 & 19** (Platt: DC-DC converter, voltage regulator, LDO,
dropout), and **PEI ch.11** (Scherz & Monk: power supplies). Calculation/
concept-driven; lints clean.

- **Why Regulate** (new) — circuits need a steady clean rail; batteries sag,
  supplies are noisy, loads change: EAC Vol.1 ch.19; general. Verified.
- **From AC to DC** (new) — half-wave (one diode), full-wave/bridge (four diodes);
  full-wave ripple at 2× line frequency: STG ch.11 ("half-wave rectifier"; bridge);
  EAC Vol.1 (Bridge Rectifier). Verified.
- **Smoothing the DC** (new) — reservoir/smoothing capacitor fills the gaps,
  leaving ripple; heavier load = more ripple: EAC Vol.1 (Smoothing Capacitor);
  ties to Unit 6. Verified.
- **The Zener Reference** (new) — zener holds Vz in reverse breakdown, needs a
  series resistor R = (Vin − Vz)/I, a few mA; sags under heavy load: STG ch.2 ("zener
  diodes… At the zener voltage, a small current will flow… used to maintain a
  constant voltage"). Verified ((12−5.1)/0.005 ≈ 1.4 kΩ).
- **The Linear Regulator** (new) — 7805 = fixed 5V, 3-pin; dropout voltage (~2V for
  a 7805, so Vin ≥ ~7V); can only drop, never boost: EAC Vol.1 ch.19 ("Low-Dropout
  Linear Regulators"; dropout). Verified.
- **Linear Regulator Heat** (new) — P = (Vin − Vout) × Iout dissipated as heat;
  efficiency ≈ Vout/Vin: EAC Vol.1 ch.19 (heat management); Ohm/power. Verified
  (12→5V at 0.5A = 3.5W; 5/12 ≈ 42%).
- **Switching Regulators** (new) — switch on/off into L+C, 85–95% efficient; buck
  (down), boost (up), buck-boost; noisier: EAC Vol.1 ch.17 (DC-DC converter, buck/
  boost, efficiency, ripple/noise). Verified (90% buck, 10W out from 12V ≈ 0.93A in).
- **Linear vs Switching** (new) — linear: simple, quiet, lossy at big drops;
  switching: efficient, flexible, noisier: EAC Vol.1 ch.17/19. Verified (24→3.3V at
  1.5A ≈ 31W in a linear).
- **A Clean Supply** (new) — bulk caps (slow swings) + decoupling ceramics (fast
  spikes) + low-impedance ground: EAC Vol.1; ties to Unit 6 decoupling. Verified.
- **Unit 10 Checkpoint** (new) — mixed retrieval; no new claims.

## Unit 11 — Digital Logic & Embedded

Advanced, concept/logic-driven (no new circuitDiagram ids; truth tables live in
teach body text). Grounded in EAC Vol.2 (logic gates ch.10, flip-flops ch.11),
Make: More Electronics (Platt), The Art of Electronics (Horowitz & Hill), and
Exploring Arduino (Blum) for the embedded bridge. Lints 0/0.

- **Binary and Hex** (new) — digital counts in base-2 because a wire is cleanly
  HIGH/LOW; binary place values; four bits = one hex digit (0–F); a byte = 256
  values: EAC Vol.2 ch.10 (logic states); Blum (bits). Verified (1010=10, 1100=12,
  0xFF=255, 1023=ten 1s).
- **Logic Levels and Noise Margin** (new) — 5V TTL-style thresholds (LOW ≤ ~0.8V,
  HIGH ≥ ~2V), the forbidden zone, and noise margin as the slack between guaranteed
  outputs and input thresholds: AoE §12.1 (logic threshold, noise immunity); EAC
  Vol.2 ch.10 (74xx input/output levels: low ≤0.8V, high ≥2V). Verified.
- **Analog to Digital and Back** (new) — ADC samples + quantises a voltage; Uno is
  10-bit (0–1023, ties to Unit 5); resolution = 2^n steps; DAC reverses it; ~4.9
  mV/step on 5V/1024: Blum ch.3 (10-bit ADC, 1024 steps, quantisation, 12-bit Due).
  Verified (2.5V≈512, 5/1024≈4.9 mV).
- **The Basic Gates** (new) — AND (all HIGH), OR (any HIGH), NOT (invert), and the
  truth table: EAC Vol.2 ch.10 (gate rules, truth table, positive logic). Verified.
- **NAND, NOR, XOR** (new) — NAND/NOR as AND/OR inverted, XOR = inputs differ,
  NAND/NOR universal (joined-input NAND = NOT): EAC Vol.2 ch.10 (gate rules; 7400
  NAND; XOR for adders). Verified.
- **Combinational Logic** (new) — no memory; the half adder (SUM = XOR, CARRY = AND),
  majority circuit, why a full adder is needed for carry-in: EAC Vol.2 ch.10 (half
  adder / full adder, XOR+AND). Verified (1+1 = sum 0 carry 1).
- **Boolean Rules and De Morgan** (new) — identity/idempotent/double-negation rules
  and De Morgan's two laws (break the bar, flip the operator); NAND = OR of inverted
  inputs: EAC Vol.2 ch.10 (Boolean algebra, bar notation); AoE (Boolean simplification).
  Verified.
- **Flip-Flops and Latches** (new) — flip-flop = smallest unit of memory, Q/NOT-Q;
  cross-coupled NAND/NOR SR latch (Set/Reset/hold, forbidden both-active state); D
  flip-flop captures D on a clock edge, removing the illegal state; latch debounces:
  EAC Vol.2 ch.11 (SR latch from two NANDs/NORs, forbidden states, D-type, "smallest
  possible unit of memory", debounce). Verified.
- **The Clock and Sequential Logic** (new) — clock = steady square wave; sequential =
  memory + clock vs combinational; rising/falling edges; edge- vs level-triggering;
  period = 1/f: EAC Vol.2 ch.11 (synchronous, clock transition); AoE §12 (synchronous,
  noise immunity). Verified (1 kHz = 1 ms; 16 MHz = 62.5 ns).
- **Counters and Registers** (new) — counter increments on each clock, n-bit wraps at
  2^n; register = a row of flip-flops; shift register moves bits serially: EAC Vol.2
  ch.11 (flip-flops in counters/shift registers); MME ch.26 (counters). Verified
  (3-bit max 7; 4-bit 15→0; byte = 8 bits; 256 counts @1 kHz = 256 ms).
- **The 74HC Logic Family** (new) — 74xx series, 74HC = high-speed CMOS default in
  DIP; Vcc/GND; 74HC00 = quad NAND, 74HC08 = quad AND; mandatory 100 nF (0.1 µF)
  decoupling at each chip (callback to Unit 6/10): EAC Vol.2 ch.10 (74HCxx CMOS,
  default HC family, part numbering); MME (74HC chips, decoupling). Verified.
- **GPIO, Timers and Interrupts** (new) — GPIO in/out, pin multiplexing, PWM from an
  on-chip timer (Unit 5 recap); interrupt = respond immediately vs polling that can
  miss a brief event; keep handlers short; debounce bouncy interrupt inputs: Blum
  ch.13 (interrupts vs polling tradeoffs, missing pulses, ISR debounce) + ch.1 (GPIO).
  Verified.
- **Serial Buses: UART, I2C, SPI** (new) — UART async point-to-point (TX/RX, agreed
  baud); I2C two-wire (SDA/SCL) addressed shared bus with pull-ups; SPI synchronous
  master/slave (SCK/MOSI/MISO + chip-select per device), full-duplex, fastest: Blum
  ch.10 (I2C two-wire, addresses, pull-ups), ch.11 (SPI full-duplex, MOSI/MISO/SS,
  comparison to I2C/UART), ch.7 (UART/USART, baud). Verified.
- **Unit 11 Checkpoint** (new) — mixed cumulative retrieval; no new claims.

## Unit 12 — Comms, Motors & Robotics

Advanced, concept/robotics-driven. Reuses `transistor_switch` (inductive load +
flyback diode) for the DC motor drive; H-bridge, servo, and stepper are taught via
teach body text (schematics deferred per §8). Primary source Exploring Arduino
(Blum), with PEI for ultrasonic time-of-flight and EAC Vol.1/Vol.3 for motors and
ranging. Lints 0/0.

- **DC Motors and Drivers** (new) — brushed DC motor (rotor coil pulled by stator
  magnets, brushes flip polarity each half turn); a pin cannot drive it (too much
  current + inductive back-EMF spike), so a transistor switches it with a flyback
  diode (callback to Unit 7); a motor is also a generator; gearbox trades speed for
  torque; stall current spikes when back-EMF disappears: Blum ch.4 (brushed DC,
  inductive load, back-EMF/flyback diode, generator effect, gearbox); EAC Vol.1
  (DC motors, protection diode). Verified.
- **Powering Motors Safely** (new) — separate motor supply sized for stall current;
  common ground between the two supplies; bulk decoupling cap rides out surges; brush
  noise caps; sharing the Arduino 5V rail browns out the regulator (callback to Unit
  10): Blum ch.4 (secondary supply, isolate motor from Arduino, common ground,
  decoupling). Verified.
- **The H-Bridge** (new) — four switches (transistors) around the motor reverse the
  current = direction; four states (open/coast, forward, backward, brake-by-shorting);
  shoot-through (both switches one side) = dead short supply→ground; L293D packs the
  switches + built-in flyback diodes + thermal shutdown: Blum ch.4 (H-bridge operation,
  four states, shoot-through warning, L293D quad half-H, built-in diodes/thermal).
  Verified.
- **PWM Motor Speed Control** (new) — PWM switches the supply fully on/off; duty cycle
  sets average voltage (avg = duty × supply); analogWrite 0–255 (callback to Unit 5);
  PWM efficient vs a series resistor; starting torque > running torque: Blum ch.4 +
  ch.3 (PWM speed control, analogWrite 0–255, duty cycle). Verified (0.5×9=4.5V,
  64/255≈0.25→3V on 12V, ~170/255≈0.67→6V on 9V).
- **Servo Motors** (new) — servo holds a commanded ANGLE (not speed); pulse width sets
  position, refreshed ~every 20 ms; 1 ms ≈ 0°, 1.5 ms ≈ 90°, 2 ms ≈ 180°; Servo
  library generates the timing; servos vary so endpoints need calibration; no pulses →
  goes limp: Blum ch.5 (servo 1/1.5/2 ms pulses, 20 ms refresh, Servo library, angle
  range). Verified against the book figures exactly.
- **Stepper Motors** (new) — brushless; coils/phases energised in sequence pull the
  rotor one fixed, repeatable step; counting steps gives position (open-loop, no
  sensor); steps/rev → degrees/step; strong torque at low speed; missed steps under
  load drift silently: Blum ch.5 (bipolar stepper, phases energised in sequence,
  repeatable step, open-loop velocity-control caveat, NEMA-17); EAC Vol.1 (stepper
  steps/rev). Verified (360/200 = 1.8°/step; 50 steps = 90°; 100 steps = 180°).
- **Distance Sensing** (new) — ultrasonic time-of-flight: distance = (speed_of_sound ×
  echo_time)/2 (divide by 2 for the round trip); ~40 kHz pulse, speed ≈ 340 m/s; IR
  reflectance gives an analog voltage vs distance; speed-of-sound drift with temp,
  soft/angled surfaces scatter: PEI §6.3.2 (ultrasonic, worked example 340 × 0.01 / 2
  = 1.7 m, HC-SR04 µs/58 → cm, temp dependence); Blum ch.3 (Sharp IR distance, analog
  out). Verified (340×0.01/2=1.7 m; 340×0.002/2=0.34 m; 6 ms→1.02 m).
- **Talking to Modules** (new) — robot modules talk over UART/I2C/SPI (callback to
  Unit 11); I2C address picks one device on two shared wires (scales), SPI needs a
  chip-select per device, UART is point-to-point with agreed baud; same-address clash;
  match the bus to the need: Blum ch.10/11 (I2C addressing/pull-ups, SPI chip-select,
  bus comparison). Verified.
- **The Robot Control Loop** (new) — sense → decide → act scaled up (callback to Units
  3/5); ACT drives motors/H-bridge/servo; polling vs interrupts (callback to Unit 11):
  fast/brief events (encoder pulses) need interrupts, slow inputs can poll; blocking
  delay() freezes the loop; reaction time set by loop rate: Blum ch.13 (interrupts vs
  polling, missing brief events, short ISRs) + ch.4/5 (driving actuators). Verified.
- **Closing the Loop with Feedback** (new) — open-loop (command and trust) vs closed-
  loop (measure result, feed back, correct); encoders count actual rotation and beat
  dead reckoning; low battery / slip / load throw open-loop off unnoticed; stepper's
  counted steps approximate feedback, a DC motor needs an encoder: Blum ch.5 (open-loop
  velocity vs position control, "without an encoder you never know absolute position").
  Verified.
- **The Line-Follower** (CAPSTONE, new) — closes the robotics arc per §4: IR reflectance
  sensors (dark line reads low, light floor high) → threshold/calibration → differential
  drive via H-bridge; off-line recovery; over-correction oscillation; proportional steer
  = closed-loop feedback applied: Blum ch.3 (IR thresholds, calibration range), ch.4
  (differential drive via H-bridge), light-controlled car project. Verified (threshold
  ~500 between line 200 / floor 800).
- **Unit 12 Checkpoint** (new) — mixed cumulative retrieval; no new claims.

## Notes for the pipeline

- Every factual claim above traces to a source; this is the manual version of the
  per-step `sources[]` citation the automated pipeline will enforce
  (CURRICULUM_PLAN §8).
- Lessons that would be materially stronger with a **real photo** (flagged for the
  illustration backlog): *Reading Resistor Color Codes* (banded resistor), and any
  future component-identification lessons.
- New exercise types introduced with this unit: `predict_reading`,
  `predict_behavior`, `choose_resistor` (the predict → commit → reveal family).
