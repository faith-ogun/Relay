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
};
