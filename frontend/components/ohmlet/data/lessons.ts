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

// Difficulty tier for a question (used by leveling: Bronze favours tier 1, Silver
// tier 2, Gold tier 3). Untagged steps default to tier 1. A lesson with a deep,
// tiered pool of questions lets Bronze/Silver/Gold draw DIFFERENT, harder slices
// instead of reshuffling the same handful.
export type Difficulty = 1 | 2 | 3;
export type AuthoredStep = LessonStep & { difficulty?: Difficulty };

export const LESSON_CONTENT: Record<string, { steps: AuthoredStep[]; xpReward: number }> = {
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
      { type: 'multiple_choice', question: 'What is the #1 breadboard wiring mistake?', options: ['Using slightly the wrong wire colours', 'Both component legs in the same connected row', 'Making the jumper wires a little too long', 'Forgetting to use the power rails at all'], correct: 1, explanation: 'Placing both legs of a component in the same row short-circuits it, since all holes in a row are connected.' },
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
      { type: 'multiple_choice', question: 'Why does an LED need a series resistor?', options: ['To make the LED glow noticeably brighter', 'To limit the current and prevent burnout', 'To raise the voltage sitting across the LED', 'LEDs do not actually need one of these'], correct: 1, explanation: 'The resistor limits current to a safe level, usually around 10 to 20 mA for a standard LED.' },
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
      { type: 'multiple_choice', question: 'A short circuit is best described as...', options: ['A clean break that stops all the current', 'A low-resistance path that bypasses the load', 'A wire that is slightly longer than needed', 'A second spare battery added into the loop'], correct: 1, explanation: 'A short is an unintended low-resistance path that lets current bypass the components and spike.' },
      { type: 'true_false', statement: 'If a wire or component gets hot fast and smells, you should disconnect power immediately.', correct: true, explanation: 'Heat and smell mean too much current somewhere. Cut the power first, then find the fault.' },
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
    xpReward: 25,
    steps: [
      // Teach (Bronze shows these; Silver/Gold are pure recall).
      { type: 'teach', title: 'A Circuit Is a Loop', body: 'Current can only flow around a complete, unbroken loop: out of one terminal of the source, through your components, and back to the other terminal. Break the loop anywhere and the current stops everywhere. This single idea sits under every circuit you will ever build.', circuitDiagram: 'series_circuit', showCurrentFlow: true },
      { type: 'teach', title: 'Open vs Closed', body: 'A switch is just a controlled break in the loop.\n\n• Closed switch = complete loop = current flows.\n• Open switch = broken loop = no current.\n\nThat is all a light switch does: it opens and closes the loop.' },

      // ── Tier 1: recall ──
      { type: 'multiple_choice', difficulty: 1, question: 'What must a circuit have for current to flow?', options: ['An unbroken loop back to the source', 'A single wire leading to nowhere', 'A resistor connected on its own', 'A switch that is left wide open'], correct: 0, explanation: 'Current needs a complete loop back to the source. A path that does not return is a dead end.' },
      { type: 'true_false', difficulty: 1, statement: 'If there is one break in a single loop, current still flows in the rest of it.', correct: false, explanation: 'One break stops the current everywhere in that loop, like a missing section of track stopping the whole train.' },
      { type: 'identify_component', difficulty: 1, question: 'Click the source that pushes current around this loop.', circuitDiagram: 'series_circuit', correctComponent: 'battery', explanation: 'The battery is the source; it provides the potential difference that drives the current.' },
      { type: 'multiple_choice', difficulty: 1, question: 'An open switch does what to the loop?', options: ['Breaks the loop, so current stops', 'Completes the loop, so current flows', 'Forces the current to speed up', 'Reverses the current direction'], correct: 0, explanation: 'Open = a break in the loop = no current. Closed = a complete loop = current flows.' },
      { type: 'true_false', difficulty: 1, statement: 'A closed switch completes the loop and lets current flow.', correct: true, explanation: 'Closing the switch removes the break, so the loop is complete and current flows.' },

      // ── Tier 2: apply ──
      { type: 'predict_behavior', difficulty: 2, question: 'You snip one wire in this working loop. What happens to the LED?', circuitDiagram: 'series_circuit', options: ['It goes out completely', 'It glows a little brighter', 'It keeps glowing the same', 'It slowly shifts colour'], correct: 0, explanation: 'Snipping any wire breaks the loop, so current stops everywhere and the LED goes out.' },
      { type: 'multiple_choice', difficulty: 2, question: 'Two bulbs share one series loop. You unscrew one. What happens to the other?', options: ['It also goes out completely', 'It glows about twice as bright', 'It carries on entirely unaffected', 'It begins to flicker quickly'], correct: 0, explanation: 'A series loop has one path. Unscrewing one bulb breaks the loop, so the other goes out too.' },
      { type: 'fill_blank', difficulty: 2, prompt: 'A circuit where current flows is called a ___ circuit.', blank: '___', answer: 'closed', hint: 'It is the opposite of an open one.' },
      { type: 'multiple_choice', difficulty: 2, question: 'Where can a single switch go to control a whole series loop?', options: ['Anywhere along the single loop', 'Only right at the battery plus', 'Only directly beside the bulb', 'Somewhere outside the loop'], correct: 0, explanation: 'A series loop has one path, so a switch anywhere in it breaks the whole loop.' },
      { type: 'match', difficulty: 2, instruction: 'Match each term to what it means for the loop.', pairs: [['Closed circuit', 'Complete loop, current flows'], ['Open circuit', 'Broken loop, no current'], ['Switch', 'A controlled break in the loop'], ['Source', 'Pushes current around the loop'], ['Short circuit', 'Loop with no load, huge current']] },

      // ── Tier 3: reason ──
      { type: 'predict_behavior', difficulty: 3, question: 'A series loop has a battery, an open switch, and a bulb (off). You add a wire directly across the open switch. What happens?', circuitDiagram: 'series_circuit', options: ['The bulb lights; the wire bypasses the switch', 'Nothing happens; the bulb stays dark', 'The battery drains with no current at all', 'The bulb lights at only half brightness'], correct: 0, explanation: 'The added wire completes the loop around the open switch, so current flows and the bulb lights.' },
      { type: 'multiple_choice', difficulty: 3, question: 'A loop has a battery and a bulb, plus a stray wire joining the battery terminals directly. What happens?', options: ['Most current rushes through the stray wire', 'The bulb glows much brighter than usual', 'Both paths simply share the current evenly', 'The battery voltage suddenly doubles'], correct: 0, explanation: 'The stray wire is a near-zero-resistance path, so it hogs the current (a short) and the bulb barely lights.' },
      { type: 'spot_error', difficulty: 3, question: 'Click the path that is stealing the current away from the bulb.', circuitDiagram: 'short_circuit', correctRegion: 'short_wire', explanation: 'That wire bypasses the components with almost no resistance, so nearly all the current takes it instead.' },
      { type: 'multiple_choice', difficulty: 3, question: 'You build a loop whose only component is a plain wire from + to − (no bulb, no resistor). What happens?', options: ['A short: a very large, unsafe current flows', 'No current, because there is no resistor', 'A small safe current, the same as a bulb', 'The current reverses and charges the battery'], correct: 0, explanation: 'With nothing to limit it, the current spikes. That is a short circuit, and the wire and battery heat up fast.' },
    ],
  },

  'Conductors and Insulators': {
    xpReward: 20,
    steps: [
      { type: 'teach', title: 'What Lets Current Through', body: 'A conductor lets charge move through it easily. Metals like copper are excellent conductors, which is why wires are made of copper. An insulator resists the flow of charge: plastic, rubber, glass, and air.' },
      { type: 'multiple_choice', question: 'Which of these is a good conductor?', options: ['Rubber', 'Copper', 'Glass', 'Plastic'], correct: 1, explanation: 'Copper is an excellent conductor and the standard material for wires.' },
      { type: 'true_false', statement: 'The plastic coating around a wire is there to conduct electricity.', correct: false, explanation: 'The opposite. The plastic is an insulator. It stops the current escaping and stops wires shorting against each other.' },
      { type: 'multiple_choice', question: 'Silver actually conducts slightly better than copper. Why are wires usually copper, not silver?', options: ['Silver is a poor conductor', 'Silver is far more expensive', 'Silver does not conduct at all', 'Copper is a better conductor'], correct: 1, explanation: 'Silver is a touch better, but far too expensive for everyday wiring, so copper is the practical choice.' },
      { type: 'multiple_choice', question: 'Why does a circuit need insulators as well as conductors?', options: ['Only to make the finished circuit heavier to carry', 'To guide current where you want it and block it elsewhere', 'Because insulators make the current flow noticeably faster', 'They are purely decorative and serve no real purpose'], correct: 1, explanation: 'Conductors carry current along the intended path; insulators keep it from leaking or shorting elsewhere. You need both.' },
      { type: 'multiple_choice', question: 'What is the main reason wires are made of copper rather than another metal?', options: ['It is naturally a strong permanent magnet', 'It conducts well and stays affordable', 'It is actually a very good insulator', 'It is simply the cheapest metal that exists'], correct: 1, explanation: 'Copper conducts almost as well as silver but costs far less, so it is the practical choice for wiring.' },
      { type: 'true_false', statement: 'Dry air normally behaves as an insulator.', correct: true, explanation: 'Dry air does not conduct at everyday voltages, which is why two bare wires a small gap apart do not short through the air.' },
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
      { type: 'true_false', statement: 'A resistor is a component built to provide a specific, reliable amount of resistance.', correct: true, explanation: 'Yes. Unlike a stray length of wire, a resistor is manufactured to a known ohm value.' },
      { type: 'predict_reading', question: 'A 10V supply pushes current through a 2000Ω resistor. Using I = V / R, predict the current.', circuitDiagram: 'series_circuit', options: ['5 mA', '50 mA', '0.5 mA', '500 mA'], correct: 0, explanation: 'I = V / R = 10 / 2000 = 0.005 A = 5 mA.' },
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
      { type: 'multiple_choice', question: 'In a 4-band resistor, what does the third band tell you?', options: ['The tolerance percentage', 'The multiplier (how many zeros)', 'The maximum power rating', 'The operating temperature'], correct: 1, explanation: 'The third band is the multiplier: the power of ten to multiply the first two digits by.' },
      { type: 'fill_blank', prompt: 'Brown, Black, Orange. Digits 1 and 0 give 10, and Orange means ×1000. The value is ___ kΩ', blank: '___', answer: '10', hint: 'Apply the multiplier band, then change the ohms into kilohms.' },
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
      { type: 'multiple_choice', question: 'Why does a resistor have a power rating in watts?', options: ['It is there only to set the resistor\'s ohm value', 'It tells you how much power it can handle safely', 'It is what decides the resistor\'s colour bands', 'It serves no real purpose and can be ignored'], correct: 1, explanation: 'The rating tells you the maximum power it can safely turn into heat before it is damaged.' },
      { type: 'predict_reading', question: 'A resistor has 2V across it and 0.01A (10 mA) through it. Using P = V × I, predict the power.', circuitDiagram: 'series_circuit', options: ['0.02 W', '0.2 W', '2 W', '20 W'], correct: 0, explanation: 'P = V × I = 2 × 0.01 = 0.02 W (20 mW), well within a 1/4 W part.' },
      { type: 'true_false', statement: 'A 1/4 W resistor can safely dissipate up to about 0.25 W.', correct: true, explanation: 'Yes. The rating is the maximum power it can turn into heat before it is at risk of damage.' },
    ],
  },

  'Powering an LED Safely': {
    xpReward: 35,
    steps: [
      { type: 'teach', title: 'An LED Needs a Limit', body: 'An LED barely resists current on its own. Connect it straight across a supply and a huge current rushes through and destroys it almost instantly. A series resistor sets a safe current. A typical small LED wants around 15 to 20 mA.', circuitDiagram: 'led_no_resistor' },
      { type: 'teach', title: 'Sizing the Resistor', body: 'Use Ohm\'s law on the resistor, not the LED. The resistor drops whatever voltage the LED does not:\n\nR = (Vsupply − Vf) / I\n\nWith 5V, an LED forward voltage Vf of 2V, and a target of 15 mA:\nR = (5 − 2) / 0.015 = 200Ω → use the nearest common value, 220Ω.\n\nThe trap: forgetting to subtract Vf. Always subtract the LED drop first.' },

      // ── Tier 1: recall ──
      { type: 'spot_error', difficulty: 1, question: 'This LED will burn out. Click the problem.', circuitDiagram: 'led_no_resistor', correctRegion: 'missing_resistor', explanation: 'No current-limiting resistor, so nothing stops the current. The LED draws far too much and fails.' },
      { type: 'multiple_choice', difficulty: 1, question: 'What current does a typical small indicator LED want?', options: ['Around 15 to 20 mA', 'Around 2 amps', 'Around 200 mA', 'As much as it can take'], correct: 0, explanation: 'Most small LEDs are happy around 15 to 20 mA; the series resistor is what sets it.' },
      { type: 'true_false', difficulty: 1, statement: 'An LED should always have a series resistor to limit its current.', correct: true, explanation: 'Without one, nothing limits the current and the LED is destroyed almost instantly.' },
      { type: 'multiple_choice', difficulty: 1, question: 'In an LED circuit, the resistor\'s job is to...', options: ['Limit the current to a safe level', 'Raise the voltage across the LED', 'Change the colour of the LED', 'Store charge to smooth the supply'], correct: 0, explanation: 'The resistor sets a safe current; it does not change the LED\'s colour or voltage.' },

      // ── Tier 2: one calculation ──
      { type: 'fill_blank', difficulty: 2, prompt: 'On a 5V supply, an LED drops 2V. The resistor must drop ___ V.', blank: '___', answer: '3', hint: 'It takes whatever the LED leaves: supply minus the LED drop.' },
      { type: 'choose_resistor', difficulty: 2, question: '5V supply, LED dropping 2V, target about 15 mA. Which resistor?', circuitDiagram: 'series_circuit', options: ['22 Ω', '220 Ω', '2.2 kΩ', '22 kΩ'], correct: 1, explanation: '(5 − 2) / 0.015 = 200Ω, so 220Ω. 22Ω passes ~10× too much; the kΩ values choke it to a dim glow.' },
      { type: 'predict_reading', difficulty: 2, question: '5V supply, LED Vf 2V, a 220Ω resistor. What current flows? (I = (V−Vf)/R)', circuitDiagram: 'series_circuit', options: ['≈ 14 mA', '≈ 23 mA', '≈ 7 mA', '≈ 36 mA'], correct: 0, explanation: '(5 − 2) / 220 = 13.6 mA. Picking 23 mA means you forgot to subtract the 2V LED drop (5/220).' },
      { type: 'choose_resistor', difficulty: 2, question: 'Now a 9V supply, the same 2V LED, target ~15 mA. Which resistor?', circuitDiagram: 'series_circuit', options: ['150 Ω', '220 Ω', '470 Ω', '1 kΩ'], correct: 2, explanation: '(9 − 2) / 0.015 = 467Ω → 470Ω. The higher supply leaves more voltage for the resistor to drop, so R is larger.' },
      { type: 'predict_behavior', difficulty: 2, question: 'You grab a 22Ω resistor instead of 220Ω on that 5V LED. What happens?', circuitDiagram: 'series_circuit', options: ['Far too much current flows, risking burnout', 'Nothing changes, it is perfectly fine', 'It will not light up at all', 'It glows very faintly'], correct: 0, explanation: 'A resistor 10× too small passes ~10× the current (~136 mA), far over the LED\'s limit. It runs hot and can fail.' },

      // ── Tier 3: multi-step reasoning ──
      { type: 'predict_reading', difficulty: 3, question: 'A red LED has Vf 1.8V. On 5V through a 330Ω resistor, the current is closest to:', circuitDiagram: 'series_circuit', options: ['≈ 10 mA', '≈ 15 mA', '≈ 6 mA', '≈ 20 mA'], correct: 0, explanation: '(5 − 1.8) / 330 = 9.7 mA ≈ 10 mA. The 15 mA answer is the classic slip of forgetting Vf (5/330).' },
      { type: 'choose_resistor', difficulty: 3, question: 'Two red LEDs (Vf 1.8V each) in SERIES on 5V, target ~12 mA. Pick the resistor.', circuitDiagram: 'series_circuit', options: ['120 Ω', '47 Ω', '390 Ω', '1 kΩ'], correct: 0, explanation: 'Two in series drop 3.6V, leaving 1.4V. R = 1.4 / 0.012 = 117Ω → 120Ω. You must add both LED drops first.' },
      { type: 'predict_reading', difficulty: 3, question: 'Those two series LEDs (3.6V total) on 5V through a 120Ω resistor draw about:', circuitDiagram: 'series_circuit', options: ['≈ 12 mA', '≈ 42 mA', '≈ 28 mA', '≈ 6 mA'], correct: 0, explanation: '(5 − 3.6) / 120 = 11.7 mA ≈ 12 mA. The 42 mA answer ignores both LED drops (5/120).' },
      { type: 'multiple_choice', difficulty: 3, question: 'A 220Ω resistor drops 3V at 14 mA. Its power, and is a 1/4 W part OK?', options: ['≈ 42 mW, fine for a 1/4 W part', '≈ 420 mW, too much for 1/4 W', '≈ 3 W, it needs a big resistor', '≈ 0.5 mW, basically nothing'], correct: 0, explanation: 'P = V × I = 3 × 0.014 = 0.042 W = 42 mW, comfortably under the 250 mW a 1/4 W resistor handles.' },
      { type: 'fill_blank', difficulty: 3, prompt: 'An LED drops 2V at 20 mA. Its power use, P = V × I, is ___ W.', blank: '___', answer: '0.04', hint: 'Volts times amps; convert the milliamps to amps first.' },
    ],
  },

  'Measuring Your Circuit': {
    xpReward: 30,
    steps: [
      { type: 'teach', title: 'The Multimeter', body: 'A multimeter measures your circuit. The two readings you will use most:\n\n• Voltage: measured ACROSS a component (the meter goes in parallel with it).\n• Current: measured THROUGH the path (the meter goes in series, in the loop).' },
      { type: 'multiple_choice', question: 'To measure the voltage across a resistor, how do you connect the meter?', options: ['In series with the loop, breaking it to insert the meter', 'Across the resistor, with the meter in parallel', 'Only ever directly onto the two battery terminals', 'It genuinely does not matter which way round it goes'], correct: 1, explanation: 'Voltage is a difference between two points, so you measure it across the component, with the meter in parallel.' },
      { type: 'multiple_choice', question: 'To measure the current through a circuit, how do you connect the meter?', options: ['Across one component, with the meter sitting in parallel', 'In series, so the current flows through it', 'Connected across the battery terminals only, nowhere else', 'Just touching one single wire at one point'], correct: 1, explanation: 'Current is the flow through the path, so you break the loop and put the meter in series so the same current flows through it.' },
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
      { type: 'multiple_choice', question: 'Why feed power to the rails first, rather than to one component?', options: ['Only because it makes the layout look neater', 'So + and − are available anywhere on the board', 'Because powering the rails makes components run faster', 'It is strictly required by some electrical law'], correct: 1, explanation: 'With the rails powered, any component can grab + or − from the nearest hole, keeping wiring short and tidy.' },
      { type: 'identify_component', question: 'Click the part of this board that carries the positive supply.', circuitDiagram: 'breadboard_layout', correctComponent: 'power_rail', explanation: 'The + rail runs along the edge and feeds the whole board.' },
      { type: 'true_false', statement: 'The two long side rails are usually used for power and ground.', correct: true, explanation: 'The edge rails distribute + and − along the whole board.' },
      { type: 'multiple_choice', question: 'You connect + to the red rail and − to the blue rail. A component mid-board can now...', options: ['Only get power if it sits right on the rail', 'Tap + or − with a short jumper to a rail', 'Never receive any power at all this way', 'Draw power only from the centre gap'], correct: 1, explanation: 'With the rails powered, a short jumper brings + or − to any row on the board.' },
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
      { type: 'multiple_choice', question: 'A jumper wire from the + rail to row 10 does what?', options: ['Nothing at all, jumpers are just decorative', 'Brings the positive supply to row 10', 'Creates a dangerous short across the board', 'Removes any power that row 10 already had'], correct: 1, explanation: 'The jumper carries + from the rail to that row, so components in row 10 can use it.' },
      { type: 'multiple_choice', question: 'Why is solid-core wire preferred over stranded for a breadboard?', options: ['It is a much better electrical conductor overall', 'It pushes cleanly into holes and holds its shape', 'It is the only wire type that carries current', 'Stranded wire is actually illegal to use indoors'], correct: 1, explanation: 'Solid-core inserts neatly and stays put; stranded frays in the holes.' },
      { type: 'true_false', statement: 'Short, flat jumpers that hug the board are easier to trace and debug.', correct: true, explanation: 'A tidy layout lets you follow the circuit and spot a wrong connection at a glance.' },
      { type: 'drag_order', instruction: 'Order the steps to power a component row from the rail.', items: ['Connect the supply to the + and − rails', 'Run a jumper from the + rail to the component row', 'Place the component in that row', 'Run a jumper from the component to the − rail'], correctOrder: [0, 1, 2, 3] },
    ],
  },

  'From Schematic to Breadboard': {
    xpReward: 25,
    steps: [
      { type: 'teach', title: 'Two Views of One Circuit', body: 'A schematic shows what connects to what using symbols, ignoring physical layout. A breadboard build is the physical version. Same circuit, two views. Learning to translate between them is the core breadboarding skill.', circuitDiagram: 'series_circuit' },
      { type: 'multiple_choice', question: 'What does a schematic show?', options: ['The exact physical positions of every part on the board', 'Which components connect to which, using symbols', 'Only the colours that the wires happen to be', 'The price you actually paid for each part'], correct: 1, explanation: 'A schematic captures the connections and components, not their physical placement.' },
      { type: 'identify_component', question: 'In this schematic, click the LED.', circuitDiagram: 'series_circuit', correctComponent: 'led', explanation: 'The triangle-and-bar symbol is the LED.' },
      { type: 'true_false', statement: 'A schematic and a breadboard build of the same circuit must look physically identical.', correct: false, explanation: 'No. They represent the same connections, but the schematic is a tidy diagram and the breadboard is the physical layout.' },
      { type: 'drag_order', instruction: 'Order the steps to turn a simple series schematic into a build.', items: ['Read the schematic and list the components', 'Power the breadboard rails', 'Place each component spanning different rows', 'Add jumpers to match the schematic connections', 'Check it against the schematic before powering on'], correctOrder: [0, 1, 2, 3, 4] },
      { type: 'multiple_choice', question: 'What is the #1 breadboard placement mistake?', options: ['Choosing slightly the wrong colour of jumper wire', 'Both legs of a component in the same connected row', 'Making the connecting wires a touch too short', 'Remembering to power the rails before testing'], correct: 1, explanation: 'Both legs in one connected row short the component out, since all holes in that row are joined.' },
      { type: 'true_false', statement: 'A schematic and the breadboard build of the same circuit can look physically different.', correct: true, explanation: 'They share the same connections; the schematic is a tidy diagram, the breadboard is the physical layout.' },
      { type: 'identify_component', question: 'In this schematic, click the resistor.', circuitDiagram: 'series_circuit', correctComponent: 'resistor', explanation: 'The zig-zag symbol is the resistor.' },
    ],
  },

  'Build a Series LED Circuit': {
    xpReward: 30,
    steps: [
      { type: 'teach', title: 'Your First Build', body: 'A series LED circuit is the classic first build: power, a current-limiting resistor, the LED, and back to ground. One loop, one current. Let us wire it.', circuitDiagram: 'series_circuit', showCurrentFlow: true },
      { type: 'draw_connection', instruction: 'Wire the loop: power to the resistor, resistor to the LED, LED to ground.', terminals: [{ x: 60, y: 50, label: '5V', id: 'power' }, { x: 160, y: 50, label: 'R', id: 'resistor_in' }, { x: 250, y: 50, label: 'R', id: 'resistor_out' }, { x: 320, y: 50, label: 'LED', id: 'led' }, { x: 320, y: 200, label: 'GND', id: 'ground' }], expectedConnections: [['power', 'resistor_in'], ['resistor_out', 'led'], ['led', 'ground']], explanation: 'Power → resistor → LED → ground. The resistor must come before the LED to limit current.' },
      { type: 'multiple_choice', question: 'Why does the resistor go before the LED?', options: ['Mostly because it simply looks neater that way', 'To limit the current through the LED', 'To raise the voltage across the LED itself', 'It honestly does not matter where it goes'], correct: 1, explanation: 'The resistor limits current to protect the LED. Order in a series loop does not change the current, but the resistor must be present.' },
      { type: 'spot_error', question: 'The build does not light. Click the issue.', circuitDiagram: 'reversed_led', correctRegion: 'reversed_led', explanation: 'The LED is reversed. Flip it so current can flow anode to cathode.' },
      { type: 'predict_behavior', question: 'You wired it correctly and apply power. What happens?', circuitDiagram: 'series_circuit', options: ['Nothing', 'The LED lights up', 'The resistor explodes', 'The battery reverses'], correct: 1, explanation: 'A correct series loop with a proper resistor lights the LED safely.' },
      { type: 'multiple_choice', question: 'In a working series LED circuit, the path goes...', options: ['Power, then straight to the LED, then ground', 'Power, resistor, LED, then back to ground', 'Power, then ground, skipping past the LED', 'LED first, then the power, then the resistor'], correct: 1, explanation: 'Power → resistor → LED → ground: the resistor limits the LED current.' },
      { type: 'spot_error', question: 'This LED build draws too much current. Click the problem.', circuitDiagram: 'led_no_resistor', correctRegion: 'missing_resistor', explanation: 'There is no current-limiting resistor, so the LED draws far too much current.' },
      { type: 'true_false', statement: 'In this series loop, the same current flows through the resistor and the LED.', correct: true, explanation: 'Yes. One loop means one current, equal through every component.' },
    ],
  },

  'Build a Parallel Circuit': {
    xpReward: 30,
    steps: [
      { type: 'teach', title: 'Two Branches', body: 'In parallel, each LED gets its own branch and its own resistor, and each branch sees the full supply voltage. The supply current is the sum of the branch currents.', circuitDiagram: 'parallel_circuit', showCurrentFlow: true },
      { type: 'multiple_choice', question: 'For two LEDs at equal brightness in parallel, you should use...', options: ['One shared resistor for both', 'A resistor in each branch', 'No resistors', 'One resistor in series with the battery only'], correct: 1, explanation: 'A resistor per branch sets each LED current independently, keeping them matched.' },
      { type: 'identify_component', question: 'Click a resistor in one of the parallel branches.', circuitDiagram: 'parallel_circuit', correctComponent: 'r1', explanation: 'Each branch has its own resistor.' },
      { type: 'predict_behavior', question: 'You put a single resistor in the shared part and run two LEDs in parallel after it. What is the risk?', circuitDiagram: 'parallel_circuit', options: ['Nothing at all, it is actually the ideal arrangement', 'The LEDs may glow unevenly and share current poorly', 'The supply voltage suddenly doubles across them', 'The battery begins to recharge itself instead'], correct: 1, explanation: 'Sharing one resistor lets the LEDs fight over current, so they often light unevenly. A resistor per branch fixes it.' },
      { type: 'true_false', statement: 'Each branch of a parallel circuit sees the full supply voltage.', correct: true, explanation: 'Yes. Voltage is the same across parallel branches; the current is what splits.' },
      { type: 'true_false', statement: 'In a parallel circuit, each branch sees the full supply voltage.', correct: true, explanation: 'Voltage is the same across parallel branches; the current is what splits.' },
      { type: 'multiple_choice', question: 'Three LEDs each in their own parallel branch with their own resistor. One LED fails open. The others...', options: ['All go out together at the same moment', 'Keep glowing exactly as before', 'Glow much brighter than they did', 'Cause the battery to short out'], correct: 1, explanation: 'Parallel branches are independent, so one open branch does not affect the others.' },
      { type: 'fill_blank', prompt: 'Two parallel branches each draw 10 mA. The supply provides ___ mA total.', blank: '___', answer: '20', hint: 'Parallel branch currents add together.' },
    ],
  },

  'Switches in a Circuit': {
    xpReward: 25,
    steps: [
      { type: 'teach', title: 'A Controlled Break', body: 'A switch is a controlled break in the loop. Closed, it completes the circuit and current flows. Open, it breaks the loop and current stops. A momentary (pushbutton) switch is only closed while pressed; a toggle switch stays where you flip it.' },
      { type: 'multiple_choice', question: 'What happens when a switch in a series loop is open?', options: ['The current actually increases through the loop', 'Current stops, because the loop is now broken', 'The supply voltage across the loop doubles', 'Nothing changes and the current keeps flowing'], correct: 1, explanation: 'An open switch breaks the loop, so no current flows.' },
      { type: 'predict_behavior', question: 'An LED is lit. You open the switch in its loop. What happens?', circuitDiagram: 'series_circuit', options: ['It gets brighter', 'It goes out', 'It changes colour', 'Nothing'], correct: 1, explanation: 'Opening the switch breaks the loop, so the LED goes out.' },
      { type: 'true_false', statement: 'A momentary pushbutton stays closed after you release it.', correct: false, explanation: 'No. A momentary switch is closed only while pressed; a toggle switch stays put.' },
      { type: 'multiple_choice', question: 'Where should a switch go to control a whole series loop?', options: ['Anywhere in the loop', 'Only next to the battery + terminal', 'Only next to the LED', 'Outside the loop'], correct: 0, explanation: 'A series loop has one path, so a switch anywhere in it breaks the whole loop.' },
      { type: 'true_false', statement: 'A closed switch completes the loop and lets current flow.', correct: true, explanation: 'Closing the switch removes the break, so current flows.' },
      { type: 'predict_behavior', question: 'A toggle switch is flipped to closed in an LED loop. What does the LED do?', circuitDiagram: 'series_circuit', options: ['Stays off, since the loop is still broken', 'Lights up, the loop is now complete', 'Burns out instantly from the switch', 'Flickers a few times and then stops'], correct: 1, explanation: 'Closing the switch completes the loop, so the LED lights.' },
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
      { type: 'multiple_choice', question: 'You put both legs of a resistor in the same connected breadboard row. What happens?', options: ['It works perfectly fine just as you intended', 'The resistor is shorted out and does nothing', 'The total resistance in the row is doubled', 'The breadboard itself is permanently broken'], correct: 1, explanation: 'All holes in a row are joined, so both legs in one row short across the resistor, bypassing it.' },
      { type: 'multiple_choice', question: 'A build does nothing and one jumper looks loose. The likely cause is...', options: ['The wrong colour of jumper wire was used', 'A broken loop from the loose jumper', 'The breadboard is simply too cold to work', 'The LED happens to be far too bright'], correct: 1, explanation: 'A loose jumper breaks the loop, and the whole circuit goes dead.' },
      { type: 'spot_error', question: 'This LED is wired the wrong way round. Click it.', circuitDiagram: 'reversed_led', correctRegion: 'reversed_led', explanation: 'The LED is reversed; flip it so current can flow anode to cathode.' },
      { type: 'true_false', statement: 'A reversed LED will still light, just more dimly.', correct: false, explanation: 'No. Reversed, an LED blocks current and stays completely dark.' },
    ],
  },

  'Debugging a Dead Circuit': {
    xpReward: 30,
    steps: [
      { type: 'teach', title: 'Work the Loop', body: 'When nothing happens, debug calmly and in order: check power first, then the loop is complete, then component orientation, then values. Most dead circuits are a broken loop or a reversed part, not a faulty component.' },
      { type: 'drag_order', instruction: 'Order a sensible debugging sequence for a dead circuit.', items: ['Confirm power reaches the rails', 'Check the loop is complete (no gaps)', 'Check component orientation (LED polarity)', 'Check resistor and component values', 'Measure with a multimeter to confirm'], correctOrder: [0, 1, 2, 3, 4] },
      { type: 'multiple_choice', question: 'An LED build does nothing. What is the most likely cause to check first?', options: ['A faulty LED', 'No power or a broken loop', 'The wrong brand of wire', 'Room temperature'], correct: 1, explanation: 'Dead-circuit faults are usually no power or a broken loop, check those before blaming a component.' },
      { type: 'predict_reading', question: 'You measure 0V across the whole circuit even though the supply is on. What does that suggest?', circuitDiagram: 'series_circuit', options: ['Everything is fine and working correctly', 'Power is not reaching the circuit (a break before it)', 'The LED is glowing far too brightly here', 'The resistor value is simply a little too small'], correct: 1, explanation: 'No voltage across the circuit means power is not getting in, likely a break or disconnected rail upstream.' },
      { type: 'true_false', statement: 'A loose jumper wire can make a whole circuit appear dead.', correct: true, explanation: 'Yes. One loose connection breaks the loop, and the whole circuit stops.' },
      { type: 'multiple_choice', question: 'When debugging a dead circuit, what should you check FIRST?', options: ['The brand name printed on the resistor', 'That power actually reaches the rails', 'The colour of every single jumper wire', 'The temperature of the room around it'], correct: 1, explanation: 'Confirm power first; most dead circuits are no power or a broken loop.' },
      { type: 'true_false', statement: 'A single loose connection can make an entire circuit appear dead.', correct: true, explanation: 'One break in the loop stops current everywhere, so the whole circuit goes dead.' },
      { type: 'match', instruction: 'Match each symptom to its likely cause.', pairs: [['Nothing happens', 'Broken loop or no power'], ['LED dark but circuit powered', 'LED reversed'], ['Wire gets hot', 'Short circuit'], ['LED very dim', 'Resistor too large'], ['LED burned out', 'Resistor missing or too small']] },
    ],
  },

  'Unit 2 Checkpoint': {
    xpReward: 50,
    steps: [
      { type: 'multiple_choice', question: 'The long edge strips of a breadboard are normally used for...', options: ['Holding the components firmly in place', 'Power (+) and ground (−)', 'Printed labels and nothing else', 'Nothing at all, they go unused'], correct: 1, explanation: 'The edge rails distribute + and − across the board.' },
      { type: 'true_false', statement: 'All holes along one power rail are connected together.', correct: true, explanation: 'Yes, a rail is one connected strip.' },
      { type: 'identify_component', question: 'Click the LED in this schematic.', circuitDiagram: 'series_circuit', correctComponent: 'led', explanation: 'The triangle-and-bar symbol is the LED.' },
      { type: 'spot_error', question: 'Click the fault in this circuit.', circuitDiagram: 'short_circuit', correctRegion: 'short_wire', explanation: 'A wire shorts across the load.' },
      { type: 'predict_behavior', question: 'You open the switch in a lit LED loop. What happens?', circuitDiagram: 'series_circuit', options: ['Brighter', 'It goes out', 'No change', 'It flickers faster'], correct: 1, explanation: 'Opening the switch breaks the loop; the LED goes out.' },
      { type: 'multiple_choice', question: 'Both legs of a component land in the same connected row. Result?', options: ['It works perfectly fine as intended', 'The component is shorted out', 'The resistance is doubled instead', 'The whole board is now broken'], correct: 1, explanation: 'A connected row joins both legs, shorting the component.' },
      { type: 'drag_order', instruction: 'Order a sensible debugging sequence.', items: ['Check power reaches the rails', 'Check the loop is complete', 'Check component orientation', 'Check component values'], correctOrder: [0, 1, 2, 3] },
      { type: 'match', instruction: 'Match symptom to cause.', pairs: [['Nothing happens', 'Broken loop or no power'], ['LED dark, powered', 'LED reversed'], ['Wire gets hot', 'Short circuit'], ['LED burned out', 'No current-limiting resistor']] },
    ],
  },

  // ═══════════════════════ Unit 3: Sensors & Signals ═══════════════════════

  'Potentiometers': {
    xpReward: 25,
    steps: [
      { type: 'teach', title: 'An Adjustable Resistor', body: 'A potentiometer (pot) is a resistor you can turn. Inside is a track of resistance and a sliding contact called the wiper. Turning the knob moves the wiper, changing the resistance between the wiper and each end. It lets you vary voltage and current by hand.', circuitDiagram: 'voltage_divider' },
      { type: 'multiple_choice', question: 'What does the wiper in a potentiometer do?', options: ['Stores electrical charge on two internal plates', 'Slides along the track to change the resistance', 'Generates its own voltage out of nothing at all', 'Blocks the current through the part entirely'], correct: 1, explanation: 'The wiper taps a point along the resistive track, setting the resistance from the wiper to each end.' },
      { type: 'teach', title: 'A Pot Is a Divider', body: 'Wire the two ends of a pot across your supply and the wiper becomes the midpoint of a voltage divider you can turn. That is why pots are used as volume knobs and to set adjustable thresholds.', circuitDiagram: 'voltage_divider' },
      { type: 'predict_behavior', question: 'You turn the pot so the wiper moves toward the + end. What happens to the wiper voltage?', circuitDiagram: 'voltage_divider', options: ['It rises toward the supply voltage', 'It drops all the way down to zero volts', 'It stays completely fixed wherever it was', 'It becomes a negative voltage below ground'], correct: 0, explanation: 'Moving the wiper toward + gives it a larger share of the supply, so its voltage rises.' },
      { type: 'true_false', statement: 'A potentiometer lets you vary resistance by turning a shaft.', correct: true, explanation: 'Yes. The wiper position sets the resistance, so turning the knob varies it.' },
      { type: 'true_false', statement: 'Wiring a pot\'s two ends across the supply turns it into an adjustable voltage divider.', correct: true, explanation: 'The wiper then taps an adjustable midpoint voltage, which is how a volume knob works.' },
      { type: 'multiple_choice', question: 'A potentiometer is commonly used as a...', options: ['Permanent fixed resistor that never changes value', 'Volume knob or adjustable threshold control', 'Source of its own power for the whole circuit', 'One-way valve for current, much like a diode'], correct: 1, explanation: 'A pot sets an adjustable voltage or resistance by hand: volume knobs, dimmers, thresholds.' },
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
      { type: 'predict_behavior', question: 'You put an LDR in a voltage divider and cover it with your hand. Its resistance rises. What does the divider output do (with the LDR on top)?', circuitDiagram: 'voltage_divider', options: ['The output voltage changes as the LDR resistance changes', 'Nothing ever changes no matter what you do to it', 'The supply voltage itself rises higher than before', 'The whole circuit shorts out and stops working'], correct: 0, explanation: 'As the LDR resistance changes with light, it takes a different share of the voltage, so the divider output moves. That is how it senses light.' },
      { type: 'true_false', statement: 'An LDR is non-polarised, so either leg can face either way.', correct: true, explanation: 'It is a passive resistor whose value changes with light; orientation does not matter.' },
      { type: 'multiple_choice', question: 'Which material is a common LDR made from?', options: ['Pure copper wire wound around a magnetic core', 'A semiconductor such as cadmium sulfide', 'A thin ceramic disc used as an insulator', 'A coil of thin insulated magnet wire'], correct: 1, explanation: 'LDRs use a light-sensitive semiconductor like cadmium sulfide; light frees charge carriers and drops its resistance.' },
    ],
  },

  'Thermistors': {
    xpReward: 25,
    steps: [
      { type: 'teach', title: 'A Temperature-Controlled Resistor', body: 'A thermistor is a resistor whose value changes with temperature. The common NTC type (negative temperature coefficient) drops in resistance as it gets hotter. Like the LDR, it is a passive, non-polarised sensor you read with a voltage divider.' },
      { type: 'multiple_choice', question: 'For a common NTC thermistor, as temperature rises its resistance...', options: ['Rises', 'Falls', 'Stays the same', 'Becomes negative'], correct: 1, explanation: 'NTC means negative temperature coefficient: resistance falls as temperature rises.' },
      { type: 'true_false', statement: 'A thermistor and an LDR are both resistors whose value is changed by the world around them.', correct: true, explanation: 'Yes. One responds to temperature, the other to light, but both are variable resistors you read with a divider.' },
      { type: 'multiple_choice', question: 'How do you read a thermistor\'s resistance as a voltage?', options: ['Connect it straight across the 5V supply rail', 'Put it in a voltage divider with a fixed resistor', 'Wire it up and use it just like an LED', 'You simply cannot read it as a voltage at all'], correct: 1, explanation: 'A divider turns the changing resistance into a changing voltage a pin can read, just like the LDR.' },
      { type: 'predict_behavior', question: 'An NTC thermistor in a divider is warmed with your fingers, so its resistance falls. The divider output (thermistor on top)...', circuitDiagram: 'voltage_divider', options: ['Changes as the resistance falls', 'Stays perfectly still and fixed', 'Climbs far above the supply rail', 'Drops to a negative voltage level'], correct: 0, explanation: 'As the thermistor resistance falls with heat, its share of the voltage changes, so the divider output moves.' },
      { type: 'true_false', statement: 'A thermistor is a passive, non-polarised component, like a resistor.', correct: true, explanation: 'Yes. Either leg can face either way; only its resistance-with-temperature matters.' },
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
      { type: 'multiple_choice', question: 'Why can\'t a microcontroller read a sensor\'s resistance directly?', options: ['Its pins measure voltage, not resistance itself', 'Resistance is far too small a quantity to measure', 'Sensors deliberately hide their resistance value', 'It can read it directly; the divider is pointless'], correct: 0, explanation: 'Analog pins read voltage. A divider converts the changing resistance into a voltage the pin can read.' },
      { type: 'predict_reading', question: 'LDR on top (low resistance in bright light, say 2kΩ), 10kΩ on the bottom, 5V. In bright light the midpoint is closest to...', circuitDiagram: 'voltage_divider', options: ['About 4 V', 'About 1 V', 'About 0 V', 'Exactly 5 V'], correct: 0, explanation: 'Vout = 5 × 10k/(2k+10k) ≈ 4.2 V. Bright light drops the LDR, so the bottom resistor keeps most of the voltage.' },
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
      { type: 'multiple_choice', question: 'A digital signal has how many states?', options: ['A whole continuous range of in-between values', 'Just two: HIGH or LOW', 'Exactly ten fixed voltage levels', 'Anything from 0 right up to 1023'], correct: 1, explanation: 'Digital is two-state, HIGH or LOW. The continuous range and 0 to 1023 belong to analog reads.' },
      { type: 'true_false', statement: 'A light sensor reading brightness is an analog signal.', correct: true, explanation: 'Brightness varies continuously, so it is analog, unlike a two-state button.' },
      { type: 'match', instruction: 'Sort each signal.', pairs: [['Push button', 'Digital'], ['Light level', 'Analog'], ['On/off switch', 'Digital'], ['Temperature', 'Analog'], ['Volume knob', 'Analog']] },
    ],
  },

  'Planning the Light Alarm': {
    xpReward: 30,
    steps: [
      { type: 'teach', title: 'The Whole System', body: 'The Light-Activated Alarm has three parts: a SENSE stage (an LDR voltage divider), a DECIDE stage (compare the reading to a threshold), and an ACT stage (turn on an LED or buzzer). Sense, decide, act: the shape of almost every useful circuit.', circuitDiagram: 'ldr_alarm' },
      { type: 'multiple_choice', question: 'What is the job of the sense stage in the alarm?', options: ['To make the alarm noise at the output', 'Turn the light level into a voltage to read', 'To limit the current going to the output LED', 'To store power for later use in the circuit'], correct: 1, explanation: 'The LDR divider senses light and turns it into a readable voltage.' },
      { type: 'drag_order', instruction: 'Order the three stages of the alarm.', items: ['Sense the light (LDR divider)', 'Decide (compare to a threshold)', 'Act (LED or buzzer on)'], correctOrder: [0, 1, 2] },
      { type: 'identify_component', question: 'Click the part that produces the alarm output.', circuitDiagram: 'ldr_alarm', correctComponent: 'led', explanation: 'The LED (or a buzzer) is the act stage, the alarm output.' },
      { type: 'match', instruction: 'Match each stage to its component.', pairs: [['Sense', 'LDR + resistor divider'], ['Decide', 'Threshold comparison'], ['Act', 'LED or buzzer'], ['Read point', 'Analog pin A0']] },
      { type: 'true_false', statement: 'Sense, decide, act is a pattern you will reuse in many circuits.', correct: true, explanation: 'Yes. Most useful builds sense something, decide based on it, and act.' },
      { type: 'multiple_choice', question: 'In the alarm, which stage compares the reading to a threshold?', options: ['The sense stage out at the LDR', 'The decide stage', 'The act stage at the output LED', 'The power supply feeding the board'], correct: 1, explanation: 'Decide compares the sensed value to the threshold and chooses whether to act.' },
      { type: 'drag_order', instruction: 'Order the three stages of the alarm.', items: ['Sense the light (LDR divider)', 'Decide against a threshold', 'Act (LED or buzzer on)'], correctOrder: [0, 1, 2] },
    ],
  },

  'Setting the Threshold': {
    xpReward: 30,
    steps: [
      { type: 'teach', title: 'Where to Draw the Line', body: 'The threshold is the reading at which the alarm flips from off to on. Set it between the typical bright reading and the typical dark reading. Too close to one and it triggers by accident; well between them and it is reliable.' },
      { type: 'predict_behavior', question: 'In bright light the LDR divider reads about 800, and in darkness about 200. Where is a sensible threshold for a darkness alarm?', options: ['Around 950', 'Around 500', 'Around 50', 'Exactly 1023'], correct: 1, explanation: 'A threshold around 500 sits comfortably between 200 (dark) and 800 (light), so it triggers cleanly when it gets dark.' },
      { type: 'multiple_choice', question: 'You set the threshold at 790, just below the bright reading of 800. What is the risk?', options: ['It is perfectly placed and works ideally', 'A tiny dip in light triggers it by accident', 'It will never trigger under any conditions', 'It slowly damages the LDR over time'], correct: 1, explanation: 'A threshold hugging the bright reading triggers on the smallest shadow. Leave a margin.' },
      { type: 'predict_behavior', question: 'Darkness alarm with threshold 500. The room goes dark and the reading falls to 200. What does the alarm do?', circuitDiagram: 'ldr_alarm', options: ['Stays off', 'Turns on', 'Explodes', 'Resets the board'], correct: 1, explanation: 'The reading (200) dropped below the threshold (500), so the decide stage fires the alarm.' },
      { type: 'true_false', statement: 'A good threshold sits roughly between the bright and dark readings.', correct: true, explanation: 'Yes. Midway gives margin against noise and accidental triggers.' },
      { type: 'fill_blank', prompt: 'Bright reads 800, dark reads 200. A safe middle threshold is about ___', blank: '___', answer: '500', hint: 'Pick a value roughly midway between the bright and dark readings.' },
      { type: 'predict_behavior', question: 'Threshold 500, bright reading 800. The light stays bright. The darkness alarm...', circuitDiagram: 'ldr_alarm', options: ['Stays off, the reading is above the threshold', 'Turns on right away regardless', 'Flickers on and off continuously', 'Resets the whole board each time'], correct: 0, explanation: '800 is above 500, so the alarm stays off until it gets dark.' },
      { type: 'true_false', statement: 'A threshold set too close to the dark reading may never trigger reliably.', correct: true, explanation: 'Hugging either extreme is risky; sit the threshold comfortably between bright and dark.' },
    ],
  },

  'Wiring the Light Alarm': {
    xpReward: 35,
    steps: [
      { type: 'teach', title: 'Bring It Together', body: 'Time to wire the full alarm: the LDR and a 10kΩ resistor form the divider, the midpoint goes to the analog pin, and the LED (with its own resistor) is the output. This is the capstone of everything so far.', circuitDiagram: 'ldr_alarm' },
      { type: 'draw_connection', instruction: 'Wire the LDR divider: 5V to the LDR, LDR to the junction, junction to the 10kΩ resistor, resistor to ground, and the junction to A0.', terminals: [{ x: 60, y: 40, label: '5V', id: 'vcc' }, { x: 180, y: 40, label: 'LDR', id: 'ldr' }, { x: 300, y: 40, label: 'A0', id: 'a0' }, { x: 180, y: 140, label: '10kΩ', id: 'res' }, { x: 180, y: 240, label: 'GND', id: 'gnd' }], expectedConnections: [['vcc', 'ldr'], ['ldr', 'a0'], ['ldr', 'res'], ['res', 'gnd']], explanation: '5V → LDR → junction → 10kΩ → GND, with the junction also feeding A0. The divider midpoint is what the pin reads.' },
      { type: 'identify_component', question: 'Click the component that limits current to the output LED.', circuitDiagram: 'ldr_alarm', correctComponent: 'led_resistor', explanation: 'The series resistor on the LED branch limits its current, just like every LED you have wired.' },
      { type: 'spot_error', question: 'The alarm LED never lights even when triggered. Click the likely wiring fault.', circuitDiagram: 'reversed_led', correctRegion: 'reversed_led', explanation: 'The output LED is reversed. Flip it so current can flow.' },
      { type: 'predict_behavior', question: 'Everything is wired and the threshold is set. You cover the LDR. What happens?', circuitDiagram: 'ldr_alarm', options: ['Nothing happens at all when you cover it', 'The reading falls below the threshold and the LED turns on', 'The LDR overheats and burns out completely', 'The supply voltage suddenly doubles in value'], correct: 1, explanation: 'Covering the LDR raises its resistance, the reading drops past the threshold, and the act stage lights the LED.' },
      { type: 'identify_component', question: 'Click the light-sensing component in the alarm.', circuitDiagram: 'ldr_alarm', correctComponent: 'ldr', explanation: 'The LDR senses light; its changing resistance moves the divider voltage.' },
      { type: 'multiple_choice', question: 'In the wired alarm, what does the output LED need in series?', options: ['Its own current-limiting resistor', 'A second LDR to control the current', 'Nothing, it connects up directly', 'A large smoothing electrolytic capacitor'], correct: 0, explanation: 'Like every LED, the output LED needs a series resistor to limit its current.' },
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
      { type: 'multiple_choice', question: 'What is a microcontroller?', options: ['A special high-power type of resistor', 'A small computer on a chip that runs your program', 'A kind of small rechargeable battery cell', 'A little display screen for showing text'], correct: 1, explanation: 'It is a tiny programmable computer that reads inputs, runs your code, and drives outputs.' },
      { type: 'true_false', statement: 'An Arduino keeps running the last program you uploaded, even after you unplug your computer.', correct: true, explanation: 'Yes. The program is stored on the board, so it runs whenever the Arduino has power.' },
      { type: 'multiple_choice', question: 'Which best describes what an Arduino does in a project?', options: ['Reads inputs, runs code, drives outputs', 'Does nothing except light up a single LED', 'Only stores data and never acts on anything', 'Generates all of its own electrical power'], correct: 0, explanation: 'Sense, decide, act, exactly the pattern from the light alarm, now in code.' },
      { type: 'true_false', statement: 'An Arduino keeps running its stored program even after the computer is unplugged, as long as it has power.', correct: true, explanation: 'The program lives on the board and runs whenever it is powered.' },
      { type: 'multiple_choice', question: 'A microcontroller needs which of these to do its job?', options: ['A keyboard and a large monitor screen', 'Input pins, your code, and output pins', 'A spinning hard disk drive inside it', 'A constant live internet connection'], correct: 1, explanation: 'It reads inputs, runs your uploaded code, and drives outputs, no screen or keyboard required.' },
      { type: 'match', instruction: 'Match each idea to the alarm you already built.', pairs: [['Input pin', 'Reads the LDR voltage'], ['Your code', 'Decides against the threshold'], ['Output pin', 'Drives the LED or buzzer'], ['The board', 'Runs it all on its own']] },
    ],
  },

  'The Arduino Pins': {
    xpReward: 25,
    steps: [
      { type: 'teach', title: 'The Rows of Pins', body: 'An Arduino Uno has a few kinds of pin:\n\n• Digital pins (0 to 13): on/off, HIGH or LOW.\n• Analog input pins (A0 to A5): read a voltage from 0 to 5V.\n• Power pins: 5V, 3.3V, and GND (ground).\n\nYou wire your circuit to these pins and address each one in code.', circuitDiagram: 'ldr_alarm' },
      { type: 'multiple_choice', question: 'Which pins read a continuously varying voltage from a sensor?', options: ['The digital pins, numbered 0 through 13', 'Analog input pins A0 to A5', 'The single 5V power output pin', 'The ground (GND) reference pin'], correct: 1, explanation: 'Analog input pins (A0 to A5) measure voltages from 0 to 5V, ideal for sensors.' },
      { type: 'multiple_choice', question: 'A digital pin can be in how many states?', options: ['One', 'Two: HIGH or LOW', 'Ten', 'Any value from 0 to 1023'], correct: 1, explanation: 'A digital pin is either HIGH (5V) or LOW (0V).' },
      { type: 'identify_component', question: 'Click the analog pin that reads the sensor in this alarm circuit.', circuitDiagram: 'ldr_alarm', correctComponent: 'a0', explanation: 'A0 is an analog input reading the divider voltage.' },
      { type: 'true_false', statement: 'You connect the ground of your circuit to a GND pin on the Arduino.', correct: true, explanation: 'Yes. A shared ground is what lets the Arduino and your circuit agree on 0V.' },
      { type: 'multiple_choice', question: 'How many states can a single digital pin be in?', options: ['Two: HIGH or LOW', 'A full range from 0 up to 1023', 'Exactly five fixed states', 'Only one single state ever'], correct: 0, explanation: 'A digital pin is either HIGH (5V) or LOW (0V).' },
      { type: 'true_false', statement: 'You connect your circuit\'s ground to a GND pin on the Arduino.', correct: true, explanation: 'A shared ground lets the Arduino and your circuit agree on 0V.' },
      { type: 'match', instruction: 'Match each pin type to its job.', pairs: [['Digital pin', 'On/off (HIGH or LOW)'], ['Analog input', 'Reads 0 to 5V'], ['5V pin', 'Supplies power'], ['GND pin', 'The 0V reference']] },
    ],
  },

  'The Sketch: setup and loop': {
    xpReward: 25,
    steps: [
      { type: 'teach', title: 'Every Sketch Has Two Parts', body: 'An Arduino program (a "sketch") always has two functions:\n\nvoid setup() {\n  // runs ONCE at the start\n}\n\nvoid loop() {\n  // runs OVER AND OVER, forever\n}\n\nsetup() is for one-time settings (like pin directions). loop() is the part that repeats for as long as the board has power.' },
      { type: 'multiple_choice', question: 'How often does the code inside setup() run?', options: ['Once, at the start', 'Over and over forever', 'Never', 'Only when a button is pressed'], correct: 0, explanation: 'setup() runs a single time when the program starts.' },
      { type: 'multiple_choice', question: 'How often does the code inside loop() run?', options: ['Just once, right at the very start', 'Over and over, forever', 'Exactly twice and then it stops', 'Only when the board is reset'], correct: 1, explanation: 'loop() repeats continuously for as long as the Arduino is powered.' },
      { type: 'true_false', statement: 'You can leave loop() empty if your program only needs to do something once.', correct: true, explanation: 'Yes. Both functions must exist, but loop() can be empty if all the work is in setup().' },
      { type: 'fill_blank', prompt: 'The function that runs once at the start is called ___()', blank: '___', answer: 'setup', hint: 'The other one is loop().' },
      { type: 'multiple_choice', question: 'Where does a one-time pin setup like pinMode usually go?', options: ['Inside loop(), so it repeats every cycle', 'Inside setup(), so it runs once', 'Outside both functions entirely', 'It is never actually needed at all'], correct: 1, explanation: 'One-time settings belong in setup(); loop() does the repeating work.' },
      { type: 'match', instruction: 'Match each function to when it runs.', pairs: [['setup()', 'Once, at the start'], ['loop()', 'Over and over, forever']] },
    ],
  },

  'Naming Pins with Variables': {
    xpReward: 20,
    steps: [
      { type: 'teach', title: 'Give Pins Meaningful Names', body: 'Instead of scattering the number 13 through your code, name it once at the top:\n\nconst int LED = 13;\n\nNow you write LED everywhere, and if you move the LED to another pin you change just one line. const means the value will not change while the program runs.' },
      { type: 'multiple_choice', question: 'Why name a pin with a variable like const int LED = 13;?', options: ['It physically makes the LED glow brighter', 'So the code reads clearly and a pin change is one edit', 'It is strictly required by the compiler to build', 'It noticeably saves the board\'s battery power'], correct: 1, explanation: 'A named pin makes code readable and means a pin change is a one-line edit.' },
      { type: 'fill_blank', prompt: 'Complete the line that names pin 9 as BUZZER: const int BUZZER = ___;', blank: '___', answer: '9', hint: 'Just the pin number.' },
      { type: 'true_false', statement: 'const means the value can change freely while the program runs.', correct: false, explanation: 'The opposite. const marks a value that stays fixed for the whole program.' },
      { type: 'multiple_choice', question: 'You move your LED from pin 13 to pin 8. With const int LED = 13; at the top, what do you change?', options: ['Every digitalWrite line', 'Just that one line, to 8', 'Nothing', 'The whole loop()'], correct: 1, explanation: 'That is the benefit: change the single definition and the rest of the code follows.' },
      { type: 'true_false', statement: 'const marks a value that stays fixed for the whole program.', correct: true, explanation: 'Yes. A const pin number will not change while the program runs.' },
      { type: 'fill_blank', prompt: 'Name pin 13 as LED: const int LED = ___;', blank: '___', answer: '13', hint: 'Just the pin number being used.' },
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
      { type: 'multiple_choice', question: 'What does pinMode(LED, OUTPUT) let the pin do?', options: ['Read a voltage that comes into it', 'Drive something, such as an LED', 'Generate its own power supply', 'Nothing at all until it is reset'], correct: 1, explanation: 'OUTPUT lets the pin drive a load; INPUT lets it read one.' },
      { type: 'fill_blank', prompt: 'Set a pin to read a button: pinMode(BUTTON, ___);', blank: '___', answer: 'INPUT', hint: 'The opposite of OUTPUT. Capitals.' },
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
      { type: 'multiple_choice', question: 'digitalWrite(LED, LOW) puts what voltage on the pin (on a 5V Uno)?', options: ['About 0V', 'About 5V', 'About 2.5V', 'About 13V'], correct: 0, explanation: 'LOW is 0V; HIGH is 5V on an Uno.' },
      { type: 'predict_behavior', question: 'Your loop alternates digitalWrite HIGH, delay, LOW, delay. The LED...', circuitDiagram: 'series_circuit', options: ['Stays solidly on', 'Blinks on and off', 'Stays off entirely', 'Slowly fades up'], correct: 1, explanation: 'Toggling with delays between makes a visible blink.' },
    ],
  },

  'Blink': {
    xpReward: 30,
    steps: [
      { type: 'teach', title: 'Hello, World', body: 'Blink is the classic first sketch. It turns the LED on, waits, off, waits, forever:\n\nconst int LED = 13;\n\nvoid setup() {\n  pinMode(LED, OUTPUT);\n}\n\nvoid loop() {\n  digitalWrite(LED, HIGH);\n  delay(1000);\n  digitalWrite(LED, LOW);\n  delay(1000);\n}\n\ndelay(1000) pauses for 1000 milliseconds, one second.', circuitDiagram: 'series_circuit' },
      { type: 'multiple_choice', question: 'What does delay(1000) do?', options: ['Repeats the next line exactly 1000 times', 'Pauses the program for 1000 ms (one second)', 'Sets the output pin to 1000 volts', 'Does nothing at all in the sketch'], correct: 1, explanation: 'delay() pauses for the given number of milliseconds; 1000 ms is one second.' },
      { type: 'drag_order', instruction: 'Order the lines inside loop() to blink the LED.', items: ['digitalWrite(LED, HIGH);', 'delay(1000);', 'digitalWrite(LED, LOW);', 'delay(1000);'], correctOrder: [0, 1, 2, 3] },
      { type: 'predict_behavior', question: 'You remove both delay() lines from Blink. What happens?', options: ['The LED simply blinks at a slower rate', 'It switches so fast it looks dimly on, not blinking', 'The LED turns off and stays completely off', 'The Arduino board breaks permanently somehow'], correct: 1, explanation: 'Without delays the pin toggles thousands of times a second, far too fast to see as a blink; it just looks faintly lit.' },
      { type: 'fill_blank', prompt: 'To make the LED stay on for half a second, use delay(___);', blank: '___', answer: '500', hint: 'Milliseconds. Half of 1000.' },
      { type: 'true_false', statement: 'pinMode for the LED belongs in loop(), not setup().', correct: false, explanation: 'It belongs in setup(), it is a one-time setting. loop() does the repeating blink.' },
      { type: 'fill_blank', prompt: 'Pause for two seconds: delay(___);', blank: '___', answer: '2000', hint: 'The value is in milliseconds; that is two whole seconds.' },
      { type: 'multiple_choice', question: 'In Blink, where does pinMode(LED, OUTPUT) go?', options: ['In loop(), so it repeats each cycle', 'In setup(), so it runs once', 'Outside both setup and loop', 'It is not needed for Blink'], correct: 1, explanation: 'It is a one-time setting, so it goes in setup().' },
    ],
  },

  'The Serial Monitor': {
    xpReward: 25,
    steps: [
      { type: 'teach', title: 'Let the Arduino Talk Back', body: 'The Serial Monitor lets your Arduino print messages to your computer, which is how you see what it is thinking. Start it in setup():\n\nSerial.begin(9600);\n\nThen print anywhere:\n\nSerial.println(value);\n\n9600 is the baud rate (speed); the Monitor must be set to the same number.' },
      { type: 'fill_blank', prompt: 'Start serial at the common baud rate: Serial.begin(___);', blank: '___', answer: '9600', hint: 'The standard default baud rate.' },
      { type: 'multiple_choice', question: 'Why is the Serial Monitor so useful?', options: ['It supplies the power the Arduino runs on', 'It lets you see values and messages from your code', 'It is what uploads the compiled code to the board', 'It limits the current going to the output pins'], correct: 1, explanation: 'Printing values is the simplest, most powerful way to debug what your code is actually doing.' },
      { type: 'predict_reading', question: 'Your loop reads a sensor with analogRead and does Serial.println(value). You turn a knob from min to max. What do you see scroll by?', options: ['Always the single value 0, never changing', 'Numbers climbing from about 0 to about 1023', 'A stream of random letters and symbols', 'Nothing at all scrolls past on the screen'], correct: 1, explanation: 'analogRead returns 0 to 1023, so the printed numbers track the knob across that range.' },
      { type: 'true_false', statement: 'The Serial Monitor baud rate must match the number in Serial.begin().', correct: true, explanation: 'Yes. Mismatched baud rates produce garbled text.' },
      { type: 'fill_blank', prompt: 'Print a value to the monitor: Serial.println(___);', blank: '___', answer: 'value', hint: 'The name of the variable you want to show.' },
      { type: 'multiple_choice', question: 'What does Serial.begin(9600) set up?', options: ['The pin mode for the output LED', 'Serial communication at 9600 baud', 'The analog reference voltage level', 'A one-second pause in the loop'], correct: 1, explanation: 'It starts serial at 9600 baud; the Monitor must match that speed.' },
    ],
  },

  'Uploading Your Code': {
    xpReward: 20,
    steps: [
      { type: 'teach', title: 'From Computer to Chip', body: 'To run a sketch you upload it: the IDE compiles your code, then sends it over the USB cable to the board, where it is stored and starts running. You pick the right board and port first, then press Upload.' },
      { type: 'drag_order', instruction: 'Order the steps to get a sketch running on the board.', items: ['Write the sketch', 'Select your board and port', 'Press Upload (it compiles, then sends)', 'The board stores and runs it'], correctOrder: [0, 1, 2, 3] },
      { type: 'multiple_choice', question: 'What happens when you press Upload?', options: ['The code only ever runs on the computer itself', 'The IDE compiles the code and sends it over USB', 'The board sends you a confirmation email message', 'Nothing happens until you reboot the computer'], correct: 1, explanation: 'Upload compiles your sketch and transfers it to the board, which then runs it.' },
      { type: 'true_false', statement: 'Once uploaded, the sketch keeps running on the board even after you unplug the USB data cable, as long as it has power.', correct: true, explanation: 'Yes. The program lives on the board; it runs whenever powered.' },
      { type: 'multiple_choice', question: 'Upload fails saying no board is found. What is the most likely fix?', options: ['Rewrite the entire sketch from scratch again', 'Select the correct board and port, and check the cable', 'Buy a completely new computer to upload from', 'Remove the LED from the breadboard circuit'], correct: 1, explanation: 'A missing-board error is almost always the wrong port/board selection or a charge-only USB cable.' },
      { type: 'true_false', statement: 'Once uploaded, the sketch runs on the board whenever it has power, even off the USB data link.', correct: true, explanation: 'The program is stored on the board and runs from any power source.' },
      { type: 'multiple_choice', question: 'Before pressing Upload, what must you select?', options: ['The physical colour of the board', 'The correct board type and port', 'The resistor value to use', 'Only the Serial baud rate'], correct: 1, explanation: 'The IDE needs the right board and the right serial port to upload.' },
    ],
  },

  'Reading Errors': {
    xpReward: 25,
    steps: [
      { type: 'teach', title: 'Errors Are Clues', body: 'When code will not compile, the IDE prints an error and highlights a line. The most common beginner errors are tiny: a missing semicolon at the end of a line, a missing closing brace, or a misspelled command. Read the first error first, lower ones are often just knock-on effects.' },
      { type: 'multiple_choice', question: 'Which is the most common beginner compile error?', options: ['A missing semicolon at the end of a line', 'The Arduino board itself is physically broken', 'The LED in the circuit is far too bright', 'The wrong resistor value was chosen for it'], correct: 0, explanation: 'Most statements must end with a semicolon; a missing one is the classic error.' },
      { type: 'true_false', statement: 'The line  digitalWrite(LED, HIGH)  with no semicolon on the end will fail to compile.', correct: true, explanation: 'A simple statement needs its semicolon; without it the sketch will not compile.' },
      { type: 'true_false', statement: 'When you see many errors, you should usually fix the first one first.', correct: true, explanation: 'Yes. Later errors are often caused by the first, so fixing the top one can clear several.' },
      { type: 'fill_blank', prompt: 'Every simple statement in Arduino code must end with a ___', blank: '___', answer: 'semicolon', hint: 'The ; character.' },
      { type: 'multiple_choice', question: 'The IDE highlights a line and says "expected }". What is likely missing?', options: ['A current-limiting resistor somewhere', 'A closing curly brace somewhere above', 'A brand new Arduino board entirely', 'A delay() call inside the loop'], correct: 1, explanation: 'Unbalanced braces are a common structural error; you are missing a closing }.' },
      { type: 'true_false', statement: 'When you see many errors, fixing the first one often clears several below it.', correct: true, explanation: 'Later errors are frequently knock-on effects of the first, so start at the top.' },
      { type: 'fill_blank', prompt: 'Most simple statements in Arduino code must end with a ___', blank: '___', answer: 'semicolon', hint: 'The punctuation mark written as ;' },
    ],
  },

  'Unit 4 Checkpoint': {
    xpReward: 50,
    steps: [
      { type: 'multiple_choice', question: 'A microcontroller is...', options: ['A special kind of high-power resistor', 'A small computer on a chip that runs your program', 'A type of rechargeable battery cell', 'A small display screen for showing output'], correct: 1, explanation: 'A tiny programmable computer.' },
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
      { type: 'multiple_choice', question: 'A simple push button is what kind of input?', options: ['Analog, a smooth range of values', 'Digital, just pressed or not', 'A power source all by itself', 'An output rather than an input'], correct: 1, explanation: 'A plain button is two-state: HIGH or LOW, a digital input.' },
      { type: 'fill_blank', prompt: 'Set the button pin to read: pinMode(BUTTON, ___);', blank: '___', answer: 'INPUT', hint: 'You are reading the pin, not driving it. Capitals.' },
    ],
  },

  'Pull-up and Pull-down Resistors': {
    xpReward: 30,
    steps: [
      { type: 'teach', title: 'The Floating Pin Problem', body: 'A button connects a pin to 5V when pressed. But when it is NOT pressed, the pin connects to nothing, it "floats", and electrical noise makes it flicker randomly between HIGH and LOW. A pull-down resistor (to ground) holds the pin at a steady LOW until the button is pressed. A pull-up (to 5V) does the reverse.' },
      { type: 'multiple_choice', question: 'What is a "floating" input pin?', options: ['A pin that has deliberately been configured as a digital OUTPUT', 'A pin connected to neither 5V nor ground, so it picks up noise', 'A pin that sits at exactly 2.5 volts the entire time', 'A pin that has somehow been physically damaged'], correct: 1, explanation: 'With no defined connection, the pin floats and its reading fluctuates with noise.' },
      { type: 'multiple_choice', question: 'A pull-down resistor sets the button\'s default (unpressed) reading to...', options: ['HIGH', 'LOW', 'Random', '2.5V'], correct: 1, explanation: 'A pull-down ties the pin to ground, so it reads LOW until the button connects it to 5V.' },
      { type: 'predict_behavior', question: 'You wire a button with no pull-up or pull-down. Unpressed, what does digitalRead give?', options: ['A steady, dependable LOW reading', 'A steady, dependable HIGH reading', 'Random, flickering, unpredictable values', 'Always exactly 512 every single time'], correct: 2, explanation: 'A floating pin has no defined state, so it flickers unpredictably. That is exactly what the pull resistor fixes.' },
      { type: 'true_false', statement: 'A pull-up or pull-down resistor gives a digital input a defined default state.', correct: true, explanation: 'Yes. It anchors the pin to HIGH (pull-up) or LOW (pull-down) until the button changes it.' },
      { type: 'multiple_choice', question: 'A pull-up resistor sets the button\'s default (unpressed) reading to...', options: ['LOW, tied down to ground', 'HIGH, tied up to 5V', 'A random, noisy value', 'Exactly half the supply'], correct: 1, explanation: 'A pull-up ties the pin to 5V, so it reads HIGH until the button pulls it the other way.' },
      { type: 'true_false', statement: 'A pull resistor gives a digital input a defined default state.', correct: true, explanation: 'It anchors the pin HIGH (pull-up) or LOW (pull-down) until the button changes it.' },
      { type: 'match', instruction: 'Match each setup to the unpressed reading.', pairs: [['Pull-down resistor', 'Reads LOW by default'], ['Pull-up resistor', 'Reads HIGH by default'], ['No resistor (floating)', 'Random, noisy reading']] },
    ],
  },

  'Debouncing a Button': {
    xpReward: 25,
    steps: [
      { type: 'teach', title: 'One Press, Many Signals', body: 'When you press a real button, the metal contacts physically bounce for a few milliseconds, so the Arduino can read one press as several rapid presses. Smoothing this out is called debouncing. The simplest fix: after detecting a change, wait a few milliseconds before reading again.' },
      { type: 'multiple_choice', question: 'Why might one button press register as several?', options: ['The Arduino board itself is completely broken', 'The contacts physically bounce for a few milliseconds', 'The pull resistor value chosen is far too big', 'The output LED somehow interferes with the pin'], correct: 1, explanation: 'Mechanical contacts bounce, producing several rapid transitions from one press.' },
      { type: 'multiple_choice', question: 'A simple software debounce is to...', options: ['Fit a physically bigger indicator LED', 'Wait a short time after a change before reading again', 'Remove the pull-down resistor entirely', 'Increase the serial monitor baud rate'], correct: 1, explanation: 'A brief delay after a detected change lets the bouncing settle before you read again.' },
      { type: 'true_false', statement: 'Debouncing is about smoothing the noisy signal from a button being pressed.', correct: true, explanation: 'Yes. It stops one physical press from registering as many.' },
      { type: 'fill_blank', prompt: 'Bouncing lasts a few ___ (the unit delay() uses).', blank: '___', answer: 'milliseconds', hint: 'Thousandths of a second.' },
      { type: 'true_false', statement: 'Debouncing stops one physical press from registering as many.', correct: true, explanation: 'It smooths the brief mechanical bounce so one press reads as one event.' },
      { type: 'multiple_choice', question: 'Contact bounce typically lasts about how long?', options: ['Several whole seconds', 'A few milliseconds', 'Several long minutes', 'About a full hour'], correct: 1, explanation: 'Bounce settles within a few milliseconds, which is why a short wait fixes it.' },
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
      { type: 'fill_blank', prompt: 'analogRead returns a value from 0 up to ___', blank: '___', answer: '1023', hint: 'A 10-bit converter: two to the tenth power, minus one.' },
      { type: 'multiple_choice', question: 'analogRead is used to read...', options: ['A digital on/off push button', 'An analog sensor voltage', 'The compiled program size', 'The Serial monitor baud rate'], correct: 1, explanation: 'analogRead turns an analog voltage on A0 to A5 into a number 0 to 1023.' },
    ],
  },

  'analogWrite and PWM': {
    xpReward: 30,
    steps: [
      { type: 'teach', title: 'Faking Analog Output', body: 'A digital pin can only do HIGH or LOW, but if it switches between them very fast, the average looks like a level in between. That is PWM (pulse-width modulation), and analogWrite() does it:\n\nanalogWrite(LED, 128);\n\nThe value 0 to 255 sets the brightness: 0 is off, 255 is full, 128 is about half.' },
      { type: 'multiple_choice', question: 'What does PWM let a digital pin do?', options: ['Read smooth analog input voltages directly', 'Appear to output a level between off and full by switching fast', 'Store program data permanently in its memory', 'Measure the surrounding air temperature'], correct: 1, explanation: 'Rapid on/off switching averages to an apparent in-between level, used for dimming and speed control.' },
      { type: 'fill_blank', prompt: 'analogWrite uses a value from 0 to ___', blank: '___', answer: '255', hint: '8-bit range; full brightness.' },
      { type: 'predict_behavior', question: 'analogWrite(LED, 255) versus analogWrite(LED, 64). What is the difference?', options: ['No real difference between the two', '255 is full brightness, 64 is dim', '64 is the brighter of the two values', 'Both of them leave the LED fully off'], correct: 1, explanation: 'Higher PWM value means a higher average, so 255 is full brightness and 64 is dim.' },
      { type: 'multiple_choice', question: 'PWM is commonly used to...', options: ['Dim LEDs and control motor speed', 'Read analog sensors on the input pins', 'Supply the main power to the board', 'Take the place of a current resistor'], correct: 0, explanation: 'Dimming, fading, and motor-speed control are classic PWM uses.' },
      { type: 'true_false', statement: 'PWM produces a true analog voltage on the pin.', correct: false, explanation: 'Not exactly. It rapidly switches HIGH/LOW so the average behaves like an analog level, which is good enough for LEDs and motors.' },
      { type: 'fill_blank', prompt: 'analogWrite takes a value from 0 up to ___', blank: '___', answer: '255', hint: 'An 8-bit range, where the top value is full output.' },
      { type: 'predict_behavior', question: 'You sweep analogWrite from 0 to 255 on an LED. It...', circuitDiagram: 'series_circuit', options: ['Stays at one fixed brightness', 'Fades from off up to full', 'Blinks rapidly on and off', 'Turns off and stays off'], correct: 1, explanation: 'Rising PWM raises the average, so the LED fades up smoothly.' },
    ],
  },

  'Making Sound with tone()': {
    xpReward: 20,
    steps: [
      { type: 'teach', title: 'Beeps and Buzzes', body: 'tone() drives a buzzer or speaker at a given frequency in hertz:\n\ntone(BUZZER, 1000);   // 1000 Hz tone\nnoTone(BUZZER);        // stop\n\nHigher frequency means a higher pitch. This is how your alarm makes noise.' },
      { type: 'multiple_choice', question: 'What does the number in tone(BUZZER, 1000) set?', options: ['The loudness or volume of the sound', 'The frequency (pitch) in hertz', 'The number of the pin being used', 'The length of a delay in the loop'], correct: 1, explanation: 'It sets the frequency in hertz; higher is a higher pitch.' },
      { type: 'fill_blank', prompt: 'Stop the buzzer: ___(BUZZER);', blank: '___', answer: 'noTone', hint: 'The opposite of tone().' },
      { type: 'predict_behavior', question: 'You call tone(BUZZER, 2000) instead of tone(BUZZER, 500). How does it sound?', options: ['Quieter', 'Higher pitched', 'Lower pitched', 'No sound'], correct: 1, explanation: 'Higher frequency means a higher pitch.' },
      { type: 'true_false', statement: 'A buzzer is an output, so its pin should be set to OUTPUT.', correct: true, explanation: 'Yes, you are driving it, so it is an output.' },
      { type: 'true_false', statement: 'A higher frequency passed to tone() makes a higher pitch.', correct: true, explanation: 'Frequency in hertz sets the pitch; more hertz, higher pitch.' },
      { type: 'multiple_choice', question: 'Which call stops the buzzer?', options: ['stop(BUZZER)', 'noTone(BUZZER)', 'end(BUZZER)', 'mute(BUZZER)'], correct: 1, explanation: 'noTone() stops the tone on that pin.' },
    ],
  },

  'if: Making Decisions': {
    xpReward: 30,
    steps: [
      { type: 'teach', title: 'Code That Decides', body: 'An if statement runs code only when a condition is true:\n\nif (value < threshold) {\n  // do this when value is below threshold\n}\n\nThe part in parentheses is the condition. Common comparisons: < (less than), > (greater than), == (equal to).' },
      { type: 'multiple_choice', question: 'When does the code inside if (value < 500) { } run?', options: ['Every single time, no matter what', 'Only when value is less than 500', 'Only at the moment value equals 500', 'Never, the block is always skipped'], correct: 1, explanation: 'The block runs only while the condition (value < 500) is true.' },
      { type: 'fill_blank', prompt: 'Fill the comparison so it triggers when dark (reading below threshold): if (reading ___ threshold)', blank: '___', answer: '<', hint: 'Less-than sign.' },
      { type: 'predict_behavior', question: 'threshold is 500. The reading is 200. Does if (reading < threshold) run its block?', options: ['Yes', 'No', 'Only sometimes', 'It errors'], correct: 0, explanation: '200 is less than 500, so the condition is true and the block runs.' },
      { type: 'multiple_choice', question: 'Which operator checks "greater than"?', options: ['<', '>', '==', '!'], correct: 1, explanation: '> is greater than; < is less than; == is equal to.' },
      { type: 'true_false', statement: 'if lets your program do different things depending on a sensor reading.', correct: true, explanation: 'Yes. That is the decide stage of sense, decide, act, in code.' },
      { type: 'multiple_choice', question: 'Which operator means "equal to" in a condition?', options: ['= (a single equals sign)', '== (a double equals sign)', '!= (the not-equal sign)', '>= (greater than or equal)'], correct: 1, explanation: '== tests equality; a single = assigns a value instead.' },
      { type: 'predict_behavior', question: 'threshold is 500, reading is 700. Does if (reading < threshold) run its block?', options: ['Yes, the block runs', 'No, 700 is not less than 500', 'Only some of the time', 'It throws a compile error'], correct: 1, explanation: '700 is not less than 500, so the condition is false and the block is skipped.' },
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
      { type: 'multiple_choice', question: 'In the alarm sketch, which function reads the LDR?', options: ['digitalWrite()', 'analogRead()', 'pinMode()', 'delay()'], correct: 1, explanation: 'analogRead(A0) reads the divider voltage from the LDR.' },
      { type: 'predict_behavior', question: 'threshold = 500. It is bright and the reading is 800. The code...', circuitDiagram: 'ldr_alarm', options: ['Drives the alarm HIGH (turns it on)', 'Drives the alarm LOW (leaves it off)', 'Resets the whole board', 'Does nothing at all this cycle'], correct: 1, explanation: '800 < 500 is false, so the else branch runs and the alarm stays off.' },
    ],
  },

  'Calibrating in Code': {
    xpReward: 30,
    steps: [
      { type: 'teach', title: 'Tune With the Serial Monitor', body: 'Hardware thresholds are easier to set with real numbers. Print the reading with Serial.println(reading), watch the Serial Monitor in light and in dark, then set your threshold between the two values you actually see. No guessing.' },
      { type: 'drag_order', instruction: 'Order the steps to calibrate your alarm threshold.', items: ['Print the reading with Serial.println', 'Note the value in bright light', 'Note the value in darkness', 'Set the threshold between the two', 'Test that it triggers cleanly'], correctOrder: [0, 1, 2, 3, 4] },
      { type: 'predict_reading', question: 'In light the Monitor shows ~780, in dark ~190. Which threshold is best?', options: ['770', '500', '50', '1023'], correct: 1, explanation: '500 sits cleanly between 190 (dark) and 780 (light), giving margin against noise.' },
      { type: 'multiple_choice', question: 'Why print the reading instead of guessing the threshold?', options: ['Mainly because it just looks more professional', 'So you set it from the real values your sensor produces', 'Because printing makes the output LED much brighter', 'Because the sketch will not compile without it'], correct: 1, explanation: 'Real readings vary by sensor, resistor, and room; measuring beats guessing.' },
      { type: 'multiple_choice', question: 'You note the reading in bright light and in darkness. Where do you set the threshold?', options: ['Right at the bright value', 'Between the two values', 'Right at the dark value', 'At exactly 1023'], correct: 1, explanation: 'Midway between the measured bright and dark readings gives clean, reliable triggering.' },
      { type: 'true_false', statement: 'A threshold set right next to the bright reading is more reliable.', correct: false, explanation: 'No. Too close and small light changes trigger it by accident. Leave margin, sit in the middle.' },
      { type: 'predict_reading', question: 'The monitor shows ~760 in light and ~180 in dark. The best threshold to set is...', options: ['About 470', 'About 750', 'About 60', 'About 1000'], correct: 0, explanation: '~470 sits cleanly between 180 (dark) and 760 (light), giving margin against noise.' },
    ],
  },

  'Unit 5 Checkpoint': {
    xpReward: 50,
    steps: [
      { type: 'multiple_choice', question: 'digitalRead() returns...', options: ['0 to 1023', 'HIGH or LOW', 'A voltage', 'The pin number'], correct: 1, explanation: 'It is a digital (two-state) read.' },
      { type: 'multiple_choice', question: 'An input pin connected to neither 5V nor ground is...', options: ['Firmly grounded at zero volts', 'Floating, and reads noisily', 'Held steadily up at 5 volts', 'Perfectly fine and stable'], correct: 1, explanation: 'A floating pin flickers; a pull resistor fixes it.' },
      { type: 'fill_blank', prompt: 'Read analog pin A0: int v = analogRead(___);', blank: '___', answer: 'A0', hint: 'The analog pin.' },
      { type: 'predict_reading', question: 'A divider at 2.5V feeds A0. analogRead gives about...', circuitDiagram: 'voltage_divider', options: ['0', '512', '1023', 'HIGH'], correct: 1, explanation: 'Half of 5V is about half of 1023.' },
      { type: 'fill_blank', prompt: 'analogWrite brightness goes 0 to ___', blank: '___', answer: '255', hint: '8-bit.' },
      { type: 'predict_behavior', question: 'threshold 500, reading 180, in if (reading < threshold) digitalWrite(ALARM, HIGH). The alarm...', circuitDiagram: 'ldr_alarm', options: ['Stays off', 'Turns on', 'Errors', 'Fades'], correct: 1, explanation: '180 < 500 is true, so ALARM goes HIGH.' },
      { type: 'drag_order', instruction: 'Order the darkness-alarm loop().', items: ['int reading = analogRead(A0);', 'if (reading < threshold) {', 'digitalWrite(ALARM, HIGH);', '} else {', 'digitalWrite(ALARM, LOW);', '}'], correctOrder: [0, 1, 2, 3, 4, 5] },
      { type: 'true_false', statement: 'Sense, decide, act maps to analogRead, if, digitalWrite.', correct: true, explanation: 'Exactly the shape of the alarm sketch.' },
    ],
  },

  // ═══════════════════ Unit 6: Capacitors, RC & Timing ═══════════════════
  // Grounded in EAC Vol.1 (Capacitor), Make: Electronics (Exp. 8-10), PEI §2.23.
  // See content/CURRICULUM_CITATIONS.md.

  'What a Capacitor Does': {
    xpReward: 25,
    steps: [
      { type: 'teach', title: 'A Tiny Charge Store', body: 'A capacitor stores electrical charge. Inside are two conducting plates separated by an insulator called the dielectric. Connect it to a voltage and charge piles up on the plates; the voltage across the capacitor rises until it matches the supply. Disconnect it and the charge stays, so a charged capacitor holds its voltage.' },
      { type: 'teach', title: 'It Resists a Change in Voltage', body: 'The key behaviour: a capacitor opposes a sudden change in its voltage. It cannot jump instantly, it has to charge or discharge. That single property is behind everything a capacitor does, from smoothing a supply to timing a blink.' },

      // Tier 1: recall
      { type: 'multiple_choice', difficulty: 1, question: 'What does a capacitor store?', options: ['Electrical charge', 'A magnetic field', 'Heat energy', 'Resistance'], correct: 0, explanation: 'A capacitor stores charge on its two plates; an inductor is the one that stores a magnetic field.' },
      { type: 'multiple_choice', difficulty: 1, question: 'The insulating layer between a capacitor\'s plates is called the...', options: ['Dielectric', 'Electrolyte', 'Conductor', 'Substrate'], correct: 0, explanation: 'The dielectric is the insulator between the plates; its material sets much of the capacitance.' },
      { type: 'true_false', difficulty: 1, statement: 'A capacitor opposes a sudden change in the voltage across it.', correct: true, explanation: 'Yes. Its voltage can only rise or fall as it charges or discharges, never instantly.' },
      { type: 'true_false', difficulty: 1, statement: 'A charged capacitor loses its voltage the instant you disconnect it.', correct: false, explanation: 'It holds the charge, so the voltage stays until something lets it discharge. Big capacitors can hold a dangerous charge for a long time.' },

      // Tier 2: apply
      { type: 'multiple_choice', difficulty: 2, question: 'You connect an empty capacitor across a 5V supply. What does its voltage do?', options: ['Rises toward 5V, then holds there', 'Jumps straight to 5V with no delay', 'Stays at 0V and never charges up', 'Overshoots 5V and climbs to 10V'], correct: 0, explanation: 'It charges up toward the supply and settles at 5V; it cannot exceed the supply or jump there instantly.' },
      { type: 'predict_behavior', difficulty: 2, question: 'A capacitor is charged to 5V. You connect a resistor across it. What happens?', options: ['It discharges, its voltage falling toward 0V', 'Its voltage rises above 5V', 'Nothing, capacitors cannot discharge', 'It stays at exactly 5V'], correct: 0, explanation: 'The resistor gives the stored charge a path out, so the capacitor discharges and its voltage decays toward 0V.' },
      { type: 'multiple_choice', difficulty: 2, question: 'Which property makes a capacitor useful for smoothing a wobbly supply voltage?', options: ['It resists sudden voltage changes', 'It increases the voltage', 'It blocks all current', 'It generates its own charge'], correct: 0, explanation: 'Because it opposes fast voltage changes, it fills in the dips and shaves the peaks, smoothing the supply.' },

      // Tier 3: reason
      { type: 'multiple_choice', difficulty: 3, question: 'Why does a capacitor pass an AC signal but block a steady DC voltage?', options: ['Once charged, steady DC stops, but AC keeps charging it', 'It internally rectifies the incoming AC into smooth DC', 'A DC voltage is simply too small to enter the capacitor', 'An AC signal always carries far more voltage than DC'], correct: 0, explanation: 'Steady DC charges it once and then current stops. AC constantly reverses, so the capacitor charges and discharges continuously, letting the changing current through.' },
      { type: 'predict_behavior', difficulty: 3, question: 'A capacitor sits across the power pins of a chip. The chip suddenly draws a burst of current. What does the capacitor do?', options: ['Supplies the burst from its stored charge to steady it', 'Blocks the chip from drawing any current at all', 'Pushes the whole supply rail to a higher voltage', 'Does nothing useful while the burst happens'], correct: 0, explanation: 'It dumps stored charge to cover the sudden demand, so the local voltage barely dips. That is exactly what a decoupling capacitor is for.' },
      { type: 'match', difficulty: 3, instruction: 'Match each part or idea to what it is.', pairs: [['Plates', 'Conductors that hold the charge'], ['Dielectric', 'The insulator between them'], ['Charging', 'Voltage rising toward the supply'], ['Discharging', 'Voltage falling toward zero'], ['Stored charge', 'Why a cap holds its voltage']] },
    ],
  },

  'Farads and Capacitor Values': {
    xpReward: 25,
    steps: [
      { type: 'teach', title: 'The Farad Is Huge', body: 'Capacitance is measured in farads (F). One farad is enormous, so real parts use tiny fractions:\n\n• microfarad (µF) = one millionth of a farad\n• nanofarad (nF) = one thousandth of a µF\n• picofarad (pF) = one thousandth of a nF\n\nSo 1 F = 1,000,000 µF, and 1 µF = 1,000 nF = 1,000,000 pF.' },
      { type: 'teach', title: 'Reading the Steps', body: 'Each step down is ×1000:\n\npF → nF → µF → F\n\nA "100 nF" ceramic (very common for decoupling) is the same as 0.1 µF. A "10 µF" electrolytic is 10,000 nF. Getting the prefix right matters: a 1000× error in C is a 1000× error in your timing.' },

      // Tier 1: recall
      { type: 'multiple_choice', difficulty: 1, question: 'What is the unit of capacitance?', options: ['Farad (F)', 'Henry (H)', 'Ohm (Ω)', 'Volt (V)'], correct: 0, explanation: 'Capacitance is measured in farads, named after Michael Faraday.' },
      { type: 'multiple_choice', difficulty: 1, question: 'Why are most real capacitors rated in µF, nF, or pF rather than farads?', options: ['One farad is a very large amount of capacitance', 'Farads are illegal to use', 'Small capacitors cannot store charge', 'The farad is an old unit no longer used'], correct: 0, explanation: 'A whole farad is huge, so practical parts are tiny fractions of one.' },
      { type: 'fill_blank', difficulty: 1, prompt: 'Going up the prefixes, each step (pF → nF → µF) multiplies by ___.', blank: '___', answer: '1000', hint: 'Three zeros per step.' },

      // Tier 2: convert
      { type: 'fill_blank', difficulty: 2, prompt: 'A 100 nF capacitor expressed in microfarads is ___ µF.', blank: '___', answer: '0.1', hint: 'There are 1000 nF in a µF, so divide by 1000.' },
      { type: 'multiple_choice', difficulty: 2, question: 'How many nanofarads are in 10 µF?', options: ['10,000 nF', '10 nF', '100 nF', '1,000,000 nF'], correct: 0, explanation: '1 µF = 1000 nF, so 10 µF = 10,000 nF.' },
      { type: 'fill_blank', difficulty: 2, prompt: '4700 pF written in nanofarads is ___ nF.', blank: '___', answer: '4.7', hint: 'There are 1000 pF in a nF.' },
      { type: 'multiple_choice', difficulty: 2, question: 'A schematic calls for 0.1 µF. Which marking on a part is the same value?', options: ['100 nF', '10 nF', '1 nF', '1000 pF'], correct: 0, explanation: '0.1 µF × 1000 = 100 nF. The common "104" ceramic is exactly this.' },

      // Tier 3: reason
      { type: 'multiple_choice', difficulty: 3, question: 'You needed 10 µF in a timing circuit but fitted 10 nF by mistake. What happens to the timing?', options: ['It runs about 1000× faster than intended', 'It runs about 1000× slower', 'No change, nF and µF are the same', 'The circuit will not power on'], correct: 0, explanation: '10 nF is 1000× smaller than 10 µF, so the time constant (and the delay) is about 1000× shorter.' },
      { type: 'multiple_choice', difficulty: 3, question: 'A "104" ceramic capacitor uses the same digit-digit-multiplier idea as a resistor, in picofarads: 10 followed by 4 zeros. What is its value?', options: ['100,000 pF, the same as 100 nF or 0.1 µF', 'Just 104 pF, reading the number literally', 'About 10.4 µF, a fairly large value', 'Only 14 pF, a very tiny value'], correct: 0, explanation: '"104" means 10 × 10,000 pF = 100,000 pF = 100 nF = 0.1 µF, the workhorse decoupling cap.' },
    ],
  },

  'Capacitor Types and Polarity': {
    xpReward: 25,
    steps: [
      { type: 'teach', title: 'Two Families You Will Meet', body: 'Ceramic capacitors are small, cheap, and have NO polarity, so either lead can go either way. They are used for small values (pF to a few µF) and for decoupling. Electrolytic capacitors pack a large value into a small can (µF to thousands of µF) but they ARE polarised: one lead is positive, one negative.' },
      { type: 'teach', title: 'Mind the Stripe', body: 'An electrolytic must be wired the right way round. The negative lead is marked, usually with a stripe down the can, and is often the shorter leg. Wire one backwards and it can fail, sometimes venting or popping. Ceramics have no such rule.' },

      // Tier 1: recall
      { type: 'multiple_choice', difficulty: 1, question: 'Which capacitor type is polarised (orientation matters)?', options: ['Electrolytic', 'Ceramic', 'Both equally', 'Neither'], correct: 0, explanation: 'Electrolytics are polarised; ceramics are not.' },
      { type: 'true_false', difficulty: 1, statement: 'A ceramic capacitor can be connected either way round.', correct: true, explanation: 'Yes. Ceramics are non-polarised, so either lead can face either way.' },
      { type: 'multiple_choice', difficulty: 1, question: 'On an electrolytic capacitor, the stripe down the can usually marks the...', options: ['Negative lead', 'Positive lead', 'Hottest point', 'Value in µF'], correct: 0, explanation: 'The stripe marks the negative lead; the shorter leg is often negative too.' },

      // Tier 2: apply
      { type: 'predict_behavior', difficulty: 2, question: 'You wire a 100 µF electrolytic in backwards and power up. What is the likely result?', options: ['It can overheat, fail, and even pop', 'It works better than normal', 'It quietly becomes a resistor', 'Nothing ever happens'], correct: 0, explanation: 'A reversed electrolytic can break down, heat up, and vent or burst. Always observe its polarity.' },
      { type: 'multiple_choice', difficulty: 2, question: 'You need 1000 µF to smooth a power supply. Which type fits best?', options: ['Electrolytic', 'Ceramic', 'Either, value does not matter', 'Neither can do µF values'], correct: 0, explanation: 'Large µF values in a small package mean an electrolytic; ceramics rarely reach 1000 µF affordably.' },
      { type: 'multiple_choice', difficulty: 2, question: 'You need 100 nF right next to a chip\'s power pin for decoupling. Best choice?', options: ['Ceramic', 'Large electrolytic', 'A polarised tantalum only', 'No capacitor needed'], correct: 0, explanation: 'A small ceramic is ideal for decoupling: small value, no polarity, fast response.' },

      // Tier 3: reason
      { type: 'multiple_choice', difficulty: 3, question: 'Why are electrolytics generally a poor choice for a plain AC signal that swings both positive and negative?', options: ['An AC signal reverses polarity, which they cannot take', 'Their capacitance is far too small to work with AC', 'No capacitor of any kind can pass an AC signal', 'An electrolytic capacitor contains no dielectric'], correct: 0, explanation: 'An AC signal reverses polarity each cycle, but a standard electrolytic needs one lead always positive. (Special non-polarised electrolytics exist for this.)' },
      { type: 'match', difficulty: 3, instruction: 'Match each capacitor to the better job for it.', pairs: [['Ceramic 100 nF', 'Decoupling a chip'], ['Electrolytic 1000 µF', 'Smoothing a supply'], ['Small ceramic pF', 'High-frequency timing'], ['Reversed electrolytic', 'A part about to fail']] },
    ],
  },

  'Charging Through a Resistor': {
    xpReward: 30,
    steps: [
      { type: 'teach', title: 'A Resistor Sets the Pace', body: 'Connect a capacitor to a supply through a resistor and it cannot charge instantly. The resistor limits the current, so the capacitor voltage climbs gradually, fast at first, then slowing as it approaches the supply. This smooth climb is a charging curve, and it is the heart of timing circuits.' },
      { type: 'teach', title: 'The Shape of the Curve', body: 'The voltage rises quickly at first because the gap to the supply is large, then crawls as the gap shrinks. It approaches the supply but, in theory, never quite reaches it. Discharging through a resistor is the mirror image: a quick drop that slows as it nears zero.' },

      // Tier 1: recall
      { type: 'multiple_choice', difficulty: 1, question: 'What does adding a series resistor do to how a capacitor charges?', options: ['Slows the charging to a gradual climb', 'Makes it charge instantly', 'Stops it charging at all', 'Charges it above the supply voltage'], correct: 0, explanation: 'The resistor limits the current, so the voltage rises gradually instead of jumping.' },
      { type: 'true_false', difficulty: 1, statement: 'A capacitor charging through a resistor rises fastest at the very start.', correct: true, explanation: 'Yes. The gap to the supply is largest at first, so the current and the rate of rise are highest then.' },
      { type: 'multiple_choice', difficulty: 1, question: 'As the capacitor voltage approaches the supply, the charging current...', options: ['Falls toward zero', 'Rises toward infinity', 'Stays constant', 'Reverses direction'], correct: 0, explanation: 'The smaller the remaining gap, the smaller the current, so it tapers off toward zero.' },

      // Tier 2: apply
      { type: 'predict_behavior', difficulty: 2, question: 'You increase the series resistor. How does the charging change?', options: ['It charges more slowly', 'It charges more quickly', 'It charges to a higher voltage', 'No change at all'], correct: 0, explanation: 'A larger resistor passes less current, so the capacitor charges more slowly.' },
      { type: 'predict_behavior', difficulty: 2, question: 'You swap in a larger capacitor, same resistor. How does the charging change?', options: ['It charges more slowly', 'It charges more quickly', 'It cannot charge at all', 'It charges past the supply'], correct: 0, explanation: 'A bigger capacitor needs more charge to reach the same voltage, so with the same current it takes longer.' },
      { type: 'multiple_choice', difficulty: 2, question: 'To make a capacitor charge FASTER, you could...', options: ['Use a smaller resistor or a smaller capacitor', 'Use a larger resistor to slow the current', 'Use a larger capacitor that holds more', 'Lower the supply voltage feeding it'], correct: 0, explanation: 'Less resistance or less capacitance both shorten the charging time.' },

      // Tier 3: reason
      { type: 'predict_behavior', difficulty: 3, question: 'A capacitor charges through a resistor toward 5V. After it settles, how much steady current flows through the resistor?', options: ['Essentially zero', 'A large steady current', 'Exactly half the starting current', 'It keeps rising'], correct: 0, explanation: 'Once charged to the supply, there is no voltage across the resistor, so no more current flows. A charged cap blocks steady DC.' },
      { type: 'multiple_choice', difficulty: 3, question: 'Why does the charging curve flatten out instead of being a straight line?', options: ['The current shrinks as the gap to the supply shrinks', 'The resistor heats up and gradually stops working', 'The capacitor simply runs out of plates to fill', 'The supply voltage quietly drops away over time'], correct: 0, explanation: 'Charging current is proportional to the remaining gap; as the gap closes the current falls, so the rise slows, giving the curved shape.' },
    ],
  },

  'The Time Constant': {
    xpReward: 35,
    steps: [
      { type: 'teach', title: 'One Number for the Speed', body: 'The time constant, written with the Greek letter tau (τ), captures how fast an RC circuit charges:\n\nτ = R × C\n\nResistance in ohms, capacitance in farads, gives τ in seconds. One time constant is the time to charge to about 63% of the way to the supply.' },
      { type: 'teach', title: 'The 63% Rule and "Five Taus"', body: 'In one τ the capacitor reaches ~63% of the supply. In each further τ it covers ~63% of the remaining gap: about 63%, 86%, 95%, 98%, then 99% after five time constants. So the rule of thumb is that a capacitor is "fully" charged after about 5τ.' },

      // Tier 1: recall
      { type: 'fill_blank', difficulty: 1, prompt: 'The formula for the time constant is τ = R × ___.', blank: '___', answer: 'C', hint: 'The capacitance.' },
      { type: 'multiple_choice', difficulty: 1, question: 'After one time constant, a charging capacitor reaches about what fraction of the supply?', options: ['63%', '100%', '50%', '10%'], correct: 0, explanation: 'One τ takes it to roughly 63% of the way to the supply voltage.' },
      { type: 'multiple_choice', difficulty: 1, question: 'A capacitor is treated as "fully charged" after about how many time constants?', options: ['5', '1', '2', '20'], correct: 0, explanation: 'After ~5τ it is about 99% charged, close enough to call it full.' },
      { type: 'true_false', difficulty: 1, statement: 'With R in ohms and C in farads, τ = R × C comes out in seconds.', correct: true, explanation: 'Yes. Ohms times farads gives seconds directly.' },

      // Tier 2: apply (watch the farad conversion)
      { type: 'fill_blank', difficulty: 2, prompt: 'R = 1 kΩ (1000 Ω) and C = 1000 µF (0.001 F). τ = R × C = ___ second(s).', blank: '___', answer: '1', hint: 'Multiply 1000 by 0.001.' },
      { type: 'multiple_choice', difficulty: 2, question: 'R = 10 kΩ, C = 100 µF. What is the time constant?', options: ['1 second', '0.1 second', '10 seconds', '1000 seconds'], correct: 0, explanation: 'τ = 10,000 × 0.0001 F = 1 s. The classic trap is forgetting to convert µF to farads.' },
      { type: 'predict_reading', difficulty: 2, question: 'A 5V supply charges an RC circuit with τ = 2 s. About what voltage is on the capacitor after 2 seconds (one τ)?', options: ['About 3.2 V', 'About 5 V', 'About 0.5 V', 'About 2 V'], correct: 0, explanation: 'After one τ it reaches ~63% of 5V ≈ 3.2 V.' },
      { type: 'choose_resistor', difficulty: 2, question: 'You want τ = 1 s using a 100 µF capacitor. Which resistor?', options: ['10 kΩ', '100 Ω', '1 kΩ', '1 MΩ'], correct: 0, explanation: 'R = τ / C = 1 / 0.0001 = 10,000 Ω = 10 kΩ.' },

      // Tier 3: reason
      { type: 'predict_reading', difficulty: 3, question: 'A 10V supply, τ = 1 s. About what voltage is on the capacitor after 2 seconds (two τ)?', options: ['About 8.6 V', 'About 6.3 V', 'About 10 V', 'About 5 V'], correct: 0, explanation: 'After 1τ: 63% of 10 = 6.3V. The second τ covers 63% of the remaining 3.7V (~2.3V), giving ~8.6V (the 86% point).' },
      { type: 'multiple_choice', difficulty: 3, question: 'Two RC circuits: A is 1 kΩ + 1000 µF, B is 100 kΩ + 10 µF. How do their time constants compare?', options: ['They are equal (both 1 s)', 'A is 10× faster', 'B is 100× faster', 'A is 100× slower'], correct: 0, explanation: 'A: 1000 × 0.001 = 1 s. B: 100,000 × 0.00001 = 1 s. Same τ from a small-R-big-C versus big-R-small-C trade.' },
      { type: 'predict_behavior', difficulty: 3, question: 'You halve R and double C. What happens to the time constant?', options: ['It stays the same', 'It doubles', 'It halves', 'It quadruples'], correct: 0, explanation: 'τ = R × C. Halving one and doubling the other leaves the product unchanged.' },
    ],
  },

  'Calculating RC Timing': {
    xpReward: 35,
    steps: [
      { type: 'teach', title: 'Designing a Delay', body: 'Turn the time constant around to design timing. To hit a target τ, pick two of R, C, τ and solve for the third:\n\nτ = R × C → R = τ / C → C = τ / R\n\nThe only trap is units: convert µF to farads (÷1,000,000) before you multiply, or your answer is off by a million.' },

      // Tier 1: recall
      { type: 'fill_blank', difficulty: 1, prompt: 'Rearranged for resistance: R = τ / ___.', blank: '___', answer: 'C', hint: 'Divide the time constant by the capacitance.' },
      { type: 'multiple_choice', difficulty: 1, question: 'Before multiplying R × C, what must you do with a value in µF?', options: ['Convert it to farads, dividing by a million', 'Multiply the value up by a million first', 'Leave it in µF and multiply as is', 'Convert the capacitance into ohms'], correct: 0, explanation: 'The formula needs farads, so 100 µF becomes 0.0001 F first.' },
      { type: 'true_false', difficulty: 1, statement: 'For a fixed capacitor, a bigger resistor gives a longer time constant.', correct: true, explanation: 'Yes. τ = R × C, so raising R raises τ.' },

      // Tier 2: one calculation
      { type: 'fill_blank', difficulty: 2, prompt: 'R = 47 kΩ, C = 10 µF. τ = R × C = ___ seconds. (47,000 × 0.00001)', blank: '___', answer: '0.47', hint: '47,000 × 0.00001.' },
      { type: 'choose_resistor', difficulty: 2, question: 'You want a 0.5 s time constant with a 10 µF capacitor. Pick the resistor.', options: ['50 kΩ', '5 kΩ', '500 kΩ', '500 Ω'], correct: 0, explanation: 'R = τ / C = 0.5 / 0.00001 = 50,000 Ω = 50 kΩ.' },
      { type: 'multiple_choice', difficulty: 2, question: 'R = 1 MΩ (1,000,000 Ω) and C = 1 µF. What is τ?', options: ['1 second', '1 millisecond', '1000 seconds', '0.001 second'], correct: 0, explanation: 'τ = 1,000,000 × 0.000001 = 1 s.' },
      { type: 'predict_reading', difficulty: 2, question: 'τ = 0.2 s on a 5V supply. Roughly how long until the capacitor is "fully" charged (≈5τ)?', options: ['About 1 second', 'About 0.2 second', 'About 5 seconds', 'About 0.04 second'], correct: 0, explanation: '5τ = 5 × 0.2 = 1 s for the cap to reach ~99% of 5V.' },

      // Tier 3: multi-step
      { type: 'multiple_choice', difficulty: 3, question: 'You need a capacitor to reach ~63% of the supply in 1 ms, using a 10 kΩ resistor. Which capacitor?', options: ['0.1 µF (100 nF)', '10 µF', '1 µF', '100 µF'], correct: 0, explanation: 'τ = 1 ms = 0.001 s. C = τ / R = 0.001 / 10,000 = 1e-7 F = 0.1 µF = 100 nF.' },
      { type: 'choose_resistor', difficulty: 3, question: 'A 555-style timer needs τ ≈ 1.1 s using a 100 µF capacitor. Pick the nearest standard resistor.', options: ['10 kΩ', '1 kΩ', '100 kΩ', '1 MΩ'], correct: 0, explanation: 'R = τ / C = 1.1 / 0.0001 = 11,000 Ω; the nearest common value is 10 kΩ.' },
      { type: 'predict_behavior', difficulty: 3, question: 'A delay using 100 µF runs twice as long as you want. Keeping the same capacitor, what fixes it?', options: ['Halve the resistor', 'Double the resistor', 'Double the capacitor', 'Raise the supply voltage'], correct: 0, explanation: 'Delay scales with τ = R × C. Halving R halves τ and so halves the delay; changing the supply does not move τ.' },
    ],
  },

  'Smoothing and Decoupling': {
    xpReward: 30,
    steps: [
      { type: 'teach', title: 'Steadying the Supply', body: 'Two of the most common capacitor jobs both lean on "resists voltage change":\n\n• A smoothing (reservoir) capacitor across a supply fills in dips and shaves ripple, turning a bumpy voltage into a steadier one. These are large electrolytics.\n• A decoupling (bypass) capacitor sits right beside a chip\'s power pins and supplies sudden current bursts locally, so the chip does not yank the whole rail down. These are small ceramics, often 100 nF.' },

      // Tier 1: recall
      { type: 'multiple_choice', difficulty: 1, question: 'A smoothing capacitor across a supply is used to...', options: ['Reduce ripple and fill in voltage dips', 'Raise the supply to a higher voltage', 'Add extra resistance into the rail', 'Block all current from flowing'], correct: 0, explanation: 'It stores charge and releases it during dips, smoothing the supply.' },
      { type: 'multiple_choice', difficulty: 1, question: 'A decoupling (bypass) capacitor belongs...', options: ['Right next to a chip\'s power pins', 'As far from the chip as possible', 'In series with the signal', 'Across the crystal only'], correct: 0, explanation: 'Placed close to the pins, it supplies fast current bursts locally before the rail can sag.' },
      { type: 'true_false', difficulty: 1, statement: 'A 100 nF ceramic is a typical decoupling capacitor value.', correct: true, explanation: 'Yes. The ubiquitous 100 nF ("104") ceramic sits beside almost every logic chip.' },

      // Tier 2: apply
      { type: 'predict_behavior', difficulty: 2, question: 'A motor on the same supply makes a chip reset randomly. Adding a decoupling capacitor near the chip likely...', options: ['Steadies the local voltage and stops the resets', 'Speeds the motor up noticeably as a bonus', 'Increases the overall supply voltage level', 'Has no real effect on the problem'], correct: 0, explanation: 'The cap absorbs the motor\'s noise and supplies the chip during dips, keeping its voltage stable.' },
      { type: 'multiple_choice', difficulty: 2, question: 'For a power-supply reservoir that must hold up the rail through big dips, you want...', options: ['A large electrolytic of several thousand µF', 'A tiny 10 pF ceramic disc capacitor', 'No capacitor on that supply rail at all', 'An ordinary resistor used in its place'], correct: 0, explanation: 'Holding up a rail needs lots of stored charge, so a large electrolytic.' },
      { type: 'multiple_choice', difficulty: 2, question: 'Why pair a big electrolytic with a small ceramic on the same rail?', options: ['The electrolytic covers slow dips, the ceramic fast noise', 'Two capacitors simply look more professional on a board', 'The small ceramic is there to charge up the electrolytic', 'Putting them together doubles the supply voltage'], correct: 0, explanation: 'Big caps are slow but hold lots of charge; small ceramics respond fast. Together they cover both timescales.' },

      // Tier 3: reason
      { type: 'predict_behavior', difficulty: 3, question: 'You remove all decoupling caps from a fast digital board. What is the likely symptom?', options: ['Glitches and resets as the rail dips on spikes', 'The board now runs cooler and a bit faster', 'Nothing changes at all in its behaviour', 'The supply voltage rises higher than before'], correct: 0, explanation: 'Without local charge stores, fast current demands make the rail sag and bounce, causing logic glitches and resets.' },
      { type: 'match', difficulty: 3, instruction: 'Match each capacitor role to its description.', pairs: [['Smoothing (reservoir)', 'Large electrolytic, fills supply dips'], ['Decoupling (bypass)', 'Small ceramic at the chip pins'], ['100 nF ceramic', 'Fast high-frequency noise'], ['1000 µF electrolytic', 'Slow, large energy storage']] },
    ],
  },

  'Coupling and Blocking DC': {
    xpReward: 30,
    steps: [
      { type: 'teach', title: 'Pass the Wiggle, Block the Level', body: 'A capacitor in series with a signal blocks steady DC but lets the changing (AC) part through. Once charged to the DC level, no more steady current flows, but any wiggle on top keeps charging and discharging it, so the wiggle passes. This is a coupling (or DC-blocking) capacitor.' },
      { type: 'teach', title: 'Why It Matters', body: 'Audio and sensor stages often ride a small signal on top of a DC bias. A coupling capacitor passes the signal from one stage to the next while stripping off the DC offset, so the next stage sees only the wiggle. The lower the frequency, the larger the capacitor you need to pass it cleanly.' },

      // Tier 1: recall
      { type: 'multiple_choice', difficulty: 1, question: 'A series (coupling) capacitor blocks ___ and passes ___.', options: ['the steady DC level; the changing AC signal', 'the changing AC signal; the steady DC level', 'all of the current; none of the current', 'the voltage entirely; the current entirely'], correct: 0, explanation: 'It blocks the steady DC level and passes the changing part of the signal.' },
      { type: 'true_false', difficulty: 1, statement: 'Once a series capacitor charges to a steady DC voltage, no further steady current flows through it.', correct: true, explanation: 'Yes. Steady DC charges it once and then stops; that is why it blocks DC.' },
      { type: 'multiple_choice', difficulty: 1, question: 'A capacitor used to pass a signal from one stage to the next is called a...', options: ['Coupling capacitor', 'Smoothing capacitor', 'Decoupling capacitor', 'Timing capacitor'], correct: 0, explanation: 'Coupling (DC-blocking) capacitors carry the signal between stages.' },

      // Tier 2: apply
      { type: 'predict_behavior', difficulty: 2, question: 'An audio signal sits on a 2.5V DC bias. After a coupling capacitor, what does the next stage see?', options: ['The wiggle alone, with the DC offset removed', 'Only the steady 2.5V bias, with no signal', 'Double the original voltage, offset and all', 'Nothing at all, the signal is gone'], correct: 0, explanation: 'The cap blocks the 2.5V DC and passes the AC wiggle, so the next stage sees the signal without the offset.' },
      { type: 'multiple_choice', difficulty: 2, question: 'A coupling capacitor passes high frequencies fine but weakens low frequencies. To pass lower frequencies, you should...', options: ['Use a larger capacitor', 'Use a smaller capacitor', 'Remove the capacitor', 'Add a resistor in series'], correct: 0, explanation: 'A capacitor\'s opposition to AC (reactance) is larger at low frequencies; a bigger cap lowers it, passing lows better.' },
      { type: 'multiple_choice', difficulty: 2, question: 'How does a capacitor\'s opposition to AC (its reactance) change as frequency rises?', options: ['It falls, so high frequencies pass more easily', 'It rises, so high frequencies are blocked more', 'It stays constant no matter the frequency', 'It becomes infinite once frequency is high'], correct: 0, explanation: 'Reactance Xc = 1/(2πfC) falls as frequency rises, so a cap passes higher frequencies more easily.' },

      // Tier 3: reason
      { type: 'multiple_choice', difficulty: 3, question: 'To DC, frequency is effectively zero. What is a capacitor\'s reactance at 0 Hz, and what does that mean?', options: ['Infinite, so it blocks steady DC completely', 'Zero, so it passes steady DC straight through', 'Exactly equal to its capacitance value', 'Negative, so it feeds energy back in'], correct: 0, explanation: 'Xc = 1/(2πfC); as f → 0 the reactance → infinity, so a capacitor blocks steady DC.' },
      { type: 'match', difficulty: 3, instruction: 'Match each capacitor use to where it sits and what it does.', pairs: [['Coupling', 'In series; passes AC, blocks DC'], ['Decoupling', 'To ground; steadies a supply pin'], ['Smoothing', 'Across the rail; fills supply dips'], ['Timing', 'With a resistor; sets a delay']] },
    ],
  },

  'The RC Low-Pass Filter': {
    xpReward: 35,
    steps: [
      { type: 'teach', title: 'A Resistor and Cap That Filter', body: 'Put a resistor in series and a capacitor to ground, and take the output across the capacitor: that is an RC low-pass filter. Slow (low-frequency) signals charge the cap and appear at the output; fast (high-frequency) wiggles are shorted to ground by the cap and are attenuated. It smooths and removes high-frequency noise.', circuitDiagram: 'rc_low_pass' },
      { type: 'teach', title: 'The Cutoff Frequency', body: 'The cutoff (corner) frequency is where the filter starts cutting:\n\nfc = 1 / (2π × R × C)\n\nBelow fc, signals pass; above it, they are increasingly attenuated. Swap R and C positions (cap in series, resistor to ground) and you get a high-pass filter instead.', circuitDiagram: 'rc_low_pass' },

      // Tier 1: recall
      { type: 'identify_component', difficulty: 1, question: 'Click the component that shunts high frequencies to ground in this low-pass filter.', circuitDiagram: 'rc_low_pass', correctComponent: 'capacitor', explanation: 'The capacitor to ground passes high frequencies to ground, leaving the slow signal at the output.' },
      { type: 'multiple_choice', difficulty: 1, question: 'A low-pass filter lets which signals through to the output?', options: ['Low frequencies', 'High frequencies', 'Only DC, nothing else', 'No signals at all'], correct: 0, explanation: 'Low frequencies pass; high frequencies are attenuated, hence "low-pass".' },
      { type: 'true_false', difficulty: 1, statement: 'In an RC low-pass filter, the output is taken across the capacitor.', correct: true, explanation: 'Yes. The voltage across the cap is the filtered (smoothed) output.' },

      // Tier 2: apply
      { type: 'predict_behavior', difficulty: 2, question: 'A noisy sensor signal has a slow trend plus high-frequency hash. After an RC low-pass filter, the output shows...', circuitDiagram: 'rc_low_pass', options: ['The slow trend, with the hash smoothed away', 'Only the fast hash, with the trend removed', 'Nothing useful, the whole signal is lost', 'A doubled copy of the original signal'], correct: 0, explanation: 'The filter passes the slow trend and attenuates the fast hash, cleaning the signal.' },
      { type: 'multiple_choice', difficulty: 2, question: 'You raise the capacitor value in a low-pass filter. The cutoff frequency...', options: ['Falls, giving more aggressive smoothing', 'Rises, letting more high frequencies through', 'Stays the same regardless of the value', 'Becomes negative and inverts the signal'], correct: 0, explanation: 'fc = 1/(2πRC); a larger C lowers fc, so it cuts more of the higher frequencies.' },
      { type: 'multiple_choice', difficulty: 2, question: 'Swapping the resistor and capacitor positions (cap in series, R to ground) turns it into a...', options: ['High-pass filter', 'Voltage doubler', 'Rectifier', 'Lower-value low-pass'], correct: 0, explanation: 'Cap in series blocks lows and passes highs, the opposite job: a high-pass filter.' },

      // Tier 3: reason
      { type: 'predict_reading', difficulty: 3, question: 'R = 1.6 kΩ and C = 0.1 µF. Using fc = 1/(2πRC), the cutoff is closest to...', circuitDiagram: 'rc_low_pass', options: ['About 1 kHz', 'About 1 Hz', 'About 1 MHz', 'About 10 kHz'], correct: 0, explanation: 'fc = 1/(2π × 1600 × 1e-7) ≈ 1/(0.001) ≈ 1000 Hz = 1 kHz.' },
      { type: 'multiple_choice', difficulty: 3, question: 'A PWM dimming signal switches fast but you want a steady average voltage out. Which filter, and roughly which cutoff?', options: ['A low-pass with cutoff well below the PWM frequency', 'A high-pass with a high cutoff', 'A low-pass with cutoff above the PWM frequency', 'No filter can do this'], correct: 0, explanation: 'A low-pass with fc far below the switching rate averages the pulses into a smooth DC level.' },
      { type: 'multiple_choice', difficulty: 3, question: 'Why does the very same RC pair describe both a "time constant" and a "filter cutoff"?', options: ['Both come from how fast the cap charges through R', 'They are unrelated and merely happen to share letters', 'The filter behaviour actually ignores the capacitor', 'Time constants only apply to DC and never to AC'], correct: 0, explanation: 'They are two views of one behaviour: τ = RC sets the speed, and fc = 1/(2πRC) is its frequency view. A slow RC means a low cutoff.' },
    ],
  },

  'RC Timing in Practice': {
    xpReward: 30,
    steps: [
      { type: 'teach', title: 'Turning a Curve Into a Delay', body: 'A charging capacitor crosses a chosen voltage at a predictable time, so RC is a simple way to make a delay or a slow ramp. Connect the RC midpoint to something that reacts at a threshold and you get a timed event: an LED that fades, a delay before a circuit triggers, or the soft start of a signal.' },
      { type: 'teach', title: 'RC vs the Microcontroller', body: 'On an Arduino you usually time with millis() or delay() in code, which is precise and easy to change. Pure RC timing still matters: it sets debounce times, fade rates, filter behaviour, and the timing of analog chips like the 555. Knowing both lets you choose the right tool.' },

      // Tier 1: recall
      { type: 'multiple_choice', difficulty: 1, question: 'An RC circuit makes a good simple...', options: ['Delay or timing element', 'Steady voltage source', 'Signal amplifier', 'Digital logic gate'], correct: 0, explanation: 'The predictable charging curve is naturally a timing element.' },
      { type: 'true_false', difficulty: 1, statement: 'On an Arduino, millis() and delay() are usually easier to adjust than a hardware RC delay.', correct: true, explanation: 'Yes. Code timing is precise and changed by editing a number; RC timing means swapping parts.' },
      { type: 'multiple_choice', difficulty: 1, question: 'Which of these still relies on RC timing even when a microcontroller is present?', options: ['Hardware button debounce and signal filtering', 'Storing the compiled program in memory', 'Doing the floating-point math in code', 'Driving the USB data port to the host'], correct: 0, explanation: 'Debounce networks and filters use RC even alongside code.' },

      // Tier 2: apply
      { type: 'predict_behavior', difficulty: 2, question: 'You add an RC network to a bouncing button so the voltage cannot jump instantly. What does this achieve?', options: ['It smooths the bounce so one press reads as one event', 'It makes the button respond noticeably faster', 'It removes the need for any pull resistor', 'It supplies the power the button needs'], correct: 0, explanation: 'The RC slows the edge so the rapid bounce is filtered out, a hardware debounce.' },
      { type: 'choose_resistor', difficulty: 2, question: 'You want roughly a 0.1 s RC debounce using a 1 µF capacitor. Pick the resistor.', options: ['100 kΩ', '1 kΩ', '10 kΩ', '1 MΩ'], correct: 0, explanation: 'R = τ / C = 0.1 / 0.000001 = 100,000 Ω = 100 kΩ.' },
      { type: 'multiple_choice', difficulty: 2, question: 'An RC-faded LED fades too quickly. To slow the fade you should...', options: ['Increase R or C', 'Decrease R and C', 'Raise the supply voltage', 'Use a smaller LED'], correct: 0, explanation: 'A longer time constant (bigger R or C) stretches the fade.' },

      // Tier 3: reason
      { type: 'multiple_choice', difficulty: 3, question: 'A hardware RC debounce works but you also want to change the debounce time often during testing. The better approach is...', options: ['Debounce in code with millis(), just editing a number', 'Solder a different resistor in for each new test', 'Remove the button from the circuit entirely', 'Swap in a larger LED to slow things down'], correct: 0, explanation: 'Code timing is trivially adjustable; this is exactly when you prefer millis() over a fixed RC.' },
      { type: 'predict_behavior', difficulty: 3, question: 'A circuit must wait ~1 s after power-up before enabling, with no microcontroller. A reasonable analog approach is...', options: ['An RC that crosses a threshold in ~1 s to enable it', 'A bare wire straight from power to the enable pin', 'A larger LED placed in series with the load', 'A second battery added to the supply rail'], correct: 0, explanation: 'Size R and C so the cap crosses the enable threshold around 1τ–2τ ≈ 1 s, a classic analog power-on delay.' },
    ],
  },

  'The 555 Timer': {
    xpReward: 35,
    steps: [
      { type: 'teach', title: 'The Timing Chip', body: 'The 555 is a classic timer chip built around RC timing. You hang a resistor (or two) and a capacitor on it, and it produces precise timing without a microcontroller. It has two main modes:\n\n• Monostable: one output pulse of a set length when triggered (a one-shot).\n• Astable: a free-running square wave that oscillates on its own (a blinker or tone source).' },
      { type: 'teach', title: 'RC Sets the Timing', body: 'In both modes the external resistor(s) and capacitor set the times through the time constant you already know. Bigger R or C means longer pulses or slower oscillation. The 555 just watches the capacitor charge and discharge between two internal thresholds and flips its output accordingly.' },

      // Tier 1: recall
      { type: 'multiple_choice', difficulty: 1, question: 'The 555 is best described as a...', options: ['Timer / oscillator chip', 'Voltage regulator', 'Microcontroller', 'Type of capacitor'], correct: 0, explanation: 'It is a dedicated timing chip used for one-shots and oscillators.' },
      { type: 'multiple_choice', difficulty: 1, question: 'Which 555 mode produces a continuous square wave on its own?', options: ['Astable', 'Monostable', 'Bistable only', 'It cannot oscillate'], correct: 0, explanation: 'Astable mode free-runs, producing a repeating square wave.' },
      { type: 'multiple_choice', difficulty: 1, question: 'Which 555 mode gives a single output pulse when triggered?', options: ['Monostable (one-shot)', 'Astable', 'Free-running', 'Continuous'], correct: 0, explanation: 'Monostable fires one pulse of a set length per trigger.' },
      { type: 'true_false', difficulty: 1, statement: 'The 555\'s timing is set by an external resistor and capacitor.', correct: true, explanation: 'Yes. The external RC sets the pulse length or oscillation rate.' },

      // Tier 2: apply
      { type: 'predict_behavior', difficulty: 2, question: 'In a 555 astable LED blinker, you increase the timing capacitor. The LED blinks...', options: ['More slowly', 'More quickly', 'Brighter', 'Not at all'], correct: 0, explanation: 'A larger C lengthens the charge/discharge times, so the oscillation slows and the blink rate drops.' },
      { type: 'multiple_choice', difficulty: 2, question: 'You want a 555 blinker to run faster. Two valid changes are...', options: ['A smaller timing resistor or a smaller capacitor', 'A larger resistor along with a larger capacitor', 'Raising only the supply voltage to the chip', 'Fitting a physically bigger indicator LED'], correct: 0, explanation: 'Both shorten the RC times, raising the oscillation frequency.' },
      { type: 'multiple_choice', difficulty: 2, question: 'Why might you choose a 555 over an Arduino just to blink an LED?', options: ['It is cheap and needs no code for a fixed timer', 'It is much faster at doing floating-point math', 'It has far more program memory available', 'It can run a complete operating system'], correct: 0, explanation: 'For a single fixed timing job, a 555 is a cheap, code-free, rugged solution.' },

      // Tier 3: reason
      { type: 'multiple_choice', difficulty: 3, question: 'A 555 astable uses roughly t ≈ 0.7 × R × C for its timing. With R = 10 kΩ and C = 100 µF, each phase lasts about...', options: ['About 0.7 s', 'About 7 s', 'About 70 ms', 'About 7 ms'], correct: 0, explanation: '0.7 × 10,000 × 0.0001 = 0.7 s per phase, so a roughly 1.4 s period (slow, visible blink).' },
      { type: 'multiple_choice', difficulty: 3, question: 'You need timing you can reprogram on the fly and log over serial. 555 or Arduino?', options: ['Arduino: its timing is software you can change and report', '555: it is the only one that can be reprogrammed', 'Neither part is able to time anything at all', 'Both are exactly identical in their flexibility'], correct: 0, explanation: 'When you need adjustable, observable, logic-rich timing, the microcontroller wins; the 555 shines for fixed, simple, cheap timing.' },
      { type: 'match', difficulty: 3, instruction: 'Match each term to its meaning.', pairs: [['Astable', 'Free-running oscillator'], ['Monostable', 'One pulse per trigger'], ['Timing R and C', 'Set the pulse or rate'], ['Larger C', 'Slower, longer timing']] },
    ],
  },

  'Unit 6 Checkpoint': {
    xpReward: 50,
    steps: [
      { type: 'multiple_choice', question: 'A capacitor stores...', options: ['Electrical charge', 'A magnetic field', 'Resistance', 'Heat'], correct: 0, explanation: 'Charge on its plates.' },
      { type: 'multiple_choice', question: 'Which capacitor type is polarised?', options: ['Electrolytic', 'Ceramic', 'Both', 'Neither'], correct: 0, explanation: 'Electrolytics must be wired the right way round.' },
      { type: 'fill_blank', prompt: '0.1 µF written in nanofarads is ___ nF.', blank: '___', answer: '100', hint: 'A microfarad is a thousand nanofarads; take a tenth.' },
      { type: 'multiple_choice', question: 'R = 10 kΩ, C = 100 µF. The time constant τ is...', options: ['1 second', '0.1 second', '10 seconds', '100 seconds'], correct: 0, explanation: 'τ = 10,000 × 0.0001 = 1 s.' },
      { type: 'multiple_choice', question: 'After one time constant, a charging capacitor reaches about...', options: ['63% of the supply', '100% of the supply', '50% of the supply', '10% of the supply'], correct: 0, explanation: 'One τ ≈ 63% of the way there.' },
      { type: 'choose_resistor', question: 'You want τ = 1 s with a 100 µF capacitor. Pick R.', options: ['10 kΩ', '1 kΩ', '100 kΩ', '1 MΩ'], correct: 0, explanation: 'R = τ / C = 1 / 0.0001 = 10 kΩ.' },
      { type: 'identify_component', question: 'Click the component that shunts high frequencies to ground in this low-pass filter.', circuitDiagram: 'rc_low_pass', correctComponent: 'capacitor', explanation: 'The capacitor to ground passes highs to ground.' },
      { type: 'predict_behavior', question: 'In a 555 astable blinker, a larger timing capacitor makes the LED blink...', options: ['More slowly', 'More quickly', 'Brighter', 'Not at all'], correct: 0, explanation: 'Bigger C means longer RC times, so slower oscillation.' },
      { type: 'match', instruction: 'Match each capacitor job to its description.', pairs: [['Smoothing', 'Fills supply dips (big electrolytic)'], ['Decoupling', 'Steadies a chip pin (100 nF)'], ['Coupling', 'Passes AC, blocks DC'], ['Timing', 'Sets a delay with a resistor']] },
    ],
  },

  // ═══════════════════ Unit 7: Transistors & Switching ═══════════════════
  // Grounded in STG Ch.3 (BJT, beta), EAC Vol.1 (flyback/freewheeling diode),
  // PEI Ch.4 (transistors/MOSFETs). See content/CURRICULUM_CITATIONS.md.

  'What a Transistor Is': {
    xpReward: 25,
    steps: [
      { type: 'teach', title: 'A Current-Controlled Valve', body: 'A bipolar transistor (BJT) is a three-terminal part: base, collector, and emitter. A small current into the base controls a much larger current flowing from collector to emitter. Think of the base as a valve handle: a little effort there controls a big flow. The common NPN type is the one you will meet first.' },
      { type: 'teach', title: 'Base Current Lets Collector Current Flow', body: 'The rule for an NPN: collector current only flows when base current flows. No base current, no collector current (the transistor is off). Push enough base current and the collector current flows freely (the transistor is on). That control is the whole point.' },

      // Tier 1: recall
      { type: 'multiple_choice', difficulty: 1, question: 'How many terminals does a bipolar transistor have?', options: ['Three: base, collector, emitter', 'Two, like a plain resistor', 'Four, like a small bridge', 'One, a single shared pin'], correct: 0, explanation: 'A BJT has three terminals: base, collector, and emitter.' },
      { type: 'multiple_choice', difficulty: 1, question: 'In an NPN transistor, what controls the collector current?', options: ['A small current into the base', 'The colour of the package', 'The length of the emitter lead', 'The ambient room lighting'], correct: 0, explanation: 'A small base current controls the much larger collector-to-emitter current.' },
      { type: 'true_false', difficulty: 1, statement: 'In an NPN transistor, collector current flows only when base current flows.', correct: true, explanation: 'Yes. No base current means the transistor is off and no collector current flows.' },

      // Tier 2: apply
      { type: 'predict_behavior', difficulty: 2, question: 'You remove the base current from a conducting NPN transistor. What happens to the collector current?', options: ['It stops, the transistor turns off', 'It rises to its maximum value', 'It stays exactly the same', 'It reverses its direction'], correct: 0, explanation: 'With no base drive, the transistor switches off and the collector current stops.' },
      { type: 'multiple_choice', difficulty: 2, question: 'Why call a transistor a "current amplifier" in this mode?', options: ['A tiny base current commands a much bigger one', 'It physically makes the wires carry more', 'It raises the supply voltage internally', 'It stores energy and releases it later'], correct: 0, explanation: 'A small base current controls a far larger collector current, so a small signal commands a big one.' },
      { type: 'identify_component', difficulty: 2, question: 'Click the transistor in this switching circuit.', circuitDiagram: 'transistor_switch', correctComponent: 'transistor', explanation: 'That is the NPN transistor; its base is driven through Rb, and it switches the collector current.' },

      // Tier 3: reason
      { type: 'multiple_choice', difficulty: 3, question: 'A transistor is described as "two diodes back to back" (base-emitter and base-collector). Why is it still more than just two diodes?', options: ['Base current lets a much larger collector current flow', 'Diodes can never be built into one package', 'It blocks current in both directions equally', 'It only works with alternating current'], correct: 0, explanation: 'The junctions interact: a small base-emitter current enables a large collector current. Two separate diodes cannot do that.' },
      { type: 'match', difficulty: 3, instruction: 'Match each transistor terminal or idea to its role.', pairs: [['Base', 'The control input'], ['Collector', 'Where the big current enters'], ['Emitter', 'Where the current leaves'], ['No base current', 'Transistor is off'], ['Enough base current', 'Transistor is on']] },
    ],
  },

  'The Transistor as a Switch': {
    xpReward: 30,
    steps: [
      { type: 'teach', title: 'Fully On or Fully Off', body: 'Used as a switch, a transistor lives at two extremes. Off (cutoff): no base current, so no collector current, like an open switch. On (saturation): plenty of base current, so the collector current is limited only by the load, like a closed switch with a tiny voltage drop across it. A microcontroller pin drives the base to flip between the two.' },
      { type: 'teach', title: 'Why Not Drive the Load Directly?', body: 'An Arduino pin can only source about 20 to 40 mA at 5V. A motor, relay, or bright lamp needs far more current, or a higher voltage. The transistor lets the weak pin control a strong load: the pin drives the base, the load runs from its own supply through the collector.' },

      // Tier 1: recall
      { type: 'multiple_choice', difficulty: 1, question: 'As a switch, a transistor operates in which two states?', options: ['Fully off (cutoff) and fully on (saturation)', 'Constantly half-on, hovering between the two states', 'Only ever partly on, never reaching either end', 'Off in one direction and reversed in the other'], correct: 0, explanation: 'Switching uses the two extremes: cutoff (off) and saturation (fully on).' },
      { type: 'multiple_choice', difficulty: 1, question: 'Roughly how much current can a single Arduino pin safely source?', options: ['About 20 to 40 mA', 'About 2 to 4 amps', 'About 500 mA', 'Effectively unlimited'], correct: 0, explanation: 'A pin handles tens of milliamps; bigger loads need a transistor.' },
      { type: 'true_false', difficulty: 1, statement: 'A saturated (fully on) transistor acts roughly like a closed switch.', correct: true, explanation: 'Yes. In saturation it drops only a small voltage and passes the load current, like a closed switch.' },

      // Tier 2: apply
      { type: 'predict_behavior', difficulty: 2, question: 'A pin drives a transistor base HIGH through a resistor. The transistor saturates. What does the load do?', circuitDiagram: 'transistor_switch', options: ['It turns on, drawing current through the collector', 'It stays off no matter how hard the base is driven', 'It runs at exactly half power, dim and steady', 'It draws its current entirely from the base pin'], correct: 0, explanation: 'Saturated, the transistor connects the load to its supply, so the load turns on.' },
      { type: 'multiple_choice', difficulty: 2, question: 'Why use a transistor to switch a 1A motor from a 5V pin?', options: ['The pin is too weak to drive the motor directly', 'A pin cannot output any voltage at all', 'Motors only run on transistor current', 'It makes the motor spin in reverse'], correct: 0, explanation: 'The pin cannot source an amp; the transistor lets the weak pin control the strong motor.' },
      { type: 'predict_behavior', difficulty: 2, question: 'The pin goes LOW, removing base drive. What happens to the load?', circuitDiagram: 'transistor_switch', options: ['It turns off (transistor in cutoff)', 'It stays fully on as if nothing changed', 'It dims to roughly half brightness and holds', 'It briefly speeds up before settling down'], correct: 0, explanation: 'No base current means cutoff, so the collector current stops and the load turns off.' },

      // Tier 3: reason
      { type: 'multiple_choice', difficulty: 3, question: 'You want a transistor as a clean switch, not a dimmer. Why aim for full saturation rather than a partial "on"?', options: ['Saturation drops little voltage so it runs cool; partial-on wastes power as heat', 'A partly-on transistor cannot pass any current to the load, so nothing happens', 'Full saturation is the one and only permitted way you may use a transistor', 'A partly-on transistor instantly and permanently damages the load every time'], correct: 0, explanation: 'Half-on, the transistor drops significant voltage while passing current, so P = V×I heats it up. Full saturation minimises that loss.' },
      { type: 'multiple_choice', difficulty: 3, question: 'A pin sources 20 mA. You must switch a 12V, 120 mA relay coil. The pin alone is wrong on two counts. Which?', options: ['It cannot supply 120 mA and cannot reach 12V', 'It supplies too much current and too high a voltage', 'It is too fast and too precise for the relay', 'It only works with capacitors, not coils'], correct: 0, explanation: 'The pin tops out near 20 mA and at 5V; the coil needs 120 mA at 12V. A transistor switches the coil from the 12V supply.' },
    ],
  },

  'Current Gain (Beta)': {
    xpReward: 30,
    steps: [
      { type: 'teach', title: 'Beta Ties the Two Currents', body: 'The collector current is a fixed multiple of the base current. That multiple is the current gain, written β (beta), sometimes labelled hFE on a datasheet:\n\nβ = Ic / Ib\n\nTypical values run from about 10 to 300. So a base current of 1 mA with β = 100 allows up to 100 mA of collector current.' },
      { type: 'teach', title: 'Working Backwards', body: 'For switching you usually know the load (collector) current you need and want the base current to ask for. Rearrange:\n\nIb = Ic / β\n\nUse the LOWEST β the part might have, so you guarantee enough base current even for a weak sample. Then deliberately drive a bit more to force full saturation.' },

      // Tier 1: recall
      { type: 'fill_blank', difficulty: 1, prompt: 'Current gain is collector current divided by base current: β = Ic / ___.', blank: '___', answer: 'Ib', hint: 'The control current, into the base.' },
      { type: 'multiple_choice', difficulty: 1, question: 'On a datasheet, the DC current gain is often labelled...', options: ['hFE', 'Vcc', 'ESR', 'RPM'], correct: 0, explanation: 'hFE is the datasheet name for the DC current gain, β.' },
      { type: 'multiple_choice', difficulty: 1, question: 'A typical small-signal transistor β is in roughly what range?', options: ['About 10 to 300', 'About 0.1 to 1', 'About 5,000 to 9,000', 'Exactly 1 every time'], correct: 0, explanation: 'Real β values commonly land between about 10 and 300.' },

      // Tier 2: one calculation
      { type: 'fill_blank', difficulty: 2, prompt: 'Base current 1 mA, collector current 150 mA. The current gain β is ___.', blank: '___', answer: '150', hint: 'Divide the collector current by the base current.' },
      { type: 'multiple_choice', difficulty: 2, question: 'Ic = 200 mA and Ib = 2 mA. What is β?', options: ['100', '400', '40', '10'], correct: 0, explanation: 'β = Ic / Ib = 200 / 2 = 100.' },
      { type: 'predict_reading', difficulty: 2, question: 'You need Ic = 300 mA and the transistor\'s β is 150. What base current does that require, as a minimum?', options: ['2 mA', '20 mA', '0.5 mA', '45 mA'], correct: 0, explanation: 'Ib = Ic / β = 300 / 150 = 2 mA (minimum; drive a little more to saturate).' },
      { type: 'multiple_choice', difficulty: 2, question: 'When sizing base current for a switch, which β should you assume?', options: ['The lowest β the part might have', 'The single highest β ever measured on a good sample', 'Exactly β = 1 in every single case', 'Any random value, since it makes no difference'], correct: 0, explanation: 'Designing for the lowest β guarantees enough base current for every sample.' },

      // Tier 3: reason
      { type: 'multiple_choice', difficulty: 3, question: 'A circuit relies on exactly β = 200 to just barely saturate. Why is that fragile?', options: ['β varies part to part and with heat, so a low-β sample misses saturation', 'β is fixed at exactly 200 for every sample, so the design is completely safe', 'β has no effect whatsoever on whether the transistor saturates', 'A higher β value would simply burn out the base junction'], correct: 0, explanation: 'β scatters widely and drifts with temperature. Design for the minimum β and overdrive the base so any part saturates.' },
      { type: 'predict_reading', difficulty: 3, question: 'Load needs Ic = 120 mA. To force hard saturation you drive 5× the minimum base current, assuming β = 100. What base current is that?', options: ['6 mA', '1.2 mA', '24 mA', '0.6 mA'], correct: 0, explanation: 'Ib(min) = 120 / 100 = 1.2 mA; 5× overdrive = 6 mA, which guarantees full saturation.' },
    ],
  },

  'Sizing the Base Resistor': {
    xpReward: 35,
    steps: [
      { type: 'teach', title: 'Why the Base Needs a Resistor', body: 'The base-emitter junction behaves like a diode: once it conducts, it holds about 0.7V and would pass unlimited current if you let it. So you never connect a pin straight to the base. A series base resistor sets the base current, just like a resistor sets an LED\'s current.' },
      { type: 'teach', title: 'The Base Resistor Formula', body: 'The resistor drops whatever the pin voltage has left after the 0.7V base-emitter drop:\n\nRb = (Vpin − 0.7) / Ib\n\nExample: a 5V pin, wanting Ib = 4.3 mA:\nRb = (5 − 0.7) / 0.0043 ≈ 1000 Ω → a 1 kΩ base resistor.\n\nThe trap: forgetting the 0.7V drop, just like forgetting an LED\'s forward voltage.' },

      // Tier 1: recall
      { type: 'multiple_choice', difficulty: 1, question: 'Why never connect a pin directly to a transistor\'s base?', options: ['The base-emitter junction would draw excessive current', 'The base needs a higher voltage than the pin gives', 'Bases only work with alternating current', 'It would make the transistor too cold'], correct: 0, explanation: 'The base-emitter junction is like a diode; without a resistor it would pass huge, damaging current.' },
      { type: 'fill_blank', difficulty: 1, prompt: 'The base-emitter junction, once conducting, holds about ___ volts.', blank: '___', answer: '0.7', hint: 'The usual silicon junction forward drop.' },
      { type: 'true_false', difficulty: 1, statement: 'A base resistor sets the base current, much as a resistor sets an LED\'s current.', correct: true, explanation: 'Yes. Both use a series resistor to set a safe current into a diode-like junction.' },

      // Tier 2: one calculation
      { type: 'fill_blank', difficulty: 2, prompt: 'A 5V pin drives the base. After the 0.7V drop, the resistor must drop ___ volts.', blank: '___', answer: '4.3', hint: 'The pin voltage minus the base-emitter drop.' },
      { type: 'choose_resistor', difficulty: 2, question: '5V pin, base-emitter 0.7V, target base current about 4.3 mA. Pick the base resistor.', circuitDiagram: 'transistor_switch', options: ['1 kΩ', '100 Ω', '10 kΩ', '100 kΩ'], correct: 0, explanation: 'Rb = (5 − 0.7) / 0.0043 ≈ 1000 Ω = 1 kΩ. 100 Ω passes far too much; 10 kΩ+ starves the base.' },
      { type: 'predict_reading', difficulty: 2, question: '5V pin, 0.7V base drop, a 2.2 kΩ base resistor. The base current is closest to...', options: ['≈ 2 mA', '≈ 4 mA', '≈ 0.5 mA', '≈ 10 mA'], correct: 0, explanation: 'Ib = (5 − 0.7) / 2200 ≈ 1.95 mA ≈ 2 mA.' },
      { type: 'choose_resistor', difficulty: 2, question: 'Same 5V pin, but you now want about 2 mA of base current. Pick the resistor.', circuitDiagram: 'transistor_switch', options: ['2.2 kΩ', '220 Ω', '22 kΩ', '47 kΩ'], correct: 0, explanation: 'Rb = (5 − 0.7) / 0.002 ≈ 2150 Ω; the nearest standard value is 2.2 kΩ.' },

      // Tier 3: multi-step
      { type: 'multiple_choice', difficulty: 3, question: 'Load Ic = 100 mA, transistor β(min) = 100, 5V pin. You want roughly 2× overdrive on the base. Which base resistor is closest?', options: ['About 2.2 kΩ', 'About 22 kΩ', 'About 220 Ω', 'About 47 kΩ'], correct: 0, explanation: 'Ib(min) = 100/100 = 1 mA; 2× = 2 mA. Rb = (5 − 0.7)/0.002 ≈ 2.15 kΩ → 2.2 kΩ.' },
      { type: 'predict_behavior', difficulty: 3, question: 'You forget the 0.7V drop and instead use Rb = 5 / Ib. Compared with the correct value, your resistor is...', options: ['Slightly too large, giving a bit less base current', 'Far too small, dangerously overdriving the base', 'Exactly correct, the drop does not matter', 'Irrelevant, base resistors do nothing'], correct: 0, explanation: 'Using 5 instead of 4.3 makes Rb larger, so Ib is a little lower. It is a small error here, but the habit (subtract the junction drop) matters when the supply is low.' },
      { type: 'multiple_choice', difficulty: 3, question: 'In a saturated switch, why is collector current set by the LOAD and supply, not by β × Ib?', options: ['Fully on in saturation, so the load limits the current', 'In saturation the transistor\'s β value suddenly becomes infinite', 'The base resistor itself takes over and sets the collector current', 'Saturation completely disconnects the collector from the load'], correct: 0, explanation: 'Once saturated, the transistor cannot pass more, so the load and supply set Ic. β × Ib only predicts Ic in the active region, before saturation.' },
    ],
  },

  'Low-Side vs High-Side Switching': {
    xpReward: 30,
    steps: [
      { type: 'teach', title: 'Where the Switch Sits', body: 'An NPN transistor is usually wired as a low-side switch: the load connects to the positive supply, and the transistor sits between the load and ground. When it turns on, it completes the path to ground and the load runs. The load\'s "low" side is what gets switched, hence low-side.' },
      { type: 'teach', title: 'High-Side and Its Catch', body: 'A high-side switch sits between the positive supply and the load instead. It is handy when the load shares a common ground, but switching the high side with an NPN is awkward (the base would need to sit above the supply). High-side switching is usually done with a PNP or a P-channel MOSFET.' },

      // Tier 1: recall
      { type: 'multiple_choice', difficulty: 1, question: 'In an NPN low-side switch, the transistor sits...', options: ['Between the load and ground', 'Between the supply and the load', 'Inside the power supply', 'Across the base resistor'], correct: 0, explanation: 'Low-side: load to V+, transistor from load down to ground.' },
      { type: 'true_false', difficulty: 1, statement: 'An NPN transistor is most naturally used as a low-side switch.', correct: true, explanation: 'Yes. NPN low-side switching is the simplest and most common arrangement.' },
      { type: 'identify_component', difficulty: 1, question: 'Click the load (the relay coil) being switched in this low-side circuit.', circuitDiagram: 'transistor_switch', correctComponent: 'relay', explanation: 'The relay coil is the load; it connects to +12V on top and to the transistor collector below.' },

      // Tier 2: apply
      { type: 'multiple_choice', difficulty: 2, question: 'A high-side switch (between supply and load) is usually built with a...', options: ['PNP or P-channel MOSFET', 'A second NPN with no changes', 'A plain resistor', 'A capacitor to ground'], correct: 0, explanation: 'High-side switching needs a PNP or P-channel device; an NPN there is awkward to drive.' },
      { type: 'predict_behavior', difficulty: 2, question: 'In an NPN low-side switch, the transistor turns on. What does it do to the load\'s ground side?', circuitDiagram: 'transistor_switch', options: ['Connects it to ground, completing the loop', 'Lifts it up to the supply voltage', 'Leaves it floating, doing nothing', 'Shorts it to the base'], correct: 0, explanation: 'Turning on, the transistor pulls the load\'s low side to ground, so current flows and the load runs.' },
      { type: 'multiple_choice', difficulty: 2, question: 'Why is NPN low-side switching so common in beginner projects?', options: ['Simple: the base drive shares the logic\'s ground reference', 'It is genuinely the only way that any load anywhere can be switched', 'It needs no base resistor and no separate supply at all', 'It makes the load run at roughly double its voltage'], correct: 0, explanation: 'The base drive is referenced to the same ground as the logic, so a pin drives it directly through a resistor.' },

      // Tier 3: reason
      { type: 'multiple_choice', difficulty: 3, question: 'Why is it hard to switch the high side with an NPN?', options: ['Its base would have to sit above the supply to turn on', 'NPN transistors cannot conduct any current', 'The high side has no current to switch', 'NPN parts only work below 1V'], correct: 0, explanation: 'To turn fully on as a high-side switch, the NPN base would need a voltage above the supply rail, which is impractical, so a PNP/P-MOSFET is used.' },
      { type: 'match', difficulty: 3, instruction: 'Match each switch arrangement to its description.', pairs: [['NPN low-side', 'Load to V+, transistor to ground'], ['PNP high-side', 'Transistor from V+ to load'], ['Saturated switch', 'Fully on, low voltage drop'], ['Cutoff switch', 'Fully off, no current']] },
    ],
  },

  'Switching Bigger Loads': {
    xpReward: 30,
    steps: [
      { type: 'teach', title: 'When One Transistor Is Not Enough', body: 'A small transistor switches tens to a few hundred milliamps. Bigger loads (large motors, many LEDs, heaters) need more: a power transistor or, more often today, a MOSFET, which can switch many amps with almost no drive current. Either way, the principle is the same: a weak control signal commands a strong load on its own supply.' },
      { type: 'teach', title: 'Heat and Ratings', body: 'A real switch is not perfect: it drops a little voltage while passing current, so it dissipates power (P = V × I) as heat. Pick a device rated for more than your load current and voltage, and add a heatsink if the power gets high. Running a part near its limit is how it fails.' },

      // Tier 1: recall
      { type: 'multiple_choice', difficulty: 1, question: 'For switching several amps with very little drive current, a common modern choice is a...', options: ['MOSFET', 'Single small-signal BJT', 'Plain resistor', 'Ceramic capacitor'], correct: 0, explanation: 'MOSFETs switch large currents and are driven by voltage, needing almost no steady gate current.' },
      { type: 'true_false', difficulty: 1, statement: 'A switching device drops some voltage while conducting, so it gives off heat.', correct: true, explanation: 'Yes. The small on-state voltage times the load current is power dissipated as heat.' },
      { type: 'multiple_choice', difficulty: 1, question: 'When choosing a switching transistor, you should pick one rated for...', options: ['More than the load\'s current and voltage', 'Exactly the load current, no margin', 'Far less than the load needs', 'Only the base current'], correct: 0, explanation: 'Headroom above the load\'s current and voltage keeps the part cool and reliable.' },

      // Tier 2: apply
      { type: 'predict_reading', difficulty: 2, question: 'A switch drops 0.2V while passing 2A. How much power does it dissipate as heat?', options: ['0.4 W', '4 W', '0.04 W', '40 W'], correct: 0, explanation: 'P = V × I = 0.2 × 2 = 0.4 W.' },
      { type: 'multiple_choice', difficulty: 2, question: 'Your transistor runs hot switching a motor. A reasonable fix is to...', options: ['Use a lower-drop device and add a heatsink', 'Remove the base resistor entirely', 'Lower the base current until it barely turns on', 'Swap the motor for a bigger one'], correct: 0, explanation: 'A lower on-state drop and better heat-sinking cut the temperature; barely turning it on (partial saturation) makes heating worse.' },
      { type: 'multiple_choice', difficulty: 2, question: 'Why does a MOSFET need almost no steady drive current?', options: ['It is controlled by gate voltage, not a steady current', 'It simply runs on a tiny bit of stored charge forever after', 'It has no real terminals that need to be driven at all', 'It quietly amplifies its own base current internally'], correct: 0, explanation: 'A MOSFET is voltage-controlled at its gate, so once charged it draws virtually no steady current.' },

      // Tier 3: reason
      { type: 'multiple_choice', difficulty: 3, question: 'A transistor barely saturates and drops 1V at 2A. What is the heat, and why is full saturation better?', options: ['2 W; full saturation drops less voltage, so far less heat', '0.5 W; a partial-on transistor somehow always runs much cooler', '20 W; whether it saturates has no effect on the heat at all', '0.02 W; the small voltage drop never really matters here'], correct: 0, explanation: 'P = 1 × 2 = 2 W is a lot for a small part. Driving it to full saturation cuts the on-state drop and the heat.' },
      { type: 'predict_behavior', difficulty: 3, question: 'You run a switching transistor right at its rated maximum current with no headroom. The likely outcome over time is...', options: ['It runs hot and is prone to early failure', 'It performs better than a rated part', 'Nothing, ratings are only suggestions', 'It draws less current than expected'], correct: 0, explanation: 'No margin means high temperature and stress; parts run near their limit fail early. Always leave headroom.' },
    ],
  },

  'Back-EMF from Coils': {
    xpReward: 30,
    steps: [
      { type: 'teach', title: 'Coils Fight a Change in Current', body: 'A coil, the winding inside a relay, solenoid, or motor, stores energy in a magnetic field while current flows. An inductor opposes a CHANGE in its current (the mirror image of a capacitor opposing a change in voltage). Switch the current off suddenly and the collapsing field fights back hard.' },
      { type: 'teach', title: 'The Voltage Spike', body: 'When you switch off a coil, its magnetic field collapses and tries to keep the current flowing. With nowhere to go, it generates a large reverse voltage spike, the back-EMF, that can be many times the supply voltage. That spike can punch through and destroy the transistor switching it.' },

      // Tier 1: recall
      { type: 'multiple_choice', difficulty: 1, question: 'A coil (inductor) opposes a change in its...', options: ['Current', 'Colour', 'Temperature', 'Resistance value'], correct: 0, explanation: 'An inductor opposes a change in current, just as a capacitor opposes a change in voltage.' },
      { type: 'multiple_choice', difficulty: 1, question: 'Switching off a coil suddenly produces a...', options: ['Large reverse voltage spike (back-EMF)', 'Gentle drop to zero with no spike', 'Steady rise in supply voltage', 'Permanent magnetic charge'], correct: 0, explanation: 'The collapsing field generates a back-EMF spike, often many times the supply voltage.' },
      { type: 'true_false', difficulty: 1, statement: 'The back-EMF spike from a coil can be much larger than the supply voltage.', correct: true, explanation: 'Yes, that is exactly why it is dangerous to the switching transistor.' },

      // Tier 2: apply
      { type: 'predict_behavior', difficulty: 2, question: 'A relay coil is switched off by a bare NPN transistor with no protection. What is the risk?', circuitDiagram: 'transistor_switch', options: ['The back-EMF spike can destroy the transistor', 'The relay simply switches faster', 'The supply voltage drops to zero forever', 'Nothing, coils are always safe'], correct: 0, explanation: 'The unprotected spike appears across the transistor and can break it down.' },
      { type: 'multiple_choice', difficulty: 2, question: 'Which loads produce a damaging back-EMF spike when switched off?', options: ['Coils: relays, solenoids, motors', 'Plain resistors and LEDs', 'Ceramic capacitors', 'Lengths of straight wire'], correct: 0, explanation: 'Inductive (coil) loads store magnetic energy and kick back; purely resistive loads do not.' },
      { type: 'multiple_choice', difficulty: 2, question: 'Why is an inductor often called the "mirror image" of a capacitor?', options: ['It opposes a current change; a capacitor opposes a voltage change', 'It stores electric charge on plates in precisely the same way a capacitor does', 'It has no real effect on any circuit it sits in', 'It only ever works when supplied with steady DC'], correct: 0, explanation: 'Inductor: resists current change, stores a magnetic field. Capacitor: resists voltage change, stores charge.' },

      // Tier 3: reason
      { type: 'multiple_choice', difficulty: 3, question: 'Why does the spike appear specifically at switch-OFF, not at switch-on?', options: ['The collapsing field forces the current to keep flowing into a sudden open', 'The coil only ever stores any of its energy while it is switched off', 'Switch-on is actually the moment with the far larger, faster current change', 'The whole supply suddenly reverses its own polarity at switch-off'], correct: 0, explanation: 'At turn-off the current is forced to change fast with nowhere to go, so the inductor produces a huge voltage trying to maintain it.' },
      { type: 'predict_behavior', difficulty: 3, question: 'You switch a small motor with a transistor and it works for a while, then the transistor fails. The most likely cause is...', options: ['Repeated back-EMF spikes with no flyback diode', 'The base resistor being slightly too large', 'The motor being painted the wrong colour', 'Too little current through the LED'], correct: 0, explanation: 'A motor is inductive; without a flyback diode the repeated turn-off spikes gradually destroy the transistor.' },
    ],
  },

  'The Flyback Diode': {
    xpReward: 35,
    steps: [
      { type: 'teach', title: 'Give the Spike a Path', body: 'The fix for back-EMF is a flyback (freewheeling) diode placed directly across the coil. In normal operation it is reverse-biased and does nothing. At switch-off, the coil\'s reversed voltage forward-biases the diode, giving the collapsing current a safe loop to circulate in until it dies away, instead of spiking across the transistor.' },
      { type: 'teach', title: 'Orientation Is Everything', body: 'The diode must be wired so it BLOCKS the normal supply current and only conducts the reverse spike. Across a coil fed from +V, the diode\'s cathode (the banded end) goes to +V and the anode to the transistor side. Wire it backwards and it shorts the supply the moment you power on.' },

      // Tier 1: recall
      { type: 'multiple_choice', difficulty: 1, question: 'A flyback (freewheeling) diode is placed...', options: ['Directly across the coil', 'In series with the base resistor', 'Across the power supply only', 'Between two ground pins'], correct: 0, explanation: 'It goes across the inductive load to catch the back-EMF.' },
      { type: 'identify_component', difficulty: 1, question: 'Click the flyback diode protecting the transistor from the coil\'s spike.', circuitDiagram: 'transistor_switch', correctComponent: 'diode', explanation: 'That diode sits across the relay coil to absorb the back-EMF at switch-off.' },
      { type: 'true_false', difficulty: 1, statement: 'In normal operation the flyback diode is reverse-biased and carries no current.', correct: true, explanation: 'Yes. It only conducts the reverse spike at switch-off; otherwise it blocks.' },

      // Tier 2: apply
      { type: 'predict_behavior', difficulty: 2, question: 'With a correctly fitted flyback diode, what happens to the coil current at switch-off?', circuitDiagram: 'transistor_switch', options: ['It circulates through the diode and decays safely', 'It spikes across the transistor as before', 'It reverses the motor permanently', 'It charges the base resistor'], correct: 0, explanation: 'The diode gives the current a loop to circulate in, so it decays gently instead of spiking.' },
      { type: 'spot_error', difficulty: 2, question: 'In this relay driver, which component, if wired backwards, would short the supply at power-on?', circuitDiagram: 'transistor_switch', correctRegion: 'diode', explanation: 'A reversed flyback diode conducts the normal supply current, shorting the rail. Orientation is critical.' },
      { type: 'multiple_choice', difficulty: 2, question: 'Across a coil fed from +V, the flyback diode\'s banded end (cathode) connects to...', options: ['The +V side', 'The ground side', 'The base resistor', 'The Arduino pin'], correct: 0, explanation: 'Cathode to +V means the diode blocks the normal current and only conducts the reverse spike.' },

      // Tier 3: reason
      { type: 'multiple_choice', difficulty: 3, question: 'Why does the flyback diode point the "wrong way" for normal current (cathode to +V)?', options: ['So it blocks the supply but conducts the reverse spike at switch-off', 'So that it carries the entire load current continuously, the whole time', 'So that it lights up brightly like an indicator LED would', 'So that it pushes the coil voltage up much higher'], correct: 0, explanation: 'Normal current is blocked; the back-EMF reverses the voltage across the coil, which forward-biases the diode and is safely shunted.' },
      { type: 'multiple_choice', difficulty: 3, question: 'In an AC circuit you cannot use a simple flyback diode across the load. What is used instead?', options: ['An RC snubber (a resistor and capacitor)', 'A second identical diode in series', 'A larger base resistor', 'Nothing is ever needed'], correct: 0, explanation: 'Because AC reverses each cycle, a diode would conduct half the time; an RC snubber tames the switching transient instead.' },
    ],
  },

  'Drive the Relay': {
    xpReward: 45,
    steps: [
      { type: 'teach', title: 'The Whole Job at Once', body: 'Time to put it together. An Arduino pin sources only ~20 mA at 5V, but you must switch a 12V relay coil that draws 120 mA. The plan: an NPN low-side switch, a base resistor sized to saturate it, and a flyback diode across the coil. This is the real-world pattern for switching any beefy load from a microcontroller.', circuitDiagram: 'transistor_switch' },
      { type: 'teach', title: 'The Numbers', body: 'Coil: 120 mA at 12V. Transistor β(min) = 100, so Ib(min) = 120/100 = 1.2 mA. Overdrive ~3.5× for solid saturation → about 4.3 mA. Base resistor: Rb = (5 − 0.7)/0.0043 ≈ 1 kΩ. Add a flyback diode across the coil, cathode to +12V. Done.', circuitDiagram: 'transistor_switch' },

      // Tier 1: recall the structure
      { type: 'identify_component', difficulty: 1, question: 'Click the transistor doing the switching.', circuitDiagram: 'transistor_switch', correctComponent: 'transistor', explanation: 'The NPN switches the coil current to ground when its base is driven.' },
      { type: 'identify_component', difficulty: 1, question: 'Click the base resistor that sets the base current.', circuitDiagram: 'transistor_switch', correctComponent: 'base_resistor', explanation: 'Rb between the pin and the base sets the base current that saturates the transistor.' },
      { type: 'multiple_choice', difficulty: 1, question: 'Why can the Arduino pin not drive the relay coil directly?', options: ['The coil needs 120 mA at 12V, well beyond a pin', 'The pin outputs too much current for the coil', 'Relays only run from transistors, never supplies', 'The pin voltage is far too high for the coil'], correct: 0, explanation: 'A pin tops out near 20 mA at 5V; the coil needs 120 mA at 12V, so a transistor switches it from the 12V rail.' },

      // Tier 2: the calculations
      { type: 'predict_reading', difficulty: 2, question: 'Coil current 120 mA, β(min) = 100. The minimum base current is...', options: ['1.2 mA', '12 mA', '0.12 mA', '120 mA'], correct: 0, explanation: 'Ib(min) = Ic / β = 120 / 100 = 1.2 mA. Drive a few times more to fully saturate.' },
      { type: 'choose_resistor', difficulty: 2, question: 'For about 4.3 mA of base current from a 5V pin (0.7V base drop), pick Rb.', circuitDiagram: 'transistor_switch', options: ['1 kΩ', '100 Ω', '10 kΩ', '100 kΩ'], correct: 0, explanation: 'Rb = (5 − 0.7) / 0.0043 ≈ 1000 Ω = 1 kΩ.' },
      { type: 'multiple_choice', difficulty: 2, question: 'Which way does the flyback diode go across the coil?', options: ['Cathode (band) to +12V, anode to the collector', 'Anode to +12V, cathode to the collector', 'Either way, it does not matter', 'In series with the coil, not across it'], correct: 0, explanation: 'Cathode to +12V blocks the normal current and conducts only the back-EMF.' },

      // Tier 3: the gotchas and verification
      { type: 'spot_error', difficulty: 3, question: 'A new build clicks once, then the transistor dies. With the resistor and saturation correct, click the part most likely missing or reversed.', circuitDiagram: 'transistor_switch', correctRegion: 'diode', explanation: 'No flyback diode (or a reversed one) lets the coil\'s back-EMF destroy the transistor at switch-off.' },
      { type: 'multiple_choice', difficulty: 3, question: 'You drove the base with only the 1.2 mA minimum. The relay buzzes and the transistor warms up. Why?', options: ['Too little overdrive: not fully saturated, so it drops voltage and heats', 'The flyback diode is somehow conducting the full coil current the entire time', 'The base resistor value chosen is far, far too small for this', 'The 12V supply is simply too low to drive the relay coil'], correct: 0, explanation: 'At the bare minimum Ib, a low-β sample sits in the active region, dropping voltage (heat) and switching unreliably. Overdrive the base.' },
      { type: 'multiple_choice', difficulty: 3, question: 'How do you confirm the finished build is correct, beyond "the relay clicks"?', options: ['Confirm the coil switches AND the pin current stayed within its limit', 'Simply listen for the click once and then immediately call the build done', 'Just measure the indicator LED brightness on its own', 'Only check that the resistor colour bands look neat'], correct: 0, explanation: 'A correct design switches the load AND keeps the pin within its current limit, with the diode protecting the transistor. Verify both, ideally on camera with the live tutor.' },
    ],
  },

  'MOSFETs vs BJTs': {
    xpReward: 30,
    steps: [
      { type: 'teach', title: 'Two Ways to Switch', body: 'A BJT (the bipolar transistor you have been using) is controlled by base CURRENT. A MOSFET is controlled by gate VOLTAGE and draws almost no steady gate current. For switching power, MOSFETs are now the default: a "logic-level" MOSFET turns fully on from a 5V (or even 3.3V) gate and has a very low on-resistance, so it runs cool.' },
      { type: 'teach', title: 'Picking Between Them', body: 'BJTs are cheap, simple, and fine for small loads and signal work. MOSFETs win for switching larger currents efficiently. The MOSFET\'s terminals are gate, drain, and source (the rough counterparts of base, collector, emitter). The flyback-diode rule for inductive loads is exactly the same for both.' },

      // Tier 1: recall
      { type: 'multiple_choice', difficulty: 1, question: 'A MOSFET is controlled by its gate...', options: ['Voltage', 'Current', 'Temperature', 'Colour'], correct: 0, explanation: 'MOSFETs are voltage-controlled at the gate; BJTs are current-controlled at the base.' },
      { type: 'multiple_choice', difficulty: 1, question: 'A BJT is controlled by its base...', options: ['Current', 'Voltage only', 'Resistance', 'Frequency'], correct: 0, explanation: 'A BJT needs a base current to turn on.' },
      { type: 'true_false', difficulty: 1, statement: 'A MOSFET draws almost no steady current at its gate.', correct: true, explanation: 'Yes. Once the gate is charged, it draws virtually no steady current.' },

      // Tier 2: apply
      { type: 'multiple_choice', difficulty: 2, question: 'You must switch 5A efficiently from a 5V logic pin. Best general choice?', options: ['A logic-level MOSFET', 'A tiny small-signal BJT', 'A plain resistor', 'A coupling capacitor'], correct: 0, explanation: 'A logic-level MOSFET turns fully on from 5V and switches amps with low loss.' },
      { type: 'multiple_choice', difficulty: 2, question: 'The MOSFET terminals (gate, drain, source) roughly correspond to which BJT terminals?', options: ['Base, collector, emitter', 'Emitter, base, collector', 'Anode, cathode, gate', 'Plus, minus, ground'], correct: 0, explanation: 'Gate≈base (control), drain≈collector, source≈emitter.' },
      { type: 'multiple_choice', difficulty: 2, question: 'Switching an inductive load with a MOSFET, what protection do you still need?', options: ['A flyback diode across the load', 'Nothing, MOSFETs are immune', 'A second gate resistor only', 'A larger source capacitor'], correct: 0, explanation: 'Back-EMF does not care which switch you use; the flyback diode rule is the same.' },

      // Tier 3: reason
      { type: 'multiple_choice', difficulty: 3, question: 'Why does a low on-resistance matter most when switching large currents?', options: ['Heat is I²×R, so at high current even a small resistance gets hot', 'On-resistance only ever matters when the current happens to be very low', 'It quietly changes the load\'s maximum voltage rating', 'It sets how much steady gate current is needed'], correct: 0, explanation: 'Power lost in the switch rises with the square of the current, so a low on-resistance keeps a high-current switch cool.' },
      { type: 'multiple_choice', difficulty: 3, question: 'Why insist on a "logic-level" MOSFET for a 5V Arduino pin?', options: ['A standard MOSFET may not fully turn on from only 5V at the gate', 'Logic-level MOSFETs are the only kind that exist', 'It makes the gate draw a large current', 'It removes the need for any load supply'], correct: 0, explanation: 'Many MOSFETs need a higher gate voltage to saturate; a logic-level part is specified to turn fully on at ~5V (or less).' },
    ],
  },

  'NPN vs PNP': {
    xpReward: 25,
    steps: [
      { type: 'teach', title: 'Two Polarities of BJT', body: 'BJTs come in two flavours. An NPN turns on when the base is pulled HIGH (above the emitter) and is the natural low-side switch. A PNP turns on when the base is pulled LOW (below the emitter) and is the natural high-side switch. They are mirror images: the supply and current directions are reversed.' },

      // Tier 1: recall
      { type: 'multiple_choice', difficulty: 1, question: 'An NPN transistor turns on when its base is...', options: ['Pulled HIGH, above the emitter', 'Pulled LOW, below the emitter', 'Left completely floating', 'Disconnected from the circuit'], correct: 0, explanation: 'NPN: base high (above the emitter) turns it on.' },
      { type: 'multiple_choice', difficulty: 1, question: 'A PNP transistor turns on when its base is...', options: ['Pulled LOW, below the emitter', 'Pulled HIGH, above the emitter', 'Held at exactly the supply', 'Heated up'], correct: 0, explanation: 'PNP: base low (below the emitter) turns it on.' },
      { type: 'true_false', difficulty: 1, statement: 'NPN and PNP transistors use opposite supply polarities and current directions.', correct: true, explanation: 'Yes. A PNP is the mirror image of an NPN.' },

      // Tier 2: apply
      { type: 'multiple_choice', difficulty: 2, question: 'For a natural high-side switch (between supply and load), which BJT fits?', options: ['PNP', 'NPN', 'Either, polarity is irrelevant', 'Neither can switch high-side'], correct: 0, explanation: 'A PNP is the natural high-side switch; an NPN is the natural low-side switch.' },
      { type: 'predict_behavior', difficulty: 2, question: 'You drop an NPN into a circuit designed for a PNP without changing anything. What happens?', options: ['It will not switch correctly; the polarity is wrong', 'It works completely identically, with no difference at all', 'It runs at roughly double its normal speed', 'It quietly turns itself into a MOSFET'], correct: 0, explanation: 'NPN and PNP need opposite drive and supply arrangements; swapping one for the other without rewiring fails.' },
      { type: 'multiple_choice', difficulty: 2, question: 'Why are NPN low-side switches the beginner default?', options: ['The base drive shares the logic\'s ground reference', 'PNP transistors are genuinely very rare and hard to source', 'NPN parts need no base resistor at all', 'NPN loads always run at a higher voltage'], correct: 0, explanation: 'A ground-referenced base is easy to drive straight from a pin, so NPN low-side is the simplest start.' },

      // Tier 3: reason
      { type: 'multiple_choice', difficulty: 3, question: 'A load must connect permanently to ground and be switched from the +V side. Which device and why?', options: ['A PNP (or P-MOSFET), because it switches the high side cleanly', 'An NPN low-side, because ground is already connected', 'A resistor, because no switching is needed', 'A capacitor, to block the DC'], correct: 0, explanation: 'A ground-referenced load that must be switched on its supply side needs a high-side switch: a PNP or P-channel MOSFET.' },
      { type: 'match', difficulty: 3, instruction: 'Match each device to how you turn it on / where it sits.', pairs: [['NPN', 'Base HIGH; low-side switch'], ['PNP', 'Base LOW; high-side switch'], ['N-MOSFET', 'Gate HIGH; low-side switch'], ['P-MOSFET', 'Gate LOW; high-side switch']] },
    ],
  },

  'Unit 7 Checkpoint': {
    xpReward: 50,
    steps: [
      { type: 'multiple_choice', question: 'In an NPN transistor, a small base current controls...', options: ['A much larger collector current', 'The supply voltage value', 'The colour of the LED', 'The room temperature'], correct: 0, explanation: 'Base current controls the larger collector current.' },
      { type: 'multiple_choice', question: 'Current gain β is defined as...', options: ['Ic divided by Ib', 'Ib divided by Ic', 'Vcc divided by Ic', 'Ic times Ib'], correct: 0, explanation: 'β = Ic / Ib.' },
      { type: 'fill_blank', prompt: 'Collector current 200 mA, base current 2 mA. β = ___.', blank: '___', answer: '100', hint: 'Divide the collector current by the base current.' },
      { type: 'choose_resistor', question: '5V pin, 0.7V base drop, target ~4.3 mA base current. Pick Rb.', circuitDiagram: 'transistor_switch', options: ['1 kΩ', '100 Ω', '10 kΩ', '100 kΩ'], correct: 0, explanation: 'Rb = (5 − 0.7) / 0.0043 ≈ 1 kΩ.' },
      { type: 'identify_component', question: 'Click the flyback diode protecting the transistor.', circuitDiagram: 'transistor_switch', correctComponent: 'diode', explanation: 'The diode across the coil absorbs the back-EMF.' },
      { type: 'spot_error', question: 'A relay driver kills its transistor at switch-off. Click the part most likely missing or reversed.', circuitDiagram: 'transistor_switch', correctRegion: 'diode', explanation: 'No flyback diode means the coil\'s back-EMF destroys the transistor.' },
      { type: 'multiple_choice', question: 'A MOSFET is controlled by gate ___, a BJT by base ___.', options: ['voltage; current', 'current; voltage', 'resistance; voltage', 'voltage; voltage'], correct: 0, explanation: 'MOSFET = gate voltage; BJT = base current.' },
      { type: 'match', instruction: 'Match each part to its role in a relay driver.', pairs: [['NPN transistor', 'Switches the coil to ground'], ['Base resistor', 'Sets the base current'], ['Flyback diode', 'Absorbs the back-EMF'], ['Relay coil', 'The inductive load']] },
    ],
  },
};
