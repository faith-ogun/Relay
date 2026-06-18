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
      { type: 'match', instruction: 'Match each term to its definition.', pairs: [['Voltage', 'Electrical pressure (measured in V)'], ['Current', 'Flow of electrons (measured in A)'], ['Resistance', 'Opposition to flow (measured in Ω)'], ['Ground', 'Reference point at 0V']] },
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
      { type: 'match', instruction: 'Match the circuit type to its current behavior.', pairs: [['Series circuit', 'Same current everywhere'], ['Parallel circuit', 'Current splits between branches'], ['Short circuit', 'Dangerously high current'], ['Open circuit', 'Zero current flow']] },
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
      { type: 'match', instruction: 'Match each quantity to its unit.', pairs: [['Voltage', 'Volts (V)'], ['Current', 'Amps (A)'], ['Resistance', 'Ohms (Ω)'], ['Power', 'Watts (W)']] },
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
      { type: 'match', instruction: 'Match the circuit type to its behavior.', pairs: [['Series', 'Same current everywhere'], ['Parallel', 'Current splits between branches'], ['Series', 'Voltage divides across parts'], ['Parallel', 'Each branch sees full voltage']] },
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
      { type: 'match', instruction: 'Match each term to what it means for the loop.', pairs: [['Closed circuit', 'Complete loop, current flows'], ['Open circuit', 'Broken loop, no current'], ['Switch', 'A controlled break in the loop'], ['Source', 'Pushes current around the loop']] },
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
      { type: 'match', instruction: 'Sort each material.', pairs: [['Copper', 'Conductor'], ['Rubber', 'Insulator'], ['Gold', 'Conductor'], ['Glass', 'Insulator']] },
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
      { type: 'match', instruction: 'Match each quantity to what it does.', pairs: [['Voltage', 'The push (pressure)'], ['Current', 'The flow rate'], ['Resistance', 'Opposition to the flow']] },
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
      { type: 'match', instruction: 'Match each colour to its digit.', pairs: [['Black', '0'], ['Brown', '1'], ['Red', '2'], ['Yellow', '4']] },
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
      { type: 'match', instruction: 'Match each measurement to how you take it.', pairs: [['Voltage', 'Across a component (parallel)'], ['Current', 'Through the path (series)'], ['Voltage unit', 'Volts'], ['Current unit', 'Amps']] },
    ],
  },
};
