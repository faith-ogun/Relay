// ── Interactive lesson system (Duolingo-style) ──

export type LessonStepTeach = { type: 'teach'; title: string; body: string; diagram?: string; circuitDiagram?: string; showCurrentFlow?: boolean };
export type LessonStepMC = { type: 'multiple_choice'; question: string; options: string[]; correct: number; explanation: string; circuitDiagram?: string };
export type LessonStepTF = { type: 'true_false'; statement: string; correct: boolean; explanation: string; circuitDiagram?: string };
export type LessonStepFill = { type: 'fill_blank'; prompt: string; blank: string; answer: string; hint: string; circuitDiagram?: string };
export type LessonStepMatch = { type: 'match'; instruction: string; pairs: Array<[string, string]> };
export type LessonStepSpotError = { type: 'spot_error'; question: string; circuitDiagram: string; correctRegion: string; explanation: string };
export type LessonStepIdentify = { type: 'identify_component'; question: string; circuitDiagram: string; correctComponent: string; explanation: string };
export type LessonStepDraw = { type: 'draw_connection'; instruction: string; terminals: Array<{ x: number; y: number; label: string; id: string }>; expectedConnections: Array<[string, string]>; explanation: string };
export type LessonStepDragOrder = { type: 'drag_order'; instruction: string; items: string[]; correctOrder: number[] };
// Prediction family: the learner commits to a prediction, then the circuit reveals the truth.
// This is the highest-value pattern for killing misconceptions (predict → commit → reveal).
export type LessonStepPredictReading = { type: 'predict_reading'; question: string; circuitDiagram?: string; options: string[]; correct: number; explanation: string };
export type LessonStepPredictBehavior = { type: 'predict_behavior'; question: string; circuitDiagram?: string; options: string[]; correct: number; explanation: string };
export type LessonStepChooseResistor = { type: 'choose_resistor'; question: string; circuitDiagram?: string; options: string[]; correct: number; explanation: string };
export type LessonStep = LessonStepTeach | LessonStepMC | LessonStepTF | LessonStepFill | LessonStepMatch | LessonStepSpotError | LessonStepIdentify | LessonStepDraw | LessonStepDragOrder | LessonStepPredictReading | LessonStepPredictBehavior | LessonStepChooseResistor;

export const LESSON_CONTENT: Record<string, { steps: LessonStep[]; xpReward: number }> = {
  'Voltage Basics': {
    xpReward: 20,
    steps: [
      { type: 'teach', title: 'What is Voltage?', body: 'Voltage is the electrical pressure that pushes electrons through a circuit. Think of it like water pressure in a pipe. Higher voltage means more push.', circuitDiagram: 'series_circuit', showCurrentFlow: true },
      { type: 'multiple_choice', question: 'What unit is voltage measured in?', options: ['Amps (A)', 'Volts (V)', 'Ohms (Ω)', 'Watts (W)'], correct: 1, explanation: 'Voltage is measured in Volts (V), named after Alessandro Volta.' },
      { type: 'teach', title: 'DC vs AC', body: 'Arduino uses DC (direct current): electrons flow in one direction. Your wall outlet uses AC (alternating current). A USB cable converts AC to the 5V DC your Arduino needs.' },
      { type: 'true_false', statement: 'An Arduino Uno operates on AC power directly from the wall.', correct: false, explanation: 'Arduino uses DC power. It receives 5V DC through USB or a voltage regulator.' },
      { type: 'teach', title: 'Voltage Dividers', body: 'Two resistors in series split the input voltage. The LDR circuit uses this: an LDR + fixed resistor divide 5V, and Arduino reads the midpoint.\n\nFormula: Vout = Vin × R2 / (R1 + R2)', circuitDiagram: 'voltage_divider' },
      { type: 'identify_component', question: 'Click on the component that reads the voltage midpoint', circuitDiagram: 'voltage_divider', correctComponent: 'a0', explanation: 'Arduino pin A0 reads the analog voltage at the midpoint of the voltage divider.' },
      { type: 'fill_blank', prompt: 'In a voltage divider with Vin = 5V, R1 = 10kΩ, R2 = 10kΩ, Vout = ___ V', blank: '___', answer: '2.5', hint: 'Equal resistors split the voltage in half.', circuitDiagram: 'voltage_divider' },
      { type: 'multiple_choice', question: 'What happens to Vout in a voltage divider if R2 increases?', options: ['Vout decreases', 'Vout increases', 'Vout stays the same', 'The circuit breaks'], correct: 1, explanation: 'As R2 gets larger relative to R1, it gets a bigger share of the voltage: Vout = Vin × R2/(R1+R2).', circuitDiagram: 'voltage_divider' },
      { type: 'true_false', statement: 'You can measure voltage at a single point in a circuit.', correct: false, explanation: 'Voltage is always a difference between two points. You need a reference (usually ground).' },
      { type: 'match', instruction: 'Match each term to its definition.', pairs: [['Voltage', 'Electrical pressure (measured in V)'], ['Current', 'Flow of electrons (measured in A)'], ['Resistance', 'Opposition to flow (measured in Ω)'], ['Ground', 'Reference point at 0V'], ['Battery', 'Provides the voltage that drives current']] },
    ],
  },
  'Current Flow Intuition': {
    xpReward: 25,
    steps: [
      { type: 'teach', title: 'What is Current?', body: 'Current is the flow of electrons through a conductor, measured in amps (A). In Arduino projects you\'ll deal with milliamps (mA). A typical LED draws about 20mA.', circuitDiagram: 'series_circuit', showCurrentFlow: true },
      { type: 'multiple_choice', question: 'How much current can a single Arduino Uno pin safely supply?', options: ['5mA', '20mA', '40mA', '500mA'], correct: 2, explanation: 'Each Arduino digital pin can source up to 40mA. Drawing more risks damage to the microcontroller.' },
      { type: 'teach', title: 'Series vs Parallel', body: 'In a series circuit, current takes one path: the same current flows through every component.\n\nIn a parallel circuit, current splits between branches. More branches = more total current drawn from the supply.', circuitDiagram: 'series_circuit', showCurrentFlow: true },
      { type: 'identify_component', question: 'In this series circuit, click on the component that limits current to protect the LED', circuitDiagram: 'series_circuit', correctComponent: 'resistor', explanation: 'The resistor limits current flow through the LED, preventing it from burning out.' },
      { type: 'teach', title: 'Parallel Circuits', body: 'In parallel, each branch gets the full supply voltage. Current splits: I_total = I₁ + I₂.\n\nMore branches = more total current. This is why adding too many LEDs in parallel can overdraw your power supply.', circuitDiagram: 'parallel_circuit', showCurrentFlow: true },
      { type: 'true_false', statement: 'In a series circuit, the current through each component is different.', correct: false, explanation: 'In series, current is the SAME everywhere. There\'s only one path for electrons to flow.', circuitDiagram: 'series_circuit' },
      { type: 'teach', title: 'Ohm\'s Law', body: 'V = I × R\n\nKnow any two → calculate the third.\nExample: 5V supply, 220Ω resistor, LED (2V drop):\nI = (5 - 2) / 220 = 13.6mA ✓ safe for LEDs' },
      { type: 'fill_blank', prompt: 'Using Ohm\'s Law: a 330Ω resistor with 3.3V across it draws ___ mA', blank: '___', answer: '10', hint: 'I = V/R = 3.3/330 = 0.01A = ?mA' },
      { type: 'spot_error', question: 'This LED circuit is missing something critical. Click on the problem area.', circuitDiagram: 'led_no_resistor', correctRegion: 'missing_resistor', explanation: 'Without a current-limiting resistor, too much current flows through the LED. It will burn out instantly!' },
      { type: 'multiple_choice', question: 'Why do you need a resistor with an LED?', options: ['To make the LED brighter', 'To limit current and prevent burnout', 'To increase voltage across the LED', 'LEDs don\'t actually need resistors'], correct: 1, explanation: 'Without a current-limiting resistor, too much current flows through the LED, destroying it almost instantly.' },
      { type: 'match', instruction: 'Match the circuit type to its current behavior.', pairs: [['Series circuit', 'Same current everywhere'], ['Parallel circuit', 'Current splits between branches'], ['Short circuit', 'Dangerously high current'], ['Open circuit', 'Zero current flow'], ['Conventional current', 'Flows from + to −']] },
    ],
  },
  'Breadboard Confidence Drill': {
    xpReward: 25,
    steps: [
      { type: 'teach', title: 'How a Breadboard Works', body: 'Internal metal strips connect holes in patterns:\n\n• Each row of 5 holes (a-e) is connected\n• Each row of 5 holes (f-j) is connected\n• The two long edge rails are power (+ and −)\n\nThe center gap keeps the two halves separate.', circuitDiagram: 'breadboard_layout' },
      { type: 'multiple_choice', question: 'On a breadboard, holes a1-e1 are...', options: ['All independent', 'Connected horizontally', 'Connected to f1-j1', 'Connected to the power rail'], correct: 1, explanation: 'Holes a through e in the same row are connected by an internal metal strip. f through j are a separate connected group.', circuitDiagram: 'breadboard_layout' },
      { type: 'true_false', statement: 'Holes e5 and f5 on a standard breadboard are electrically connected.', correct: false, explanation: 'The center gap breaks the connection. e5 connects to a5-d5. f5 connects to g5-j5. They\'re separate.', circuitDiagram: 'breadboard_layout' },
      { type: 'draw_connection', instruction: 'Wire up a simple LED circuit! Connect the power to the resistor, then the resistor to the LED, then the LED to ground.', terminals: [{ x: 60, y: 50, label: '5V', id: 'power' }, { x: 160, y: 50, label: 'R', id: 'resistor_in' }, { x: 240, y: 50, label: 'R', id: 'resistor_out' }, { x: 320, y: 50, label: 'LED', id: 'led' }, { x: 320, y: 200, label: 'GND', id: 'ground' }], expectedConnections: [['power', 'resistor_in'], ['resistor_out', 'led'], ['led', 'ground']], explanation: 'Power → Resistor → LED → Ground. The resistor must come before the LED to limit current.' },
      { type: 'multiple_choice', question: 'What is the #1 breadboard wiring mistake?', options: ['Using wrong wire colors', 'Both component legs in the same row', 'Wires too long', 'Not using the power rails'], correct: 1, explanation: 'Placing both legs of a component in the same row short-circuits it, since all holes in a row are connected.' },
      { type: 'drag_order', instruction: 'Put these steps in the correct order for building a circuit on a breadboard:', items: ['Connect power rail to Arduino 5V', 'Place components spanning different rows', 'Connect ground rail to Arduino GND', 'Add jumper wires between components', 'Test with a multimeter before powering on'], correctOrder: [0, 2, 1, 3, 4] },
      { type: 'match', instruction: 'Match the breadboard zone to its function.', pairs: [['Rows a-e', 'Connected group (top half)'], ['Rows f-j', 'Connected group (bottom half)'], ['Side rail (+)', 'Positive voltage bus'], ['Side rail (−)', 'Ground bus'], ['Center gap', 'Separates the two halves']] },
      { type: 'fill_blank', prompt: 'To connect an LED, place the anode in row 10 and cathode in row ___ (a different row).', blank: '___', answer: '11', hint: 'Any different row number works. The key is they must be different rows.' },
    ],
  },
  'Sensor Signal Sanity Checks': {
    xpReward: 30,
    steps: [
      { type: 'teach', title: 'The LDR Alarm Circuit', body: 'This is the full Light-Activated Alarm circuit. The LDR and 10kΩ resistor form a voltage divider. Arduino reads the midpoint on A0 and triggers the LED on D9 when light drops.', circuitDiagram: 'ldr_alarm' },
      { type: 'identify_component', question: 'Click on the component that changes resistance based on light', circuitDiagram: 'ldr_alarm', correctComponent: 'ldr', explanation: 'The LDR (Light Dependent Resistor) decreases resistance in bright light and increases resistance in darkness.' },
      { type: 'teach', title: 'Analog vs Digital', body: 'Digital = HIGH (5V) or LOW (0V), just two states.\nAnalog = continuous range. An LDR outputs 0V to 5V.\n\nArduino reads analog on pins A0-A5, returning 0 to 1023.' },
      { type: 'fill_blank', prompt: 'Arduino\'s analogRead() returns values from 0 to ___', blank: '___', answer: '1023', hint: 'Arduino has a 10-bit ADC: 2^10 - 1 = ?' },
      { type: 'spot_error', question: 'This LED is connected wrong. Can you spot the error?', circuitDiagram: 'reversed_led', correctRegion: 'reversed_led', explanation: 'The LED is reversed! The anode (triangle) must point toward the ground side. Current only flows one way through an LED.' },
      { type: 'multiple_choice', question: 'An LDR reading stuck at 1023 most likely means...', options: ['Maximum brightness', 'The sensor is working perfectly', 'A wiring error (pin shorted to 5V)', 'The Arduino is broken'], correct: 2, explanation: 'A reading stuck at the max (1023) usually means the analog pin is directly connected to 5V, likely a short circuit or missing resistor.', circuitDiagram: 'voltage_divider' },
      { type: 'true_false', statement: 'A temperature reading of -40°C from an indoor sensor is probably correct.', correct: false, explanation: 'This is physically implausible indoors. It likely means a wiring error, floating pin, or faulty sensor.' },
      { type: 'spot_error', question: 'There is a dangerous problem in this circuit. Find it!', circuitDiagram: 'short_circuit', correctRegion: 'short_wire', explanation: 'A wire is bypassing the resistor and LED, creating a short circuit. This draws maximum current and could damage the battery or start a fire.' },
      { type: 'draw_connection', instruction: 'Wire up the LDR voltage divider: connect 5V to the LDR, LDR to the junction, junction to the resistor, and resistor to ground. Also connect the junction to A0.', terminals: [{ x: 60, y: 40, label: '5V', id: 'vcc' }, { x: 180, y: 40, label: 'LDR', id: 'ldr' }, { x: 300, y: 40, label: 'A0', id: 'a0' }, { x: 180, y: 140, label: '10kΩ', id: 'res' }, { x: 180, y: 240, label: 'GND', id: 'gnd' }], expectedConnections: [['vcc', 'ldr'], ['ldr', 'a0'], ['ldr', 'res'], ['res', 'gnd']], explanation: '5V → LDR → junction → 10kΩ → GND, with junction also connected to A0. This forms the voltage divider that Arduino reads.' },
      { type: 'multiple_choice', question: 'What baud rate should you use with Serial.begin() for basic debugging?', options: ['1200', '4800', '9600', '115200'], correct: 2, explanation: '9600 is the standard default baud rate for Serial Monitor debugging. It\'s fast enough for most sensor readings.' },
      { type: 'match', instruction: 'Match the sensor issue to its likely cause.', pairs: [['Reading stuck at 0', 'Pin not connected (floating)'], ['Reading stuck at 1023', 'Pin shorted to 5V'], ['Wildly jumping values', 'Loose connection or noise'], ['Slowly drifting values', 'Normal sensor behavior']] },
    ],
  },
  'Resistors and Ohm\'s Law': {
    xpReward: 25,
    steps: [
      { type: 'teach', title: 'What a Resistor Does', body: 'A resistor pushes back against current. It turns electrical energy into a little heat and, in doing so, limits how much current flows. Every LED, sensor, and microcontroller pin relies on resistors to keep current in a safe range.', circuitDiagram: 'series_circuit', showCurrentFlow: true },
      { type: 'multiple_choice', question: 'What unit is resistance measured in?', options: ['Volts (V)', 'Amps (A)', 'Ohms (Ω)', 'Farads (F)'], correct: 2, explanation: 'Resistance is measured in ohms (Ω), named after Georg Ohm.' },
      { type: 'teach', title: 'Ohm\'s Law', body: 'The single most useful equation in electronics:\n\nV = I × R\n\nVoltage equals current times resistance. Rearranged: I = V / R, and R = V / I. Know any two and you can find the third.' },
      { type: 'fill_blank', prompt: 'A 1kΩ (1000Ω) resistor with 5V across it. Current = V / R = 5 / 1000 = ___ mA', blank: '___', answer: '5', hint: '5 / 1000 = 0.005 A. Convert amps to milliamps by multiplying by 1000.' },
      { type: 'multiple_choice', question: 'To reduce the current in a circuit, you should...', options: ['Add more resistance', 'Remove resistance', 'Add more LEDs', 'Increase the voltage'], correct: 0, explanation: 'More resistance means less current for the same voltage: I = V / R.' },
      { type: 'identify_component', question: 'Click the component that limits the current in this circuit.', circuitDiagram: 'series_circuit', correctComponent: 'resistor', explanation: 'The resistor limits current to protect the LED.' },
      { type: 'true_false', statement: 'For a fixed voltage, increasing resistance decreases the current.', correct: true, explanation: 'Correct. I = V / R, so a bigger R gives a smaller I.' },
      { type: 'match', instruction: 'Match each quantity to its unit.', pairs: [['Voltage', 'Volts (V)'], ['Current', 'Amps (A)'], ['Resistance', 'Ohms (Ω)'], ['Power', 'Watts (W)'], ['Charge', 'Coulombs (C)']] },
    ],
  },
  'LEDs and Polarity': {
    xpReward: 25,
    steps: [
      { type: 'teach', title: 'LEDs Only Flow One Way', body: 'An LED (Light Emitting Diode) is a one-way valve for current. It lights up only when current flows from its anode (+) to its cathode (−). Wire it backwards and nothing happens.', circuitDiagram: 'series_circuit' },
      { type: 'multiple_choice', question: 'On a typical through-hole LED, which leg is the anode (positive)?', options: ['The shorter leg', 'The longer leg', 'They are interchangeable', 'The one nearest the flat edge'], correct: 1, explanation: 'The longer leg is the anode (+). The shorter leg, next to the flat side of the rim, is the cathode (−).' },
      { type: 'teach', title: 'Never a Bare LED', body: 'An LED barely resists current on its own, so connecting it straight across a supply lets a huge current rush through and burns it out instantly. A series resistor sets a safe current.', circuitDiagram: 'led_no_resistor' },
      { type: 'spot_error', question: 'This LED is about to burn out. Click the problem.', circuitDiagram: 'led_no_resistor', correctRegion: 'missing_resistor', explanation: 'There is no current-limiting resistor, so far too much current flows through the LED.' },
      { type: 'multiple_choice', question: 'Why does an LED need a series resistor?', options: ['To make it brighter', 'To limit current and prevent burnout', 'To raise the voltage', 'LEDs do not need one'], correct: 1, explanation: 'The resistor limits current to a safe level, usually around 10 to 20 mA for a standard LED.' },
      { type: 'identify_component', question: 'Click the LED in this circuit.', circuitDiagram: 'series_circuit', correctComponent: 'led', explanation: 'That triangle-and-bar symbol is the LED. The triangle points from anode to cathode, the direction current flows.' },
      { type: 'spot_error', question: 'This LED will not light. Click what is wrong.', circuitDiagram: 'reversed_led', correctRegion: 'reversed_led', explanation: 'The LED is reversed. Current can only flow from anode to cathode, so flip it around.' },
      { type: 'true_false', statement: 'An LED lights up the same no matter which way you connect it.', correct: false, explanation: 'False. An LED only conducts in one direction. Backwards, it stays dark.' },
    ],
  },
  'Series vs Parallel': {
    xpReward: 25,
    steps: [
      { type: 'teach', title: 'Series: One Path', body: 'In a series circuit there is a single loop, so the same current flows through every component. Add components in series and they all share that one path.', circuitDiagram: 'series_circuit', showCurrentFlow: true },
      { type: 'true_false', statement: 'In a series circuit, the current is the same through every component.', correct: true, explanation: 'Correct. One path means one current, equal everywhere in the loop.' },
      { type: 'teach', title: 'Parallel: Branches', body: 'In a parallel circuit, current splits between branches. Each branch sees the full supply voltage, and the total current is the sum of the branch currents.', circuitDiagram: 'parallel_circuit', showCurrentFlow: true },
      { type: 'multiple_choice', question: 'In a parallel circuit, each branch gets...', options: ['A share of the voltage', 'The full supply voltage', 'No voltage', 'Half the current'], correct: 1, explanation: 'Branches in parallel each see the full supply voltage. It is the current that splits, not the voltage.' },
      { type: 'identify_component', question: 'Click one of the resistors in this parallel circuit.', circuitDiagram: 'parallel_circuit', correctComponent: 'r1', explanation: 'Each branch has its own resistor. In parallel, you generally give every LED its own resistor.' },
      { type: 'fill_blank', prompt: 'Two 10kΩ resistors connected in series add up to ___ kΩ', blank: '___', answer: '20', hint: 'Series resistances simply add: 10 + 10.' },
      { type: 'multiple_choice', question: 'You want three LEDs at the same brightness from one 5V supply. Best approach?', options: ['One resistor for all three in parallel', 'Each LED in its own branch with its own resistor', 'All three LEDs in series with no resistor', 'Connect them straight to 5V'], correct: 1, explanation: 'Give each parallel LED its own resistor so they share current evenly and stay at matched brightness.' },
      { type: 'match', instruction: 'Match each idea to the circuit it describes.', pairs: [['Same current everywhere', 'Series'], ['Current splits between branches', 'Parallel'], ['Resistors add: R1 + R2', 'Series'], ['Every branch sees full voltage', 'Parallel'], ['One break stops everything', 'Series']] },
    ],
  },
  'Short Circuits and Safety': {
    xpReward: 25,
    steps: [
      { type: 'teach', title: 'What a Short Circuit Is', body: 'A short circuit is a low-resistance path that lets current bypass the components and rush straight back to the source. With almost no resistance, the current spikes, things get hot fast, and parts (or batteries) can be damaged.', circuitDiagram: 'short_circuit' },
      { type: 'spot_error', question: 'There is a dangerous fault here. Click it.', circuitDiagram: 'short_circuit', correctRegion: 'short_wire', explanation: 'A wire bypasses the load, creating a short. Current shoots up with nothing to limit it.' },
      { type: 'multiple_choice', question: 'What happens during a short circuit?', options: ['Current drops to zero', 'Current spikes very high', 'Voltage doubles', 'Nothing, it is safe'], correct: 1, explanation: 'With almost no resistance, Ohm\'s law (I = V / R) gives a very large current, which causes overheating.' },
      { type: 'true_false', statement: 'Connecting a wire directly across the two battery terminals is safe.', correct: false, explanation: 'No. That is a short across the source: huge current, heat, and a possibly ruined battery.' },
      { type: 'teach', title: 'Staying Safe', body: 'Three habits prevent most shorts:\n\n1. Always have a load (like a resistor) in the path.\n2. Double-check wiring before connecting power.\n3. If something gets hot or smells, disconnect power immediately.' },
      { type: 'spot_error', question: 'This circuit overdraws current. Click the issue.', circuitDiagram: 'led_no_resistor', correctRegion: 'missing_resistor', explanation: 'With no resistor, the LED path draws far too much current, much like a short.' },
      { type: 'match', instruction: 'Match the symptom to its likely cause.', pairs: [['Wire gets hot fast', 'Short circuit'], ['Battery drains quickly', 'Excessive current draw'], ['Nothing happens at all', 'Open circuit (broken loop)'], ['LED burns out instantly', 'Missing current-limiting resistor']] },
    ],
  },
  'The Voltage Divider': {
    xpReward: 30,
    steps: [
      { type: 'teach', title: 'Splitting a Voltage', body: 'Two resistors in series split the supply voltage between them. The voltage at their midpoint is:\n\nVout = Vin × R2 / (R1 + R2)\n\nThis "voltage divider" is everywhere, and it is how most analog sensors connect to a microcontroller.', circuitDiagram: 'voltage_divider' },
      { type: 'fill_blank', prompt: 'Vin = 9V, with two equal resistors. The midpoint voltage Vout = ___ V', blank: '___', answer: '4.5', hint: 'Equal resistors split the voltage in half.' },
      { type: 'multiple_choice', question: 'In a divider, if R2 gets larger relative to R1, the midpoint voltage Vout...', options: ['Decreases', 'Increases', 'Stays the same', 'Drops to zero'], correct: 1, explanation: 'A larger R2 takes a bigger share of the voltage: Vout = Vin × R2 / (R1 + R2).' },
      { type: 'identify_component', question: 'Click where the microcontroller reads the divider\'s midpoint voltage.', circuitDiagram: 'voltage_divider', correctComponent: 'a0', explanation: 'Analog pin A0 reads the voltage at the midpoint of the divider.' },
      { type: 'teach', title: 'Make It a Sensor', body: 'Swap one fixed resistor for a component whose resistance changes with the world, like an LDR (its resistance drops in bright light), and the midpoint voltage now tracks that change. Read it on an analog pin and you have a light sensor.', circuitDiagram: 'ldr_alarm' },
      { type: 'identify_component', question: 'Click the component whose resistance changes with light.', circuitDiagram: 'ldr_alarm', correctComponent: 'ldr', explanation: 'The LDR (light-dependent resistor) changes resistance with light, which moves the divider\'s output voltage.' },
      { type: 'true_false', statement: 'An LDR\'s resistance increases as it gets darker.', correct: true, explanation: 'Correct. Less light means higher LDR resistance, which shifts the divider output.' },
      { type: 'match', instruction: 'Match each part of the divider to its role.', pairs: [['Vin', 'The supply voltage in'], ['Midpoint', 'The output Vout the pin reads'], ['LDR', 'Resistance that changes with light'], ['Fixed resistor', 'Sets the divider\'s baseline']] },
    ],
  },

  // ── Unit 1 foundations: new lessons (grounded in the source books, see CURRICULUM_CITATIONS.md) ──

  'The Closed Loop': {
    xpReward: 20,
    steps: [
      { type: 'teach', title: 'A Circuit Is a Loop', body: 'Current can only flow around a complete, unbroken loop, from one terminal of the source, through your components, and back to the other terminal. Break the loop anywhere and the current stops everywhere. This single idea sits under every circuit you will ever build.', circuitDiagram: 'series_circuit', showCurrentFlow: true },
      { type: 'multiple_choice', question: 'What does current need in order to flow?', options: ['A single wire to nowhere', 'A complete, unbroken loop', 'Only a battery', 'Only a resistor'], correct: 1, explanation: 'Current needs a complete loop back to the source. A path that does not return is a dead end, and nothing flows.' },
      { type: 'true_false', statement: 'If there is a break anywhere in the loop, current still flows in the rest of it.', correct: false, explanation: 'No. One break stops the current everywhere in a single loop, the same way a missing section of track stops the whole train.' },
      { type: 'teach', title: 'Open vs Closed', body: 'A switch is just a controlled break in the loop.\n\n• Closed switch = complete loop = current flows.\n• Open switch = broken loop = no current.\n\nThat is all a light switch does: it opens and closes the loop.' },
      { type: 'identify_component', question: 'Click the source that pushes current around this loop.', circuitDiagram: 'series_circuit', correctComponent: 'battery', explanation: 'The battery is the source. It provides the potential difference that drives current around the complete loop.' },
      { type: 'predict_behavior', question: 'You snip one wire in this working loop. What happens to the LED?', circuitDiagram: 'series_circuit', options: ['It gets brighter', 'It goes out', 'Nothing changes', 'It changes colour'], correct: 1, explanation: 'Snipping any wire breaks the loop, so current stops everywhere and the LED goes out.' },
      { type: 'match', instruction: 'Match each term to what it means for the loop.', pairs: [['Closed circuit', 'Complete loop, current flows'], ['Open circuit', 'Broken loop, no current'], ['Switch', 'A controlled break in the loop'], ['Source', 'Pushes current around the loop'], ['Short circuit', 'Loop with no load, huge current']] },
    ],
  },

  'Conductors and Insulators': {
    xpReward: 20,
    steps: [
      { type: 'teach', title: 'What Lets Current Through', body: 'A conductor lets charge move through it easily. Metals like copper are excellent conductors, which is why wires are made of copper. An insulator resists the flow of charge: plastic, rubber, glass, and air.' },
      { type: 'multiple_choice', question: 'Which of these is a good conductor?', options: ['Rubber', 'Copper', 'Glass', 'Plastic'], correct: 1, explanation: 'Copper is an excellent conductor and the standard material for wires.' },
      { type: 'true_false', statement: 'The plastic coating around a wire is there to conduct electricity.', correct: false, explanation: 'The opposite. The plastic is an insulator. It stops the current escaping and stops wires shorting against each other.' },
      { type: 'multiple_choice', question: 'Silver actually conducts slightly better than copper. Why are wires usually copper, not silver?', options: ['Silver is a poor conductor', 'Silver is far more expensive', 'Silver does not conduct at all', 'Copper is a better conductor'], correct: 1, explanation: 'Silver is a touch better, but far too expensive for everyday wiring, so copper is the practical choice.' },
      { type: 'multiple_choice', question: 'Why does a circuit need insulators as well as conductors?', options: ['To make it heavier', 'To guide current where you want it and stop it where you do not', 'Insulators make current flow faster', 'They are only decorative'], correct: 1, explanation: 'Conductors carry current along the intended path; insulators keep it from leaking or shorting elsewhere. You need both.' },
      { type: 'match', instruction: 'Sort each material into conductor or insulator.', pairs: [['Copper', 'Conductor'], ['Rubber', 'Insulator'], ['Silver', 'Conductor'], ['Glass', 'Insulator'], ['Aluminium', 'Conductor']] },
    ],
  },

  'What Resistance Is': {
    xpReward: 20,
    steps: [
      { type: 'teach', title: 'Resistance Opposes Current', body: 'Resistance is how strongly a component pushes back against current. It is measured in ohms (Ω). More resistance means less current flows for the same voltage. A resistor is a component made to provide a specific, reliable amount of resistance.', circuitDiagram: 'series_circuit' },
      { type: 'multiple_choice', question: 'What unit is resistance measured in?', options: ['Volts (V)', 'Amps (A)', 'Ohms (Ω)', 'Watts (W)'], correct: 2, explanation: 'Resistance is measured in ohms, written with the Greek letter omega (Ω).' },
      { type: 'true_false', statement: 'For a fixed voltage, more resistance means more current.', correct: false, explanation: 'Backwards. More resistance means LESS current. They pull in opposite directions: I = V / R.' },
      { type: 'teach', title: 'The Water Picture', body: 'Picture water in a pipe. Voltage is the pressure pushing the water, current is the flow rate, and resistance is a narrow section that restricts the flow. Squeeze the pipe (more resistance) and less water flows. It is a helpful picture, just remember real circuits need a complete loop, unlike an open hose.' },
      { type: 'identify_component', question: 'Click the component whose job is to provide resistance.', circuitDiagram: 'series_circuit', correctComponent: 'resistor', explanation: 'The resistor (the zig-zag symbol) provides a fixed resistance that limits the current in the loop.' },
      { type: 'predict_reading', question: 'A 5V supply pushes current through a 1000Ω resistor. Using I = V / R, predict the current.', circuitDiagram: 'series_circuit', options: ['0.5 mA', '5 mA', '50 mA', '500 mA'], correct: 1, explanation: 'I = V / R = 5 / 1000 = 0.005 A = 5 mA. Bigger resistance, smaller current.' },
      { type: 'match', instruction: 'Match each term to what it means.', pairs: [['Voltage', 'The push (pressure)'], ['Current', 'The flow rate'], ['Resistance', 'Opposition to the flow'], ['Ohm (Ω)', 'The unit of resistance'], ['Resistor', 'Part that adds resistance']] },
    ],
  },

  'Reading Resistor Color Codes': {
    xpReward: 25,
    steps: [
      { type: 'teach', title: 'Why the Stripes?', body: 'Resistors are too small to print a number on, so their value is shown with coloured bands. The common scheme uses four bands: the first two are digits, the third is a multiplier (how many zeros to add), and the fourth is the tolerance (how precise it is).' },
      { type: 'teach', title: 'The Colour Numbers', body: 'Each colour is a digit:\n\nBlack 0, Brown 1, Red 2, Orange 3, Yellow 4, Green 5, Blue 6, Violet 7, Grey 8, White 9.\n\nThe third band uses the same colours as a multiplier: Brown means ×10, Red ×100, Orange ×1000, and so on.' },
      { type: 'multiple_choice', question: 'A resistor reads Brown, Black, Red. What is its value?', options: ['10 Ω', '100 Ω', '1,000 Ω (1 kΩ)', '10,000 Ω'], correct: 2, explanation: 'Brown=1, Black=0, so the digits are "10". Red multiplier = ×100. 10 × 100 = 1,000 Ω, or 1 kΩ.' },
      { type: 'fill_blank', prompt: 'Red, Red, Brown. Digits 2 and 2 give 22, and Brown means ×10. The value is ___ Ω', blank: '___', answer: '220', hint: '22 × 10 = ?' },
      { type: 'multiple_choice', question: 'A resistor has only three coloured bands and no fourth band. What is its tolerance?', options: ['1%', '5%', '10%', '20%'], correct: 3, explanation: 'No fourth (tolerance) band means 20%, the loosest standard tolerance.' },
      { type: 'predict_reading', question: 'Yellow, Violet, Orange. Predict the value.', options: ['47 Ω', '470 Ω', '4.7 kΩ', '47 kΩ'], correct: 3, explanation: 'Yellow=4, Violet=7 give "47". Orange multiplier = ×1000. 47 × 1000 = 47,000 Ω = 47 kΩ.' },
      { type: 'match', instruction: 'Match each colour to its digit.', pairs: [['Black', '0'], ['Brown', '1'], ['Red', '2'], ['Orange', '3'], ['Yellow', '4']] },
    ],
  },

  'Power and Heat': {
    xpReward: 25,
    steps: [
      { type: 'teach', title: 'Power Is Energy Per Second', body: 'Power is how fast a component uses electrical energy, measured in watts (W). The formula is:\n\nP = V × I\n\nPower equals voltage times current. A component with more voltage across it, or more current through it, uses more power.' },
      { type: 'multiple_choice', question: 'What unit is power measured in?', options: ['Ohms (Ω)', 'Volts (V)', 'Watts (W)', 'Amps (A)'], correct: 2, explanation: 'Power is measured in watts (W).' },
      { type: 'predict_reading', question: 'A component has 5V across it and 0.1A flowing through it. Using P = V × I, predict the power.', circuitDiagram: 'series_circuit', options: ['0.05 W', '0.5 W', '5 W', '50 W'], correct: 1, explanation: 'P = V × I = 5 × 0.1 = 0.5 W.' },
      { type: 'fill_blank', prompt: 'A resistor has 9V across it and 0.5A through it. P = V × I = ___ W', blank: '___', answer: '4.5', hint: '9 × 0.5 = ?' },
      { type: 'teach', title: 'Where the Power Goes', body: 'A resistor turns the electrical power it uses into heat. That is why resistors have a power rating (like 1/4 watt). Push more power through one than it is rated for and it overheats, discolours, and can fail.' },
      { type: 'true_false', statement: 'A resistor dissipates the power it uses as heat.', correct: true, explanation: 'Yes. That warmth is the electrical energy being converted to heat, which is why power ratings matter.' },
      { type: 'multiple_choice', question: 'Why does a resistor have a power rating in watts?', options: ['To set its resistance', 'So you know how much power it can handle before overheating', 'To set its colour', 'It has no real purpose'], correct: 1, explanation: 'The rating tells you the maximum power it can safely turn into heat before it is damaged.' },
    ],
  },

  'Powering an LED Safely': {
    xpReward: 30,
    steps: [
      { type: 'teach', title: 'An LED Needs a Limit', body: 'An LED barely resists current on its own. Connect it straight across a supply and a huge current rushes through and destroys it almost instantly. A series resistor sets a safe current. A typical small LED wants around 15 to 20 mA.', circuitDiagram: 'led_no_resistor' },
      { type: 'spot_error', question: 'This LED will burn out. Click the problem.', circuitDiagram: 'led_no_resistor', correctRegion: 'missing_resistor', explanation: 'There is no current-limiting resistor, so nothing stops the current. The LED draws far too much and fails.' },
      { type: 'teach', title: 'Sizing the Resistor', body: 'Use Ohm\'s law on the resistor. With a 5V supply and an LED that drops about 2V, the resistor must drop the remaining 3V. For 15 mA:\n\nR = (5V − 2V) / 0.015A = 200Ω\n\nThe nearest common value is 220Ω, which is the classic LED resistor.' },
      { type: 'choose_resistor', question: '5V supply, an LED dropping 2V, and you want about 15 mA. Which resistor should you choose?', circuitDiagram: 'series_circuit', options: ['22 Ω', '220 Ω', '2.2 kΩ', '22 kΩ'], correct: 1, explanation: '220Ω gives roughly (5−2)/220 ≈ 14 mA, right in the safe range. 22Ω lets far too much current through; the kΩ values choke it down to a dim glow.' },
      { type: 'predict_behavior', question: 'You grab a 22Ω resistor instead of 220Ω. What happens to the LED?', circuitDiagram: 'series_circuit', options: ['Nothing, it is fine', 'Far too much current flows, risking burnout', 'It will not light at all', 'It glows very dimly'], correct: 1, explanation: 'A resistor 10× too small lets roughly 10× the current through, well over the LED\'s safe limit, so it runs dangerously hot and can burn out.' },
      { type: 'predict_behavior', question: 'Now you use a 22 kΩ resistor. What happens?', circuitDiagram: 'series_circuit', options: ['It burns out', 'It glows very dimly or not at all', 'It gets brighter', 'It explodes'], correct: 1, explanation: 'A resistor 100× too large chokes the current to a fraction of a milliamp, so the LED is barely lit.' },
      { type: 'multiple_choice', question: 'What current does a typical small LED want?', options: ['Around 20 mA', 'Around 2 A', 'Around 200 mA', 'As much as possible'], correct: 0, explanation: 'Most small indicator LEDs are happy around 15 to 20 mA. The resistor is what sets it.' },
    ],
  },

  'Measuring Your Circuit': {
    xpReward: 30,
    steps: [
      { type: 'teach', title: 'The Multimeter', body: 'A multimeter measures your circuit. The two readings you will use most:\n\n• Voltage: measured ACROSS a component (the meter goes in parallel with it).\n• Current: measured THROUGH the path (the meter goes in series, in the loop).' },
      { type: 'multiple_choice', question: 'To measure the voltage across a resistor, how do you connect the meter?', options: ['In series, in the loop', 'Across the resistor, in parallel', 'Only to the battery', 'It does not matter'], correct: 1, explanation: 'Voltage is a difference between two points, so you measure it across the component, with the meter in parallel.' },
      { type: 'multiple_choice', question: 'To measure the current through a circuit, how do you connect the meter?', options: ['Across a component, in parallel', 'In series, so the current flows through it', 'Across the battery only', 'Touching one wire'], correct: 1, explanation: 'Current is the flow through the path, so you break the loop and put the meter in series so the same current flows through it.' },
      { type: 'true_false', statement: 'You measure current by connecting the meter in parallel across a component.', correct: false, explanation: 'That is how you measure voltage. Current must be measured in series, in the path. Putting a current meter in parallel can short the component.' },
      { type: 'predict_reading', question: 'This voltage divider has two equal resistors across 5V. Predict the voltage the meter reads at the midpoint.', circuitDiagram: 'voltage_divider', options: ['0 V', '2.5 V', '5 V', '10 V'], correct: 1, explanation: 'Equal resistors split the voltage evenly, so the midpoint sits at half of 5V, which is 2.5V.' },
      { type: 'predict_reading', question: 'A 5V supply drives a single 1 kΩ resistor. Predict the current the meter reads.', circuitDiagram: 'series_circuit', options: ['5 mA', '50 mA', '0.5 mA', '500 mA'], correct: 0, explanation: 'I = V / R = 5 / 1000 = 5 mA.' },
      { type: 'match', instruction: 'Match each measurement to how you take it.', pairs: [['Measure voltage', 'Across a component (parallel)'], ['Measure current', 'Through the path (series)'], ['Voltage unit', 'Volts'], ['Current unit', 'Amps'], ['Resistance unit', 'Ohms']] },
    ],
  },

  // ─────────────────────────── Unit 1 checkpoint ───────────────────────────
  'Unit 1 Checkpoint': {
    xpReward: 50,
    steps: [
      { type: 'multiple_choice', question: 'What does current need in order to flow?', options: ['A single dead-end wire', 'A complete, unbroken loop', 'Only a resistor', 'Two batteries'], correct: 1, explanation: 'Current flows only around a complete loop back to the source.' },
      { type: 'multiple_choice', question: 'A 10V supply across a 2000Ω resistor. What current flows?', options: ['2 mA', '5 mA', '20 mA', '200 mA'], correct: 1, explanation: 'I = V / R = 10 / 2000 = 0.005 A = 5 mA.' },
      { type: 'true_false', statement: 'For a fixed voltage, increasing resistance increases the current.', correct: false, explanation: 'More resistance means LESS current: I = V / R.' },
      { type: 'identify_component', question: 'Click the component that limits current in this circuit.', circuitDiagram: 'series_circuit', correctComponent: 'resistor', explanation: 'The resistor limits the current.' },
      { type: 'choose_resistor', question: '5V supply, an LED dropping 2V, target ~15 mA. Pick the resistor.', circuitDiagram: 'series_circuit', options: ['10 Ω', '220 Ω', '4.7 kΩ', '47 kΩ'], correct: 1, explanation: '(5−2)/0.015 ≈ 200Ω, so 220Ω is the standard choice.' },
      { type: 'spot_error', question: 'Click the problem with this LED circuit.', circuitDiagram: 'led_no_resistor', correctRegion: 'missing_resistor', explanation: 'No current-limiting resistor, the LED will burn out.' },
      { type: 'predict_reading', question: 'Two equal resistors across 6V. Predict the midpoint voltage.', circuitDiagram: 'voltage_divider', options: ['1.5 V', '3 V', '6 V', '12 V'], correct: 1, explanation: 'Equal resistors split the voltage in half: 3V.' },
      { type: 'match', instruction: 'Sort each material.', pairs: [['Copper', 'Conductor'], ['Glass', 'Insulator'], ['Silver', 'Conductor'], ['Rubber', 'Insulator'], ['Gold', 'Conductor']] },
    ],
  },

  // ═══════════════════════ Unit 2: On the Breadboard ═══════════════════════

  'Power Rails': {
    xpReward: 25,
    steps: [
      { type: 'teach', title: 'The Bus Rails', body: 'The long strips down the sides of a breadboard are the power rails (or bus rails): one for + (positive) and one for − (ground). Every hole along a rail is connected, so you can tap power or ground anywhere along the board.', circuitDiagram: 'breadboard_layout' },
      { type: 'multiple_choice', question: 'On a breadboard, the two long strips along the edges are usually used for...', options: ['Holding components in place', 'Power (+) and ground (−)', 'Decoration', 'Nothing'], correct: 1, explanation: 'The edge rails distribute + and − across the whole board.' },
      { type: 'true_false', statement: 'Every hole along a single power rail is connected together.', correct: true, explanation: 'Yes. A rail is one long connected strip, so power is available anywhere along it.' },
      { type: 'multiple_choice', question: 'Why feed power to the rails first, rather than to one component?', options: ['It looks neater only', 'So + and − are available anywhere on the board', 'Rails make components faster', 'It is required by law'], correct: 1, explanation: 'With the rails powered, any component can grab + or − from the nearest hole, keeping wiring short and tidy.' },
      { type: 'identify_component', question: 'Click the part of this board that carries the positive supply.', circuitDiagram: 'breadboard_layout', correctComponent: 'power_rail', explanation: 'The + rail runs along the edge and feeds the whole board.' },
      { type: 'match', instruction: 'Match each rail or zone to its job.', pairs: [['+ rail', 'Positive supply bus'], ['− rail', 'Ground bus'], ['Centre gap', 'Separates the two halves'], ['Terminal rows', 'Connect components together'], ['Jumper wire', 'Bridges one point to another']] },
    ],
  },

  'Jumper Wires': {
    xpReward: 20,
    steps: [
      { type: 'teach', title: 'Bridging the Board', body: 'Jumper wires carry a connection from one point on the board to another, for example from the + rail to a component row. Solid-core wire (around 22 gauge) is ideal: it pushes cleanly into the holes and holds its shape. Stranded wire frays and is hard to insert.' },
      { type: 'multiple_choice', question: 'Which wire is best for a breadboard?', options: ['Thick stranded wire', 'Solid-core wire (~22 gauge)', 'Bare wire with no insulation', 'Any household cable'], correct: 1, explanation: 'Solid-core wire inserts cleanly and stays put; stranded wire frays in the holes.' },
      { type: 'teach', title: 'Keep It Tidy', body: 'Short, flat jumpers that hug the board are easier to follow and debug than long arcs flying across it. A tidy layout is not just pretty, it is how you spot a wrong connection at a glance.' },
      { type: 'true_false', statement: 'Long, messy jumper wires make a circuit easier to debug.', correct: false, explanation: 'The opposite. Tidy, short jumpers let you trace the circuit and catch mistakes quickly.' },
      { type: 'multiple_choice', question: 'A jumper wire from the + rail to row 10 does what?', options: ['Nothing', 'Brings the positive supply to row 10', 'Creates a short', 'Removes power from row 10'], correct: 1, explanation: 'The jumper carries + from the rail to that row, so components in row 10 can use it.' },
      { type: 'drag_order', instruction: 'Order the steps to power a component row from the rail.', items: ['Connect the supply to the + and − rails', 'Run a jumper from the + rail to the component row', 'Place the component in that row', 'Run a jumper from the component to the − rail'], correctOrder: [0, 1, 2, 3] },
    ],
  },

  'From Schematic to Breadboard': {
    xpReward: 25,
    steps: [
      { type: 'teach', title: 'Two Views of One Circuit', body: 'A schematic shows what connects to what using symbols, ignoring physical layout. A breadboard build is the physical version. Same circuit, two views. Learning to translate between them is the core breadboarding skill.', circuitDiagram: 'series_circuit' },
      { type: 'multiple_choice', question: 'What does a schematic show?', options: ['The exact physical positions of parts', 'Which components connect to which, using symbols', 'Only the colours of the wires', 'The price of each part'], correct: 1, explanation: 'A schematic captures the connections and components, not their physical placement.' },
      { type: 'identify_component', question: 'In this schematic, click the LED.', circuitDiagram: 'series_circuit', correctComponent: 'led', explanation: 'The triangle-and-bar symbol is the LED.' },
      { type: 'true_false', statement: 'A schematic and a breadboard build of the same circuit must look physically identical.', correct: false, explanation: 'No. They represent the same connections, but the schematic is a tidy diagram and the breadboard is the physical layout.' },
      { type: 'drag_order', instruction: 'Order the steps to turn a simple series schematic into a build.', items: ['Read the schematic and list the components', 'Power the breadboard rails', 'Place each component spanning different rows', 'Add jumpers to match the schematic connections', 'Check it against the schematic before powering on'], correctOrder: [0, 1, 2, 3, 4] },
      { type: 'multiple_choice', question: 'What is the #1 breadboard placement mistake?', options: ['Using the wrong wire colour', 'Both legs of a component in the same connected row', 'Wires that are too short', 'Powering the rails'], correct: 1, explanation: 'Both legs in one connected row short the component out, since all holes in that row are joined.' },
    ],
  },

  'Build a Series LED Circuit': {
    xpReward: 30,
    steps: [
      { type: 'teach', title: 'Your First Build', body: 'A series LED circuit is the classic first build: power, a current-limiting resistor, the LED, and back to ground. One loop, one current. Let us wire it.', circuitDiagram: 'series_circuit', showCurrentFlow: true },
      { type: 'draw_connection', instruction: 'Wire the loop: power to the resistor, resistor to the LED, LED to ground.', terminals: [{ x: 60, y: 50, label: '5V', id: 'power' }, { x: 160, y: 50, label: 'R', id: 'resistor_in' }, { x: 250, y: 50, label: 'R', id: 'resistor_out' }, { x: 320, y: 50, label: 'LED', id: 'led' }, { x: 320, y: 200, label: 'GND', id: 'ground' }], expectedConnections: [['power', 'resistor_in'], ['resistor_out', 'led'], ['led', 'ground']], explanation: 'Power → resistor → LED → ground. The resistor must come before the LED to limit current.' },
      { type: 'multiple_choice', question: 'Why does the resistor go before the LED?', options: ['It looks better', 'To limit the current through the LED', 'To raise the voltage', 'It does not matter'], correct: 1, explanation: 'The resistor limits current to protect the LED. Order in a series loop does not change the current, but the resistor must be present.' },
      { type: 'spot_error', question: 'The build does not light. Click the issue.', circuitDiagram: 'reversed_led', correctRegion: 'reversed_led', explanation: 'The LED is reversed. Flip it so current can flow anode to cathode.' },
      { type: 'predict_behavior', question: 'You wired it correctly and apply power. What happens?', circuitDiagram: 'series_circuit', options: ['Nothing', 'The LED lights up', 'The resistor explodes', 'The battery reverses'], correct: 1, explanation: 'A correct series loop with a proper resistor lights the LED safely.' },
      { type: 'true_false', statement: 'In this series loop, the same current flows through the resistor and the LED.', correct: true, explanation: 'Yes. One loop means one current, equal through every component.' },
    ],
  },

  'Build a Parallel Circuit': {
    xpReward: 30,
    steps: [
      { type: 'teach', title: 'Two Branches', body: 'In parallel, each LED gets its own branch and its own resistor, and each branch sees the full supply voltage. The supply current is the sum of the branch currents.', circuitDiagram: 'parallel_circuit', showCurrentFlow: true },
      { type: 'multiple_choice', question: 'For two LEDs at equal brightness in parallel, you should use...', options: ['One shared resistor for both', 'A resistor in each branch', 'No resistors', 'One resistor in series with the battery only'], correct: 1, explanation: 'A resistor per branch sets each LED current independently, keeping them matched.' },
      { type: 'identify_component', question: 'Click a resistor in one of the parallel branches.', circuitDiagram: 'parallel_circuit', correctComponent: 'r1', explanation: 'Each branch has its own resistor.' },
      { type: 'predict_behavior', question: 'You put a single resistor in the shared part and run two LEDs in parallel after it. What is the risk?', circuitDiagram: 'parallel_circuit', options: ['Nothing, it is ideal', 'The LEDs may glow unevenly and share current poorly', 'The voltage doubles', 'The battery charges'], correct: 1, explanation: 'Sharing one resistor lets the LEDs fight over current, so they often light unevenly. A resistor per branch fixes it.' },
      { type: 'true_false', statement: 'Each branch of a parallel circuit sees the full supply voltage.', correct: true, explanation: 'Yes. Voltage is the same across parallel branches; the current is what splits.' },
      { type: 'fill_blank', prompt: 'Two parallel branches each draw 10 mA. The supply provides ___ mA total.', blank: '___', answer: '20', hint: 'Parallel branch currents add: 10 + 10.' },
    ],
  },

  'Switches in a Circuit': {
    xpReward: 25,
    steps: [
      { type: 'teach', title: 'A Controlled Break', body: 'A switch is a controlled break in the loop. Closed, it completes the circuit and current flows. Open, it breaks the loop and current stops. A momentary (pushbutton) switch is only closed while pressed; a toggle switch stays where you flip it.' },
      { type: 'multiple_choice', question: 'What happens when a switch in a series loop is open?', options: ['Current increases', 'Current stops, the loop is broken', 'Voltage doubles', 'Nothing changes'], correct: 1, explanation: 'An open switch breaks the loop, so no current flows.' },
      { type: 'predict_behavior', question: 'An LED is lit. You open the switch in its loop. What happens?', circuitDiagram: 'series_circuit', options: ['It gets brighter', 'It goes out', 'It changes colour', 'Nothing'], correct: 1, explanation: 'Opening the switch breaks the loop, so the LED goes out.' },
      { type: 'true_false', statement: 'A momentary pushbutton stays closed after you release it.', correct: false, explanation: 'No. A momentary switch is closed only while pressed; a toggle switch stays put.' },
      { type: 'multiple_choice', question: 'Where should a switch go to control a whole series loop?', options: ['Anywhere in the loop', 'Only next to the battery + terminal', 'Only next to the LED', 'Outside the loop'], correct: 0, explanation: 'A series loop has one path, so a switch anywhere in it breaks the whole loop.' },
      { type: 'match', instruction: 'Match each switch term to its meaning.', pairs: [['Closed', 'Loop complete, current flows'], ['Open', 'Loop broken, no current'], ['Momentary', 'Closed only while pressed'], ['Toggle', 'Stays where you set it'], ['SPST', 'Simple on/off, one circuit']] },
    ],
  },

  'Common Wiring Mistakes': {
    xpReward: 30,
    steps: [
      { type: 'teach', title: 'The Usual Suspects', body: 'Most beginner circuits fail for one of a few reasons: a reversed LED, a missing current-limiting resistor, both legs of a part in the same connected row, or an accidental short. Learn to spot them on sight.', circuitDiagram: 'breadboard_layout' },
      { type: 'spot_error', question: 'Click what is wrong here.', circuitDiagram: 'reversed_led', correctRegion: 'reversed_led', explanation: 'The LED is backwards. Current only flows anode to cathode.' },
      { type: 'spot_error', question: 'Click the dangerous fault.', circuitDiagram: 'short_circuit', correctRegion: 'short_wire', explanation: 'A wire bypasses the load, creating a short. Current spikes.' },
      { type: 'spot_error', question: 'Click the missing piece.', circuitDiagram: 'led_no_resistor', correctRegion: 'missing_resistor', explanation: 'No current-limiting resistor, so the LED draws far too much current.' },
      { type: 'multiple_choice', question: 'You put both legs of a resistor in the same connected breadboard row. What happens?', options: ['It works fine', 'The resistor is shorted out and does nothing', 'It doubles the resistance', 'The board breaks'], correct: 1, explanation: 'All holes in a row are joined, so both legs in one row short across the resistor, bypassing it.' },
      { type: 'true_false', statement: 'A reversed LED will still light, just more dimly.', correct: false, explanation: 'No. Reversed, an LED blocks current and stays completely dark.' },
    ],
  },

  'Debugging a Dead Circuit': {
    xpReward: 30,
    steps: [
      { type: 'teach', title: 'Work the Loop', body: 'When nothing happens, debug calmly and in order: check power first, then the loop is complete, then component orientation, then values. Most dead circuits are a broken loop or a reversed part, not a faulty component.' },
      { type: 'drag_order', instruction: 'Order a sensible debugging sequence for a dead circuit.', items: ['Confirm power reaches the rails', 'Check the loop is complete (no gaps)', 'Check component orientation (LED polarity)', 'Check resistor and component values', 'Measure with a multimeter to confirm'], correctOrder: [0, 1, 2, 3, 4] },
      { type: 'multiple_choice', question: 'An LED build does nothing. What is the most likely cause to check first?', options: ['A faulty LED', 'No power or a broken loop', 'The wrong brand of wire', 'Room temperature'], correct: 1, explanation: 'Dead-circuit faults are usually no power or a broken loop, check those before blaming a component.' },
      { type: 'predict_reading', question: 'You measure 0V across the whole circuit even though the supply is on. What does that suggest?', circuitDiagram: 'series_circuit', options: ['Everything is fine', 'Power is not reaching the circuit (a break before it)', 'The LED is too bright', 'The resistor is too small'], correct: 1, explanation: 'No voltage across the circuit means power is not getting in, likely a break or disconnected rail upstream.' },
      { type: 'true_false', statement: 'A loose jumper wire can make a whole circuit appear dead.', correct: true, explanation: 'Yes. One loose connection breaks the loop, and the whole circuit stops.' },
      { type: 'match', instruction: 'Match each symptom to its likely cause.', pairs: [['Nothing happens', 'Broken loop or no power'], ['LED dark but circuit powered', 'LED reversed'], ['Wire gets hot', 'Short circuit'], ['LED very dim', 'Resistor too large'], ['LED burned out', 'Resistor missing or too small']] },
    ],
  },

  'Unit 2 Checkpoint': {
    xpReward: 50,
    steps: [
      { type: 'multiple_choice', question: 'The long edge strips of a breadboard are normally used for...', options: ['Components', 'Power (+) and ground (−)', 'Labels', 'Nothing'], correct: 1, explanation: 'The edge rails distribute + and − across the board.' },
      { type: 'true_false', statement: 'All holes along one power rail are connected together.', correct: true, explanation: 'Yes, a rail is one connected strip.' },
      { type: 'identify_component', question: 'Click the LED in this schematic.', circuitDiagram: 'series_circuit', correctComponent: 'led', explanation: 'The triangle-and-bar symbol is the LED.' },
      { type: 'spot_error', question: 'Click the fault in this circuit.', circuitDiagram: 'short_circuit', correctRegion: 'short_wire', explanation: 'A wire shorts across the load.' },
      { type: 'predict_behavior', question: 'You open the switch in a lit LED loop. What happens?', circuitDiagram: 'series_circuit', options: ['Brighter', 'It goes out', 'No change', 'It flickers faster'], correct: 1, explanation: 'Opening the switch breaks the loop; the LED goes out.' },
      { type: 'multiple_choice', question: 'Both legs of a component land in the same connected row. Result?', options: ['Works fine', 'The component is shorted out', 'Resistance doubles', 'Board breaks'], correct: 1, explanation: 'A connected row joins both legs, shorting the component.' },
      { type: 'drag_order', instruction: 'Order a sensible debugging sequence.', items: ['Check power reaches the rails', 'Check the loop is complete', 'Check component orientation', 'Check component values'], correctOrder: [0, 1, 2, 3] },
      { type: 'match', instruction: 'Match symptom to cause.', pairs: [['Nothing happens', 'Broken loop or no power'], ['LED dark, powered', 'LED reversed'], ['Wire gets hot', 'Short circuit'], ['LED burned out', 'No current-limiting resistor']] },
    ],
  },

  // ═══════════════════════ Unit 3: Sensors & Signals ═══════════════════════

  'Potentiometers': {
    xpReward: 25,
    steps: [
      { type: 'teach', title: 'An Adjustable Resistor', body: 'A potentiometer (pot) is a resistor you can turn. Inside is a track of resistance and a sliding contact called the wiper. Turning the knob moves the wiper, changing the resistance between the wiper and each end. It lets you vary voltage and current by hand.', circuitDiagram: 'voltage_divider' },
      { type: 'multiple_choice', question: 'What does the wiper in a potentiometer do?', options: ['Stores charge', 'Slides along the resistance track to change resistance', 'Generates voltage', 'Blocks current entirely'], correct: 1, explanation: 'The wiper taps a point along the resistive track, setting the resistance from the wiper to each end.' },
      { type: 'teach', title: 'A Pot Is a Divider', body: 'Wire the two ends of a pot across your supply and the wiper becomes the midpoint of a voltage divider you can turn. That is why pots are used as volume knobs and to set adjustable thresholds.', circuitDiagram: 'voltage_divider' },
      { type: 'predict_behavior', question: 'You turn the pot so the wiper moves toward the + end. What happens to the wiper voltage?', circuitDiagram: 'voltage_divider', options: ['It rises toward the supply voltage', 'It drops to zero', 'It stays fixed', 'It becomes negative'], correct: 0, explanation: 'Moving the wiper toward + gives it a larger share of the supply, so its voltage rises.' },
      { type: 'true_false', statement: 'A potentiometer lets you vary resistance by turning a shaft.', correct: true, explanation: 'Yes. The wiper position sets the resistance, so turning the knob varies it.' },
      { type: 'match', instruction: 'Match each potentiometer part to its role.', pairs: [['Wiper', 'Sliding contact, the output'], ['Track', 'The resistive element'], ['Two ends', 'Connect across the supply'], ['Knob', 'Moves the wiper'], ['Midpoint voltage', 'What the wiper taps off']] },
    ],
  },

  'The LDR': {
    xpReward: 25,
    steps: [
      { type: 'teach', title: 'A Light-Controlled Resistor', body: 'An LDR (light-dependent resistor), also called a photoresistor, is made from a semiconductor like cadmium sulfide. Light frees more charge carriers in the material, so its resistance drops in bright light and rises in darkness. It is a passive, non-polarised part with two leads.', circuitDiagram: 'ldr_alarm' },
      { type: 'multiple_choice', question: 'What happens to an LDR\'s resistance in bright light?', options: ['It rises', 'It drops', 'It stays the same', 'It becomes infinite'], correct: 1, explanation: 'Light frees more charge carriers, so resistance falls in bright light.' },
      { type: 'true_false', statement: 'An LDR\'s resistance increases as it gets darker.', correct: true, explanation: 'Yes. Less light means fewer free charge carriers, so resistance rises in the dark.' },
      { type: 'identify_component', question: 'Click the light-sensing component.', circuitDiagram: 'ldr_alarm', correctComponent: 'ldr', explanation: 'The LDR changes resistance with light.' },
      { type: 'multiple_choice', question: 'Is an LDR polarised (does orientation matter)?', options: ['Yes, like an LED', 'No, it works either way', 'Only in daylight', 'Only above 5V'], correct: 1, explanation: 'An LDR is a passive, non-polarised resistor, so either leg can face either way.' },
      { type: 'predict_behavior', question: 'You put an LDR in a voltage divider and cover it with your hand. Its resistance rises. What does the divider output do (with the LDR on top)?', circuitDiagram: 'voltage_divider', options: ['The output voltage changes as the LDR resistance changes', 'Nothing ever changes', 'The supply voltage rises', 'The circuit shorts'], correct: 0, explanation: 'As the LDR resistance changes with light, it takes a different share of the voltage, so the divider output moves. That is how it senses light.' },
    ],
  },

  'Thermistors': {
    xpReward: 25,
    steps: [
      { type: 'teach', title: 'A Temperature-Controlled Resistor', body: 'A thermistor is a resistor whose value changes with temperature. The common NTC type (negative temperature coefficient) drops in resistance as it gets hotter. Like the LDR, it is a passive, non-polarised sensor you read with a voltage divider.' },
      { type: 'multiple_choice', question: 'For a common NTC thermistor, as temperature rises its resistance...', options: ['Rises', 'Falls', 'Stays the same', 'Becomes negative'], correct: 1, explanation: 'NTC means negative temperature coefficient: resistance falls as temperature rises.' },
      { type: 'true_false', statement: 'A thermistor and an LDR are both resistors whose value is changed by the world around them.', correct: true, explanation: 'Yes. One responds to temperature, the other to light, but both are variable resistors you read with a divider.' },
      { type: 'multiple_choice', question: 'How do you read a thermistor\'s resistance as a voltage?', options: ['Connect it straight to 5V', 'Put it in a voltage divider with a fixed resistor', 'Use it as an LED', 'You cannot'], correct: 1, explanation: 'A divider turns the changing resistance into a changing voltage a pin can read, just like the LDR.' },
      { type: 'match', instruction: 'Match each sensor to what it responds to.', pairs: [['LDR', 'Light'], ['NTC thermistor', 'Temperature'], ['Potentiometer', 'A turn of the knob'], ['Fixed resistor', 'Nothing, it is constant']] },
    ],
  },

  'Divider as a Sensor': {
    xpReward: 30,
    steps: [
      { type: 'teach', title: 'Resistance Into Voltage', body: 'A microcontroller cannot read resistance directly, it reads voltage. The trick: put your sensor (LDR or thermistor) and a fixed resistor in a voltage divider. As the sensor resistance changes, the midpoint voltage changes, and that is what the pin reads.', circuitDiagram: 'ldr_alarm' },
      { type: 'identify_component', question: 'Click the point where the changing voltage is read.', circuitDiagram: 'ldr_alarm', correctComponent: 'a0', explanation: 'The analog pin A0 reads the divider midpoint voltage.' },
      { type: 'predict_reading', question: 'LDR on top, 10kΩ fixed resistor on the bottom, 5V supply. In bright light the LDR is low resistance (say 1kΩ). Predict the midpoint voltage.', circuitDiagram: 'voltage_divider', options: ['About 0.5 V', 'About 2.5 V', 'About 4.5 V', 'Exactly 5 V'], correct: 2, explanation: 'Vout = 5 × 10k / (1k + 10k) ≈ 4.5V. In bright light the LDR drops, so the bottom resistor keeps most of the voltage.' },
      { type: 'predict_behavior', question: 'Now it goes dark, so the LDR resistance shoots up to 200kΩ. What happens to the midpoint voltage?', circuitDiagram: 'voltage_divider', options: ['It rises', 'It falls toward 0', 'It stays at 4.5V', 'It doubles past 5V'], correct: 1, explanation: 'A huge LDR resistance takes most of the voltage, so the midpoint (across the 10k) falls. Dark = low reading.' },
      { type: 'fill_blank', prompt: 'A divider turns a changing ___ into a changing voltage the pin can read.', blank: '___', answer: 'resistance', hint: 'The sensor changes this; the divider converts it to a voltage.' },
      { type: 'true_false', statement: 'A microcontroller pin reads voltage, not resistance directly.', correct: true, explanation: 'Yes. That is exactly why we use a divider to convert resistance into a readable voltage.' },
    ],
  },

  'Analog vs Digital': {
    xpReward: 25,
    steps: [
      { type: 'teach', title: 'Two Kinds of Signal', body: 'A digital signal has just two states: HIGH (on) or LOW (off). An analog signal is a continuous range in between. A button is digital; a light sensor is analog because the brightness can be anything from dark to dazzling.' },
      { type: 'multiple_choice', question: 'Which of these is an analog signal?', options: ['A push button (pressed or not)', 'A light sensor reading brightness', 'A power switch', 'A door that is open or shut'], correct: 1, explanation: 'Brightness varies continuously, so it is analog. The others are two-state (digital).' },
      { type: 'teach', title: 'Reading Analog', body: 'A microcontroller reads analog voltage with an analog-to-digital converter. A common 10-bit converter maps 0V to 5V onto the numbers 0 to 1023. So a midpoint of 2.5V reads about 512.' },
      { type: 'fill_blank', prompt: 'A 10-bit analog reading ranges from 0 to ___', blank: '___', answer: '1023', hint: '2 to the power 10, minus 1.' },
      { type: 'predict_reading', question: 'A sensor sits at the divider midpoint of 2.5V on a 5V system with a 0 to 1023 reading. Predict the value.', circuitDiagram: 'voltage_divider', options: ['About 0', 'About 256', 'About 512', 'About 1023'], correct: 2, explanation: '2.5V is half of 5V, so it maps to about half of 1023, roughly 512.' },
      { type: 'match', instruction: 'Sort each signal.', pairs: [['Push button', 'Digital'], ['Light level', 'Analog'], ['On/off switch', 'Digital'], ['Temperature', 'Analog'], ['Volume knob', 'Analog']] },
    ],
  },

  'Planning the Light Alarm': {
    xpReward: 30,
    steps: [
      { type: 'teach', title: 'The Whole System', body: 'The Light-Activated Alarm has three parts: a SENSE stage (an LDR voltage divider), a DECIDE stage (compare the reading to a threshold), and an ACT stage (turn on an LED or buzzer). Sense, decide, act: the shape of almost every useful circuit.', circuitDiagram: 'ldr_alarm' },
      { type: 'multiple_choice', question: 'What is the job of the sense stage in the alarm?', options: ['Make noise', 'Turn light level into a voltage to read', 'Limit current to the LED', 'Store power'], correct: 1, explanation: 'The LDR divider senses light and turns it into a readable voltage.' },
      { type: 'drag_order', instruction: 'Order the three stages of the alarm.', items: ['Sense the light (LDR divider)', 'Decide (compare to a threshold)', 'Act (LED or buzzer on)'], correctOrder: [0, 1, 2] },
      { type: 'identify_component', question: 'Click the part that produces the alarm output.', circuitDiagram: 'ldr_alarm', correctComponent: 'led', explanation: 'The LED (or a buzzer) is the act stage, the alarm output.' },
      { type: 'match', instruction: 'Match each stage to its component.', pairs: [['Sense', 'LDR + resistor divider'], ['Decide', 'Threshold comparison'], ['Act', 'LED or buzzer'], ['Read point', 'Analog pin A0']] },
      { type: 'true_false', statement: 'Sense, decide, act is a pattern you will reuse in many circuits.', correct: true, explanation: 'Yes. Most useful builds sense something, decide based on it, and act.' },
    ],
  },

  'Setting the Threshold': {
    xpReward: 30,
    steps: [
      { type: 'teach', title: 'Where to Draw the Line', body: 'The threshold is the reading at which the alarm flips from off to on. Set it between the typical bright reading and the typical dark reading. Too close to one and it triggers by accident; well between them and it is reliable.' },
      { type: 'predict_behavior', question: 'In bright light the LDR divider reads about 800, and in darkness about 200. Where is a sensible threshold for a darkness alarm?', options: ['Around 950', 'Around 500', 'Around 50', 'Exactly 1023'], correct: 1, explanation: 'A threshold around 500 sits comfortably between 200 (dark) and 800 (light), so it triggers cleanly when it gets dark.' },
      { type: 'multiple_choice', question: 'You set the threshold at 790, just below the bright reading of 800. What is the risk?', options: ['It is perfect', 'A tiny dip in light triggers it by accident', 'It will never trigger', 'It damages the LDR'], correct: 1, explanation: 'A threshold hugging the bright reading triggers on the smallest shadow. Leave a margin.' },
      { type: 'predict_behavior', question: 'Darkness alarm with threshold 500. The room goes dark and the reading falls to 200. What does the alarm do?', circuitDiagram: 'ldr_alarm', options: ['Stays off', 'Turns on', 'Explodes', 'Resets the board'], correct: 1, explanation: 'The reading (200) dropped below the threshold (500), so the decide stage fires the alarm.' },
      { type: 'true_false', statement: 'A good threshold sits roughly between the bright and dark readings.', correct: true, explanation: 'Yes. Midway gives margin against noise and accidental triggers.' },
      { type: 'fill_blank', prompt: 'Bright reads 800, dark reads 200. A safe middle threshold is about ___', blank: '___', answer: '500', hint: 'Halfway between 200 and 800.' },
    ],
  },

  'Wiring the Light Alarm': {
    xpReward: 35,
    steps: [
      { type: 'teach', title: 'Bring It Together', body: 'Time to wire the full alarm: the LDR and a 10kΩ resistor form the divider, the midpoint goes to the analog pin, and the LED (with its own resistor) is the output. This is the capstone of everything so far.', circuitDiagram: 'ldr_alarm' },
      { type: 'draw_connection', instruction: 'Wire the LDR divider: 5V to the LDR, LDR to the junction, junction to the 10kΩ resistor, resistor to ground, and the junction to A0.', terminals: [{ x: 60, y: 40, label: '5V', id: 'vcc' }, { x: 180, y: 40, label: 'LDR', id: 'ldr' }, { x: 300, y: 40, label: 'A0', id: 'a0' }, { x: 180, y: 140, label: '10kΩ', id: 'res' }, { x: 180, y: 240, label: 'GND', id: 'gnd' }], expectedConnections: [['vcc', 'ldr'], ['ldr', 'a0'], ['ldr', 'res'], ['res', 'gnd']], explanation: '5V → LDR → junction → 10kΩ → GND, with the junction also feeding A0. The divider midpoint is what the pin reads.' },
      { type: 'identify_component', question: 'Click the component that limits current to the output LED.', circuitDiagram: 'ldr_alarm', correctComponent: 'led_resistor', explanation: 'The series resistor on the LED branch limits its current, just like every LED you have wired.' },
      { type: 'spot_error', question: 'The alarm LED never lights even when triggered. Click the likely wiring fault.', circuitDiagram: 'reversed_led', correctRegion: 'reversed_led', explanation: 'The output LED is reversed. Flip it so current can flow.' },
      { type: 'predict_behavior', question: 'Everything is wired and the threshold is set. You cover the LDR. What happens?', circuitDiagram: 'ldr_alarm', options: ['Nothing', 'The reading falls below the threshold and the alarm LED turns on', 'The LDR burns out', 'The supply doubles'], correct: 1, explanation: 'Covering the LDR raises its resistance, the reading drops past the threshold, and the act stage lights the LED.' },
      { type: 'true_false', statement: 'You have now built sense, decide, and act into one working circuit.', correct: true, explanation: 'Yes. That is the full Light-Activated Alarm, and the pattern behind countless real devices.' },
    ],
  },

  'Unit 3 Checkpoint': {
    xpReward: 50,
    steps: [
      { type: 'multiple_choice', question: 'In bright light, an LDR\'s resistance...', options: ['Rises', 'Falls', 'Stays the same', 'Goes infinite'], correct: 1, explanation: 'Light frees charge carriers, so resistance falls.' },
      { type: 'multiple_choice', question: 'A common NTC thermistor, as it heats up, has resistance that...', options: ['Rises', 'Falls', 'Stays fixed', 'Reverses'], correct: 1, explanation: 'NTC: resistance falls as temperature rises.' },
      { type: 'identify_component', question: 'Click where the divider voltage is read.', circuitDiagram: 'ldr_alarm', correctComponent: 'a0', explanation: 'A0 reads the divider midpoint.' },
      { type: 'predict_reading', question: 'A sensor sits at 2.5V on a 5V, 0 to 1023 system. Predict the reading.', circuitDiagram: 'voltage_divider', options: ['0', '256', '512', '1023'], correct: 2, explanation: 'Half of 5V maps to about half of 1023, ~512.' },
      { type: 'multiple_choice', question: 'Which signal is analog?', options: ['A push button', 'A light level', 'An on/off switch', 'A closed door'], correct: 1, explanation: 'Light level varies continuously, so it is analog.' },
      { type: 'drag_order', instruction: 'Order the alarm\'s three stages.', items: ['Sense the light', 'Decide against a threshold', 'Act (LED on)'], correctOrder: [0, 1, 2] },
      { type: 'predict_behavior', question: 'Darkness alarm, threshold 500. The room darkens and the reading drops to 180. What happens?', circuitDiagram: 'ldr_alarm', options: ['Alarm stays off', 'Alarm turns on', 'LDR burns out', 'Nothing'], correct: 1, explanation: 'The reading fell below the threshold, so the alarm fires.' },
      { type: 'match', instruction: 'Match each sensor to what it senses.', pairs: [['LDR', 'Light'], ['Thermistor', 'Temperature'], ['Potentiometer', 'A knob turn'], ['Button', 'Pressed or not']] },
    ],
  },

  // ═══════════════════════ Unit 4: Meet the Arduino ═══════════════════════

  'What Is a Microcontroller': {
    xpReward: 25,
    steps: [
      { type: 'teach', title: 'A Tiny Programmable Computer', body: 'An Arduino is a board built around a microcontroller: a small computer on a single chip. It has no screen or keyboard. Instead it reads its input pins, runs the program you upload, and sets its output pins. That is the whole idea: read the world, decide in code, change the world.' },
      { type: 'multiple_choice', question: 'What is a microcontroller?', options: ['A type of resistor', 'A small computer on a chip that runs your program', 'A kind of battery', 'A display screen'], correct: 1, explanation: 'It is a tiny programmable computer that reads inputs, runs your code, and drives outputs.' },
      { type: 'true_false', statement: 'An Arduino keeps running the last program you uploaded, even after you unplug your computer.', correct: true, explanation: 'Yes. The program is stored on the board, so it runs whenever the Arduino has power.' },
      { type: 'multiple_choice', question: 'Which best describes what an Arduino does in a project?', options: ['Reads inputs, runs code, drives outputs', 'Only lights LEDs', 'Only stores data', 'Generates its own power'], correct: 0, explanation: 'Sense, decide, act, exactly the pattern from the light alarm, now in code.' },
      { type: 'match', instruction: 'Match each idea to the alarm you already built.', pairs: [['Input pin', 'Reads the LDR voltage'], ['Your code', 'Decides against the threshold'], ['Output pin', 'Drives the LED or buzzer'], ['The board', 'Runs it all on its own']] },
    ],
  },

  'The Arduino Pins': {
    xpReward: 25,
    steps: [
      { type: 'teach', title: 'The Rows of Pins', body: 'An Arduino Uno has a few kinds of pin:\n\n• Digital pins (0 to 13): on/off, HIGH or LOW.\n• Analog input pins (A0 to A5): read a voltage from 0 to 5V.\n• Power pins: 5V, 3.3V, and GND (ground).\n\nYou wire your circuit to these pins and address each one in code.', circuitDiagram: 'ldr_alarm' },
      { type: 'multiple_choice', question: 'Which pins read a continuously varying voltage from a sensor?', options: ['Digital pins 0 to 13', 'Analog input pins A0 to A5', 'The 5V pin', 'GND'], correct: 1, explanation: 'Analog input pins (A0 to A5) measure voltages from 0 to 5V, ideal for sensors.' },
      { type: 'multiple_choice', question: 'A digital pin can be in how many states?', options: ['One', 'Two: HIGH or LOW', 'Ten', 'Any value from 0 to 1023'], correct: 1, explanation: 'A digital pin is either HIGH (5V) or LOW (0V).' },
      { type: 'identify_component', question: 'Click the analog pin that reads the sensor in this alarm circuit.', circuitDiagram: 'ldr_alarm', correctComponent: 'a0', explanation: 'A0 is an analog input reading the divider voltage.' },
      { type: 'true_false', statement: 'You connect the ground of your circuit to a GND pin on the Arduino.', correct: true, explanation: 'Yes. A shared ground is what lets the Arduino and your circuit agree on 0V.' },
      { type: 'match', instruction: 'Match each pin type to its job.', pairs: [['Digital pin', 'On/off (HIGH or LOW)'], ['Analog input', 'Reads 0 to 5V'], ['5V pin', 'Supplies power'], ['GND pin', 'The 0V reference']] },
    ],
  },

  'The Sketch: setup and loop': {
    xpReward: 25,
    steps: [
      { type: 'teach', title: 'Every Sketch Has Two Parts', body: 'An Arduino program (a "sketch") always has two functions:\n\nvoid setup() {\n  // runs ONCE at the start\n}\n\nvoid loop() {\n  // runs OVER AND OVER, forever\n}\n\nsetup() is for one-time settings (like pin directions). loop() is the part that repeats for as long as the board has power.' },
      { type: 'multiple_choice', question: 'How often does the code inside setup() run?', options: ['Once, at the start', 'Over and over forever', 'Never', 'Only when a button is pressed'], correct: 0, explanation: 'setup() runs a single time when the program starts.' },
      { type: 'multiple_choice', question: 'How often does the code inside loop() run?', options: ['Once', 'Over and over, forever', 'Twice', 'Only on reset'], correct: 1, explanation: 'loop() repeats continuously for as long as the Arduino is powered.' },
      { type: 'true_false', statement: 'You can leave loop() empty if your program only needs to do something once.', correct: true, explanation: 'Yes. Both functions must exist, but loop() can be empty if all the work is in setup().' },
      { type: 'fill_blank', prompt: 'The function that runs once at the start is called ___()', blank: '___', answer: 'setup', hint: 'The other one is loop().' },
      { type: 'match', instruction: 'Match each function to when it runs.', pairs: [['setup()', 'Once, at the start'], ['loop()', 'Over and over, forever']] },
    ],
  },

  'Naming Pins with Variables': {
    xpReward: 20,
    steps: [
      { type: 'teach', title: 'Give Pins Meaningful Names', body: 'Instead of scattering the number 13 through your code, name it once at the top:\n\nconst int LED = 13;\n\nNow you write LED everywhere, and if you move the LED to another pin you change just one line. const means the value will not change while the program runs.' },
      { type: 'multiple_choice', question: 'Why name a pin with a variable like const int LED = 13;?', options: ['It makes the LED brighter', 'So the code reads clearly and you change the pin in one place', 'It is required by the compiler', 'It saves battery'], correct: 1, explanation: 'A named pin makes code readable and means a pin change is a one-line edit.' },
      { type: 'fill_blank', prompt: 'Complete the line that names pin 9 as BUZZER: const int BUZZER = ___;', blank: '___', answer: '9', hint: 'Just the pin number.' },
      { type: 'true_false', statement: 'const means the value can change freely while the program runs.', correct: false, explanation: 'The opposite. const marks a value that stays fixed for the whole program.' },
      { type: 'multiple_choice', question: 'You move your LED from pin 13 to pin 8. With const int LED = 13; at the top, what do you change?', options: ['Every digitalWrite line', 'Just that one line, to 8', 'Nothing', 'The whole loop()'], correct: 1, explanation: 'That is the benefit: change the single definition and the rest of the code follows.' },
    ],
  },

  'pinMode and Outputs': {
    xpReward: 25,
    steps: [
      { type: 'teach', title: 'Tell a Pin Its Direction', body: 'Before you use a pin, tell the Arduino whether it is an input or an output, using pinMode() in setup():\n\npinMode(LED, OUTPUT);\n\nOUTPUT lets the pin drive something (like an LED). INPUT lets the pin read something. Pins default to INPUT until you change them.' },
      { type: 'multiple_choice', question: 'Where do you normally set a pin\'s direction with pinMode()?', options: ['In loop()', 'In setup()', 'Outside both functions', 'You never need to'], correct: 1, explanation: 'Pin directions are a one-time setting, so they go in setup().' },
      { type: 'fill_blank', prompt: 'Set the LED pin as an output: pinMode(LED, ___);', blank: '___', answer: 'OUTPUT', hint: 'The opposite of INPUT. Capitals.' },
      { type: 'multiple_choice', question: 'You want a pin to drive an LED. Which mode?', options: ['INPUT', 'OUTPUT', 'ANALOG', 'It does not matter'], correct: 1, explanation: 'Driving something means OUTPUT. Reading something means INPUT.' },
      { type: 'true_false', statement: 'Arduino pins default to OUTPUT unless you say otherwise.', correct: false, explanation: 'They default to INPUT. Set OUTPUT explicitly when you want to drive a pin.' },
    ],
  },

  'digitalWrite: On and Off': {
    xpReward: 25,
    steps: [
      { type: 'teach', title: 'Turn a Pin On or Off', body: 'digitalWrite() sets an output pin HIGH or LOW:\n\ndigitalWrite(LED, HIGH); // 5V, LED on\ndigitalWrite(LED, LOW);  // 0V, LED off\n\nThe pin stays in that state until you change it again.', circuitDiagram: 'series_circuit' },
      { type: 'multiple_choice', question: 'What voltage does digitalWrite(LED, HIGH) put on the pin (on a 5V Uno)?', options: ['0V', '2.5V', '5V', '13V'], correct: 2, explanation: 'HIGH means 5V on an Uno; LOW means 0V.' },
      { type: 'fill_blank', prompt: 'Turn the LED off: digitalWrite(LED, ___);', blank: '___', answer: 'LOW', hint: 'The opposite of HIGH.' },
      { type: 'predict_behavior', question: 'Your loop has only digitalWrite(LED, HIGH); and nothing else. What does the LED do?', options: ['Blinks', 'Stays on solidly', 'Stays off', 'Fades'], correct: 1, explanation: 'With no LOW and no delay, the pin is driven HIGH continuously, so the LED is solid on.' },
      { type: 'true_false', statement: 'After digitalWrite sets a pin HIGH, it stays HIGH until your code changes it.', correct: true, explanation: 'Yes. The pin holds its state until the next digitalWrite.' },
    ],
  },

  'Blink': {
    xpReward: 30,
    steps: [
      { type: 'teach', title: 'Hello, World', body: 'Blink is the classic first sketch. It turns the LED on, waits, off, waits, forever:\n\nconst int LED = 13;\n\nvoid setup() {\n  pinMode(LED, OUTPUT);\n}\n\nvoid loop() {\n  digitalWrite(LED, HIGH);\n  delay(1000);\n  digitalWrite(LED, LOW);\n  delay(1000);\n}\n\ndelay(1000) pauses for 1000 milliseconds, one second.', circuitDiagram: 'series_circuit' },
      { type: 'multiple_choice', question: 'What does delay(1000) do?', options: ['Repeats 1000 times', 'Pauses the program for 1000 milliseconds (1 second)', 'Sets the pin to 1000V', 'Nothing'], correct: 1, explanation: 'delay() pauses for the given number of milliseconds; 1000 ms is one second.' },
      { type: 'drag_order', instruction: 'Order the lines inside loop() to blink the LED.', items: ['digitalWrite(LED, HIGH);', 'delay(1000);', 'digitalWrite(LED, LOW);', 'delay(1000);'], correctOrder: [0, 1, 2, 3] },
      { type: 'predict_behavior', question: 'You remove both delay() lines from Blink. What happens?', options: ['The LED blinks slower', 'The LED switches so fast it looks dimly on, not blinking', 'The LED turns off', 'The Arduino breaks'], correct: 1, explanation: 'Without delays the pin toggles thousands of times a second, far too fast to see as a blink; it just looks faintly lit.' },
      { type: 'fill_blank', prompt: 'To make the LED stay on for half a second, use delay(___);', blank: '___', answer: '500', hint: 'Milliseconds. Half of 1000.' },
      { type: 'true_false', statement: 'pinMode for the LED belongs in loop(), not setup().', correct: false, explanation: 'It belongs in setup(), it is a one-time setting. loop() does the repeating blink.' },
    ],
  },

  'The Serial Monitor': {
    xpReward: 25,
    steps: [
      { type: 'teach', title: 'Let the Arduino Talk Back', body: 'The Serial Monitor lets your Arduino print messages to your computer, which is how you see what it is thinking. Start it in setup():\n\nSerial.begin(9600);\n\nThen print anywhere:\n\nSerial.println(value);\n\n9600 is the baud rate (speed); the Monitor must be set to the same number.' },
      { type: 'fill_blank', prompt: 'Start serial at the common baud rate: Serial.begin(___);', blank: '___', answer: '9600', hint: 'The standard default baud rate.' },
      { type: 'multiple_choice', question: 'Why is the Serial Monitor so useful?', options: ['It powers the Arduino', 'It lets you see values and messages from your running program', 'It uploads code', 'It limits current'], correct: 1, explanation: 'Printing values is the simplest, most powerful way to debug what your code is actually doing.' },
      { type: 'predict_reading', question: 'Your loop reads a sensor with analogRead and does Serial.println(value). You turn a knob from min to max. What do you see scroll by?', options: ['Always 0', 'Numbers climbing from about 0 to about 1023', 'Letters', 'Nothing'], correct: 1, explanation: 'analogRead returns 0 to 1023, so the printed numbers track the knob across that range.' },
      { type: 'true_false', statement: 'The Serial Monitor baud rate must match the number in Serial.begin().', correct: true, explanation: 'Yes. Mismatched baud rates produce garbled text.' },
    ],
  },

  'Uploading Your Code': {
    xpReward: 20,
    steps: [
      { type: 'teach', title: 'From Computer to Chip', body: 'To run a sketch you upload it: the IDE compiles your code, then sends it over the USB cable to the board, where it is stored and starts running. You pick the right board and port first, then press Upload.' },
      { type: 'drag_order', instruction: 'Order the steps to get a sketch running on the board.', items: ['Write the sketch', 'Select your board and port', 'Press Upload (it compiles, then sends)', 'The board stores and runs it'], correctOrder: [0, 1, 2, 3] },
      { type: 'multiple_choice', question: 'What happens when you press Upload?', options: ['The code runs only on the computer', 'The IDE compiles the code and sends it to the board over USB', 'The board emails you', 'Nothing until you reboot the computer'], correct: 1, explanation: 'Upload compiles your sketch and transfers it to the board, which then runs it.' },
      { type: 'true_false', statement: 'Once uploaded, the sketch keeps running on the board even after you unplug the USB data cable, as long as it has power.', correct: true, explanation: 'Yes. The program lives on the board; it runs whenever powered.' },
      { type: 'multiple_choice', question: 'Upload fails saying no board is found. What is the most likely fix?', options: ['Rewrite the whole sketch', 'Select the correct board and port, and check the cable', 'Buy a new computer', 'Remove the LED'], correct: 1, explanation: 'A missing-board error is almost always the wrong port/board selection or a charge-only USB cable.' },
    ],
  },

  'Reading Errors': {
    xpReward: 25,
    steps: [
      { type: 'teach', title: 'Errors Are Clues', body: 'When code will not compile, the IDE prints an error and highlights a line. The most common beginner errors are tiny: a missing semicolon at the end of a line, a missing closing brace, or a misspelled command. Read the first error first, lower ones are often just knock-on effects.' },
      { type: 'multiple_choice', question: 'Which is the most common beginner compile error?', options: ['A missing semicolon at the end of a line', 'The Arduino is broken', 'The LED is too bright', 'The wrong resistor'], correct: 0, explanation: 'Most statements must end with a semicolon; a missing one is the classic error.' },
      { type: 'true_false', statement: 'The line  digitalWrite(LED, HIGH)  with no semicolon on the end will fail to compile.', correct: true, explanation: 'A simple statement needs its semicolon; without it the sketch will not compile.' },
      { type: 'true_false', statement: 'When you see many errors, you should usually fix the first one first.', correct: true, explanation: 'Yes. Later errors are often caused by the first, so fixing the top one can clear several.' },
      { type: 'fill_blank', prompt: 'Every simple statement in Arduino code must end with a ___', blank: '___', answer: 'semicolon', hint: 'The ; character.' },
      { type: 'multiple_choice', question: 'The IDE highlights a line and says "expected }". What is likely missing?', options: ['A resistor', 'A closing curly brace somewhere above', 'A new board', 'A delay'], correct: 1, explanation: 'Unbalanced braces are a common structural error; you are missing a closing }.' },
    ],
  },

  'Unit 4 Checkpoint': {
    xpReward: 50,
    steps: [
      { type: 'multiple_choice', question: 'A microcontroller is...', options: ['A resistor', 'A small computer on a chip that runs your program', 'A battery', 'A screen'], correct: 1, explanation: 'A tiny programmable computer.' },
      { type: 'multiple_choice', question: 'Which pins read 0 to 5V from a sensor?', options: ['Digital 0 to 13', 'Analog A0 to A5', '5V', 'GND'], correct: 1, explanation: 'Analog input pins read 0 to 5V.' },
      { type: 'fill_blank', prompt: 'The function that runs once at start is ___()', blank: '___', answer: 'setup', hint: 'The other is loop().' },
      { type: 'fill_blank', prompt: 'Set a pin to drive an LED: pinMode(LED, ___);', blank: '___', answer: 'OUTPUT', hint: 'Capitals.' },
      { type: 'drag_order', instruction: 'Order the loop() lines to blink an LED.', items: ['digitalWrite(LED, HIGH);', 'delay(1000);', 'digitalWrite(LED, LOW);', 'delay(1000);'], correctOrder: [0, 1, 2, 3] },
      { type: 'predict_behavior', question: 'loop() has only digitalWrite(LED, HIGH); with no delay or LOW. The LED...', options: ['Blinks', 'Stays solidly on', 'Stays off', 'Fades'], correct: 1, explanation: 'Driven HIGH continuously, it stays on.' },
      { type: 'fill_blank', prompt: 'Start the Serial Monitor: Serial.begin(___);', blank: '___', answer: '9600', hint: 'Standard baud rate.' },
      { type: 'true_false', statement: 'Most simple statements must end with a semicolon.', correct: true, explanation: 'Yes, a missing semicolon is the classic compile error.' },
    ],
  },

  // ═══════════════════ Unit 5: Inputs, Outputs & Code ═══════════════════

  'Reading a Button': {
    xpReward: 25,
    steps: [
      { type: 'teach', title: 'Reading an Input', body: 'To read a button, set its pin as an INPUT and use digitalRead():\n\npinMode(BUTTON, INPUT);\nint state = digitalRead(BUTTON);\n\ndigitalRead returns HIGH or LOW depending on the voltage on the pin. A button just connects the pin to 5V or lets it go.' },
      { type: 'fill_blank', prompt: 'Read the button\'s state: int state = digitalRead(___);', blank: '___', answer: 'BUTTON', hint: 'The name of the pin you defined.' },
      { type: 'multiple_choice', question: 'What does digitalRead() return?', options: ['A number 0 to 1023', 'HIGH or LOW', 'A voltage in volts', 'The pin number'], correct: 1, explanation: 'digitalRead reports the pin as HIGH or LOW, a digital (two-state) reading.' },
      { type: 'multiple_choice', question: 'To read a pin instead of drive it, set its mode to...', options: ['OUTPUT', 'INPUT', 'HIGH', 'PWM'], correct: 1, explanation: 'Reading a pin means INPUT.' },
      { type: 'true_false', statement: 'A button gives an analog value from 0 to 1023.', correct: false, explanation: 'A plain button is digital: pressed or not, HIGH or LOW. Analog values come from sensors like the LDR.' },
    ],
  },

  'Pull-up and Pull-down Resistors': {
    xpReward: 30,
    steps: [
      { type: 'teach', title: 'The Floating Pin Problem', body: 'A button connects a pin to 5V when pressed. But when it is NOT pressed, the pin connects to nothing, it "floats", and electrical noise makes it flicker randomly between HIGH and LOW. A pull-down resistor (to ground) holds the pin at a steady LOW until the button is pressed. A pull-up (to 5V) does the reverse.' },
      { type: 'multiple_choice', question: 'What is a "floating" input pin?', options: ['A pin set to OUTPUT', 'A pin connected to neither 5V nor ground, so it picks up noise', 'A pin at exactly 2.5V', 'A broken pin'], correct: 1, explanation: 'With no defined connection, the pin floats and its reading fluctuates with noise.' },
      { type: 'multiple_choice', question: 'A pull-down resistor sets the button\'s default (unpressed) reading to...', options: ['HIGH', 'LOW', 'Random', '2.5V'], correct: 1, explanation: 'A pull-down ties the pin to ground, so it reads LOW until the button connects it to 5V.' },
      { type: 'predict_behavior', question: 'You wire a button with no pull-up or pull-down. Unpressed, what does digitalRead give?', options: ['A steady LOW', 'A steady HIGH', 'Random, flickering values', 'Always 512'], correct: 2, explanation: 'A floating pin has no defined state, so it flickers unpredictably. That is exactly what the pull resistor fixes.' },
      { type: 'true_false', statement: 'A pull-up or pull-down resistor gives a digital input a defined default state.', correct: true, explanation: 'Yes. It anchors the pin to HIGH (pull-up) or LOW (pull-down) until the button changes it.' },
      { type: 'match', instruction: 'Match each setup to the unpressed reading.', pairs: [['Pull-down resistor', 'Reads LOW by default'], ['Pull-up resistor', 'Reads HIGH by default'], ['No resistor (floating)', 'Random, noisy reading']] },
    ],
  },

  'Debouncing a Button': {
    xpReward: 25,
    steps: [
      { type: 'teach', title: 'One Press, Many Signals', body: 'When you press a real button, the metal contacts physically bounce for a few milliseconds, so the Arduino can read one press as several rapid presses. Smoothing this out is called debouncing. The simplest fix: after detecting a change, wait a few milliseconds before reading again.' },
      { type: 'multiple_choice', question: 'Why might one button press register as several?', options: ['The Arduino is broken', 'The contacts physically bounce for a few milliseconds', 'The resistor is too big', 'The LED interferes'], correct: 1, explanation: 'Mechanical contacts bounce, producing several rapid transitions from one press.' },
      { type: 'multiple_choice', question: 'A simple software debounce is to...', options: ['Use a bigger LED', 'Wait a short time after a change before reading again', 'Remove the pull-down', 'Increase the baud rate'], correct: 1, explanation: 'A brief delay after a detected change lets the bouncing settle before you read again.' },
      { type: 'true_false', statement: 'Debouncing is about smoothing the noisy signal from a button being pressed.', correct: true, explanation: 'Yes. It stops one physical press from registering as many.' },
      { type: 'fill_blank', prompt: 'Bouncing lasts a few ___ (the unit delay() uses).', blank: '___', answer: 'milliseconds', hint: 'Thousandths of a second.' },
    ],
  },

  'analogRead in Code': {
    xpReward: 30,
    steps: [
      { type: 'teach', title: 'Reading a Sensor in Code', body: 'analogRead() turns the voltage on an analog pin into a number from 0 (0V) to 1023 (5V):\n\nint value = analogRead(A0);\n\nThis is exactly how the Arduino reads your LDR divider. No pinMode is needed for analog input pins.', circuitDiagram: 'ldr_alarm' },
      { type: 'fill_blank', prompt: 'Read the sensor on pin A0: int value = analogRead(___);', blank: '___', answer: 'A0', hint: 'The analog pin the divider connects to.' },
      { type: 'multiple_choice', question: 'analogRead() returns a number in what range?', options: ['0 to 5', '0 to 100', '0 to 1023', 'HIGH or LOW'], correct: 2, explanation: 'A 10-bit ADC maps 0 to 5V onto 0 to 1023.' },
      { type: 'predict_reading', question: 'Your LDR divider sits at about 2.5V and feeds A0. Predict the analogRead value.', circuitDiagram: 'voltage_divider', options: ['About 0', 'About 512', 'About 1023', 'HIGH'], correct: 1, explanation: '2.5V is half of 5V, so analogRead returns about half of 1023, roughly 512.' },
      { type: 'predict_behavior', question: 'You cover the LDR so the divider voltage falls. What happens to the analogRead value?', circuitDiagram: 'ldr_alarm', options: ['It rises', 'It falls', 'It stays the same', 'It jumps to 1023'], correct: 1, explanation: 'Lower voltage maps to a lower number. The reading falls as it gets darker (with the LDR on top).' },
      { type: 'true_false', statement: 'Analog input pins need pinMode set to INPUT before analogRead works.', correct: false, explanation: 'No. Analog input pins read directly with analogRead, no pinMode needed.' },
    ],
  },

  'analogWrite and PWM': {
    xpReward: 30,
    steps: [
      { type: 'teach', title: 'Faking Analog Output', body: 'A digital pin can only do HIGH or LOW, but if it switches between them very fast, the average looks like a level in between. That is PWM (pulse-width modulation), and analogWrite() does it:\n\nanalogWrite(LED, 128);\n\nThe value 0 to 255 sets the brightness: 0 is off, 255 is full, 128 is about half.' },
      { type: 'multiple_choice', question: 'What does PWM let a digital pin do?', options: ['Read analog voltages', 'Appear to output a level between off and full by switching fast', 'Store data', 'Measure temperature'], correct: 1, explanation: 'Rapid on/off switching averages to an apparent in-between level, used for dimming and speed control.' },
      { type: 'fill_blank', prompt: 'analogWrite uses a value from 0 to ___', blank: '___', answer: '255', hint: '8-bit range; full brightness.' },
      { type: 'predict_behavior', question: 'analogWrite(LED, 255) versus analogWrite(LED, 64). What is the difference?', options: ['No difference', '255 is full brightness, 64 is dim', '64 is brighter', 'Both are off'], correct: 1, explanation: 'Higher PWM value means a higher average, so 255 is full brightness and 64 is dim.' },
      { type: 'multiple_choice', question: 'PWM is commonly used to...', options: ['Dim LEDs and control motor speed', 'Read sensors', 'Power the board', 'Replace the resistor'], correct: 0, explanation: 'Dimming, fading, and motor-speed control are classic PWM uses.' },
      { type: 'true_false', statement: 'PWM produces a true analog voltage on the pin.', correct: false, explanation: 'Not exactly. It rapidly switches HIGH/LOW so the average behaves like an analog level, which is good enough for LEDs and motors.' },
    ],
  },

  'Making Sound with tone()': {
    xpReward: 20,
    steps: [
      { type: 'teach', title: 'Beeps and Buzzes', body: 'tone() drives a buzzer or speaker at a given frequency in hertz:\n\ntone(BUZZER, 1000);   // 1000 Hz tone\nnoTone(BUZZER);        // stop\n\nHigher frequency means a higher pitch. This is how your alarm makes noise.' },
      { type: 'multiple_choice', question: 'What does the number in tone(BUZZER, 1000) set?', options: ['The volume', 'The frequency (pitch) in hertz', 'The pin number', 'The delay'], correct: 1, explanation: 'It sets the frequency in hertz; higher is a higher pitch.' },
      { type: 'fill_blank', prompt: 'Stop the buzzer: ___(BUZZER);', blank: '___', answer: 'noTone', hint: 'The opposite of tone().' },
      { type: 'predict_behavior', question: 'You call tone(BUZZER, 2000) instead of tone(BUZZER, 500). How does it sound?', options: ['Quieter', 'Higher pitched', 'Lower pitched', 'No sound'], correct: 1, explanation: 'Higher frequency means a higher pitch.' },
      { type: 'true_false', statement: 'A buzzer is an output, so its pin should be set to OUTPUT.', correct: true, explanation: 'Yes, you are driving it, so it is an output.' },
    ],
  },

  'if: Making Decisions': {
    xpReward: 30,
    steps: [
      { type: 'teach', title: 'Code That Decides', body: 'An if statement runs code only when a condition is true:\n\nif (value < threshold) {\n  // do this when value is below threshold\n}\n\nThe part in parentheses is the condition. Common comparisons: < (less than), > (greater than), == (equal to).' },
      { type: 'multiple_choice', question: 'When does the code inside if (value < 500) { } run?', options: ['Always', 'Only when value is less than 500', 'Only when value equals 500', 'Never'], correct: 1, explanation: 'The block runs only while the condition (value < 500) is true.' },
      { type: 'fill_blank', prompt: 'Fill the comparison so it triggers when dark (reading below threshold): if (reading ___ threshold)', blank: '___', answer: '<', hint: 'Less-than sign.' },
      { type: 'predict_behavior', question: 'threshold is 500. The reading is 200. Does if (reading < threshold) run its block?', options: ['Yes', 'No', 'Only sometimes', 'It errors'], correct: 0, explanation: '200 is less than 500, so the condition is true and the block runs.' },
      { type: 'multiple_choice', question: 'Which operator checks "greater than"?', options: ['<', '>', '==', '!'], correct: 1, explanation: '> is greater than; < is less than; == is equal to.' },
      { type: 'true_false', statement: 'if lets your program do different things depending on a sensor reading.', correct: true, explanation: 'Yes. That is the decide stage of sense, decide, act, in code.' },
    ],
  },

  'Coding the Light Alarm': {
    xpReward: 40,
    steps: [
      { type: 'teach', title: 'The Alarm, in Code', body: 'Now make the Arduino run your alarm. Read the LDR, compare to a threshold, drive the output:\n\nvoid loop() {\n  int reading = analogRead(A0);\n  if (reading < threshold) {\n    digitalWrite(ALARM, HIGH); // dark: alarm on\n  } else {\n    digitalWrite(ALARM, LOW);  // light: alarm off\n  }\n}\n\nSense (analogRead), decide (if), act (digitalWrite).', circuitDiagram: 'ldr_alarm' },
      { type: 'drag_order', instruction: 'Order the loop() to make a darkness alarm.', items: ['int reading = analogRead(A0);', 'if (reading < threshold) {', 'digitalWrite(ALARM, HIGH);', '} else {', 'digitalWrite(ALARM, LOW);', '}'], correctOrder: [0, 1, 2, 3, 4, 5] },
      { type: 'fill_blank', prompt: 'Read the sensor into a variable: int reading = analogRead(___);', blank: '___', answer: 'A0', hint: 'The alarm divider feeds this analog pin.' },
      { type: 'predict_behavior', question: 'threshold = 500. The room goes dark and the reading drops to 180. What does the code do?', circuitDiagram: 'ldr_alarm', options: ['Sets ALARM LOW (off)', 'Sets ALARM HIGH (on)', 'Nothing', 'Resets the board'], correct: 1, explanation: '180 < 500 is true, so the if block runs and drives the alarm HIGH (on).' },
      { type: 'identify_component', question: 'Click the output the code drives HIGH to sound the alarm.', circuitDiagram: 'ldr_alarm', correctComponent: 'led', explanation: 'digitalWrite(ALARM, HIGH) drives the LED (or buzzer) output.' },
      { type: 'true_false', statement: 'This sketch is sense, decide, act expressed in code.', correct: true, explanation: 'Yes: analogRead senses, if decides, digitalWrite acts. The exact pattern you wired in Unit 3.' },
    ],
  },

  'Calibrating in Code': {
    xpReward: 30,
    steps: [
      { type: 'teach', title: 'Tune With the Serial Monitor', body: 'Hardware thresholds are easier to set with real numbers. Print the reading with Serial.println(reading), watch the Serial Monitor in light and in dark, then set your threshold between the two values you actually see. No guessing.' },
      { type: 'drag_order', instruction: 'Order the steps to calibrate your alarm threshold.', items: ['Print the reading with Serial.println', 'Note the value in bright light', 'Note the value in darkness', 'Set the threshold between the two', 'Test that it triggers cleanly'], correctOrder: [0, 1, 2, 3, 4] },
      { type: 'predict_reading', question: 'In light the Monitor shows ~780, in dark ~190. Which threshold is best?', options: ['770', '500', '50', '1023'], correct: 1, explanation: '500 sits cleanly between 190 (dark) and 780 (light), giving margin against noise.' },
      { type: 'multiple_choice', question: 'Why print the reading instead of guessing the threshold?', options: ['It looks professional', 'So you set it from the real values your sensor actually produces', 'It makes the LED brighter', 'It is required to compile'], correct: 1, explanation: 'Real readings vary by sensor, resistor, and room; measuring beats guessing.' },
      { type: 'true_false', statement: 'A threshold set right next to the bright reading is more reliable.', correct: false, explanation: 'No. Too close and small light changes trigger it by accident. Leave margin, sit in the middle.' },
    ],
  },

  'Unit 5 Checkpoint': {
    xpReward: 50,
    steps: [
      { type: 'multiple_choice', question: 'digitalRead() returns...', options: ['0 to 1023', 'HIGH or LOW', 'A voltage', 'The pin number'], correct: 1, explanation: 'It is a digital (two-state) read.' },
      { type: 'multiple_choice', question: 'An input pin connected to neither 5V nor ground is...', options: ['Grounded', 'Floating, and reads noisily', 'At 5V', 'Fine'], correct: 1, explanation: 'A floating pin flickers; a pull resistor fixes it.' },
      { type: 'fill_blank', prompt: 'Read analog pin A0: int v = analogRead(___);', blank: '___', answer: 'A0', hint: 'The analog pin.' },
      { type: 'predict_reading', question: 'A divider at 2.5V feeds A0. analogRead gives about...', circuitDiagram: 'voltage_divider', options: ['0', '512', '1023', 'HIGH'], correct: 1, explanation: 'Half of 5V is about half of 1023.' },
      { type: 'fill_blank', prompt: 'analogWrite brightness goes 0 to ___', blank: '___', answer: '255', hint: '8-bit.' },
      { type: 'predict_behavior', question: 'threshold 500, reading 180, in if (reading < threshold) digitalWrite(ALARM, HIGH). The alarm...', circuitDiagram: 'ldr_alarm', options: ['Stays off', 'Turns on', 'Errors', 'Fades'], correct: 1, explanation: '180 < 500 is true, so ALARM goes HIGH.' },
      { type: 'drag_order', instruction: 'Order the darkness-alarm loop().', items: ['int reading = analogRead(A0);', 'if (reading < threshold) {', 'digitalWrite(ALARM, HIGH);', '} else {', 'digitalWrite(ALARM, LOW);', '}'], correctOrder: [0, 1, 2, 3, 4, 5] },
      { type: 'true_false', statement: 'Sense, decide, act maps to analogRead, if, digitalWrite.', correct: true, explanation: 'Exactly the shape of the alarm sketch.' },
    ],
  },
};
