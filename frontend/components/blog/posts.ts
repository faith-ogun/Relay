// ── Blog content (SEO) ──
// Full posts authored for search: answer-first intros, H2/H3 hierarchy,
// lists/tables for snippet eligibility, FAQ blocks, internal links, and media
// placeholders the team fills in. Rendered by BlogPostPage; indexed by BlogPage.

export type Block =
  | { type: 'p'; text: string }
  | { type: 'h2'; text: string }
  | { type: 'h3'; text: string }
  | { type: 'list'; ordered?: boolean; items: string[] }
  | { type: 'table'; head: string[]; rows: string[][] }
  | { type: 'callout'; title?: string; text: string }
  | { type: 'media'; kind: 'image' | 'video'; note: string }
  | { type: 'quote'; text: string };

export type FAQ = { q: string; a: string };

export interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  metaDescription: string;
  keywords: string[];
  category: string;
  date: string;
  read: string;
  author: string;
  swatch: string;
  featured?: boolean;
  takeaways: string[];
  body: Block[];
  faqs: FAQ[];
  related: string[];
}

export const POSTS: BlogPost[] = [
  {
    slug: 'tutorial-hell-to-first-circuit',
    title: 'From Tutorial Hell to Your First Working Circuit',
    excerpt:
      'Watching videos feels like progress, but it isn’t. Here’s the shift that gets beginners from passively following along to actually building, and why a tutor that sees your bench changes everything.',
    metaDescription:
      'Stuck in electronics tutorial hell? Learn the mindset shift that gets beginners from watching videos to building real circuits, plus a step-by-step way out.',
    keywords: ['electronics tutorial hell', 'learn electronics by building', 'first arduino circuit', 'how to learn electronics'],
    category: 'Learning',
    date: 'Jun 12, 2026',
    read: '7 min read',
    author: 'The Ohmlet Team',
    swatch: 'from-ohmlet-gold to-ohmlet-gold-deep',
    featured: true,
    takeaways: [
      'Watching tutorials builds recognition, not skill. Building builds skill.',
      'Start with one complete circuit, not ten half-finished concepts.',
      'Get feedback while your hands are on the board, not after it fails.',
      'Lower the stakes: a wrong wire is data, not failure.',
    ],
    body: [
      { type: 'p', text: 'You have watched the videos. Maybe a dozen of them. You can nod along when someone explains a pull-down resistor, and you have a breadboard somewhere with three jumper wires in it from that one time you got excited. So why can’t you build anything on your own?' },
      { type: 'p', text: 'This is tutorial hell, and almost every self-taught maker passes through it. The good news: getting out is less about learning more and more about learning differently.' },
      { type: 'h2', text: 'Why watching feels like learning (but isn’t)' },
      { type: 'p', text: 'Watching someone build a circuit creates the feeling of understanding because you can follow each step as it happens. But following is not the same as retrieving. The moment the video ends and you face a blank breadboard, there is no next step to copy, and the recognition you built evaporates.' },
      { type: 'p', text: 'Real skill comes from retrieval under mild difficulty: trying to place the resistor yourself, getting it slightly wrong, and correcting. That struggle is the learning. Tutorials skip it, which is exactly why they feel good and teach little.' },
      { type: 'callout', title: 'The rule', text: 'If you are not occasionally stuck, you are not learning. You are watching.' },
      { type: 'h2', text: 'The shift: build one complete thing' },
      { type: 'p', text: 'Instead of collecting concepts, finish one real circuit end to end. A light-activated alarm is perfect: it uses an LDR, a resistor, an LED or buzzer, and a few lines of Arduino code, and it visibly responds to the world. Completing it once teaches you more than ten half-watched playlists.' },
      { type: 'list', ordered: true, items: [
        'Pick one small build with a visible result.',
        'Gather only the parts that build needs.',
        'Wire it one connection at a time, checking each before the next.',
        'Run it, watch it fail, fix the one thing that is wrong, repeat.',
        'Finish it. Then change one thing on purpose to see what happens.',
      ] },
      { type: 'media', kind: 'image', note: 'Before/after: a messy breadboard attempt next to a clean finished light-activated alarm.' },
      { type: 'h2', text: 'Get feedback while your hands are on the board' },
      { type: 'p', text: 'The slowest way to learn is to wire the whole thing, power it, and discover nothing works with no idea why. The fastest way is to be corrected at the moment you make the mistake, the same way a good lab partner leans over and says "that resistor is on the wrong rail" before you move on.' },
      { type: 'p', text: 'This is the entire reason Ohmlet watches your bench through your camera: it catches the wrong pin or the reversed LED while you can still see what you just did, not twenty minutes later.' },
      { type: 'h2', text: 'Lower the stakes' },
      { type: 'p', text: 'Beginners freeze because they treat a wrong connection as failure. Reframe it: a circuit that does not work is telling you something specific. Burned-out LED? Too much current, you need a resistor. Reading stuck at maximum? A pin is likely shorted to 5V. Every failure narrows the problem.' },
      { type: 'p', text: 'Once you internalise that, building stops being scary and starts being a conversation with the circuit.' },
    ],
    faqs: [
      { q: 'How long until I can build circuits on my own?', a: 'Most beginners can complete a first guided build in an hour or two. Independent building usually clicks after finishing three or four complete projects, because the same fundamentals keep recurring.' },
      { q: 'Do I need to be good at maths?', a: 'No. You need Ohm’s law (a single multiplication) and the patience to measure. The rest is pattern recognition you build by doing.' },
      { q: 'What is the best first electronics project?', a: 'Anything that visibly reacts to the world with few parts. A light-activated alarm or a blinking LED with a button are ideal first builds.' },
    ],
    related: ['how-to-read-a-breadboard', 'ohms-law-explained-with-an-led'],
  },
  {
    slug: 'how-to-read-a-breadboard',
    title: 'How to Read a Breadboard Without Frying Anything',
    excerpt: 'Power rails, the center gap, and the connections nobody explains: a beginner’s map to the board everything sits on.',
    metaDescription:
      'Confused by breadboards? Learn exactly how breadboard rows, columns, power rails, and the center gap connect, with the wiring mistakes that fry components.',
    keywords: ['how to read a breadboard', 'breadboard connections explained', 'breadboard power rails', 'breadboard for beginners'],
    category: 'Basics',
    date: 'Jun 9, 2026',
    read: '5 min read',
    author: 'The Ohmlet Team',
    swatch: 'from-ohmlet-blue to-ohmlet-blue-deep',
    takeaways: [
      'Each half-row of five holes (a to e, f to j) is connected internally.',
      'The long side rails carry power (+) and ground (-).',
      'The center gap splits the board into two electrically separate halves.',
      'Putting both legs of a component in the same row short-circuits it.',
    ],
    body: [
      { type: 'p', text: 'A breadboard is just a grid of holes with hidden metal strips underneath that connect some of them together. Once you can picture those strips, wiring stops being guesswork. Here is the whole map in five minutes.' },
      { type: 'h2', text: 'The four zones of a breadboard' },
      { type: 'list', items: [
        'Two power rails on each long edge, marked + (red) and - (blue or black).',
        'The main grid, split into a top half and a bottom half.',
        'Rows of five holes (labelled a to e and f to j) that connect horizontally.',
        'A center gap that separates the two halves and is sized for chip legs.',
      ] },
      { type: 'media', kind: 'image', note: 'Annotated breadboard photo showing rails, rows, columns, and the hidden internal strips.' },
      { type: 'h2', text: 'How the holes actually connect' },
      { type: 'p', text: 'Inside the main grid, the five holes in a single half-row are joined by one metal clip. So a1, b1, c1, d1, and e1 are all the same electrical point. But e1 and f1 are NOT connected, because the center gap breaks the strip in two.' },
      { type: 'p', text: 'The power rails run the other way: along the length of the board, so the entire + rail is one connected line, and the entire - rail is another. You connect these to your 5V and GND once, then tap power anywhere along them.' },
      { type: 'callout', title: 'Quick test', text: 'Are holes e5 and f5 connected? No. The center gap separates them. That single fact prevents most beginner shorts.' },
      { type: 'h2', text: 'The mistake that fries components' },
      { type: 'p', text: 'The number-one breadboard error is placing both legs of a component in the same row. Because that row is one electrical point, you have just connected the component’s two legs directly together, bypassing it entirely and often creating a short. Always span components across the center gap or across different rows.' },
      { type: 'h3', text: 'A clean wiring habit' },
      { type: 'list', ordered: true, items: [
        'Connect your power source to the + and - rails first.',
        'Place components so their legs land in different rows.',
        'Use the rails for power and ground, the grid for signal.',
        'Keep jumper wires short and flat so you can read the board.',
      ] },
      { type: 'p', text: 'Master this and the breadboard becomes invisible: you stop thinking about holes and start thinking about your circuit.' },
    ],
    faqs: [
      { q: 'Are the holes in a breadboard column connected?', a: 'In the main grid, the five holes in each half-row (a to e, or f to j) are connected. The long side power rails connect along the board’s length.' },
      { q: 'Why is there a gap in the middle of a breadboard?', a: 'The center gap electrically separates the two halves and is spaced so an IC chip can straddle it with its legs in separate rows.' },
      { q: 'Can a breadboard damage my components?', a: 'Not by itself, but wiring mistakes on it can. The most common is shorting a component by placing both legs in the same connected row.' },
    ],
    related: ['ohms-law-explained-with-an-led', 'resistor-color-codes-cheat-sheet'],
  },
  {
    slug: 'ohms-law-explained-with-an-led',
    title: 'Ohm’s Law, Explained With an LED You Can Actually See',
    excerpt: 'V = IR stops being abstract the moment it decides whether your LED glows or pops. Let’s make it physical.',
    metaDescription:
      'Ohm’s law made simple. Learn V = IR using a real LED, calculate the right resistor, and understand why the wrong one burns your LED out instantly.',
    keywords: ['ohms law explained', 'led resistor calculation', 'V = IR', 'current limiting resistor led'],
    category: 'Foundations',
    date: 'Jun 5, 2026',
    read: '6 min read',
    author: 'The Ohmlet Team',
    swatch: 'from-ohmlet-green to-ohmlet-green-deep',
    takeaways: [
      'Ohm’s law is V = I × R: voltage equals current times resistance.',
      'An LED with no resistor draws too much current and burns out.',
      'Resistor value = (supply voltage - LED voltage) / desired current.',
      'For a 5V supply and a typical LED, 220Ω is a safe starting point.',
    ],
    body: [
      { type: 'p', text: 'Ohm’s law is the one equation you cannot skip in electronics, and it is genuinely simple: V = I × R. Voltage equals current times resistance. The reason it matters is that it decides, right now, whether your LED lights up or dies. Let’s make it concrete.' },
      { type: 'h2', text: 'The three quantities, in plain words' },
      { type: 'list', items: [
        'Voltage (V): the electrical pressure pushing electrons, measured in volts.',
        'Current (I): how many electrons actually flow, measured in amps (often milliamps).',
        'Resistance (R): how much the circuit pushes back, measured in ohms.',
      ] },
      { type: 'p', text: 'Rearrange the equation any way you need: I = V / R, or R = V / I. Know any two and you can find the third.' },
      { type: 'h2', text: 'Why an LED needs a resistor' },
      { type: 'p', text: 'An LED is not a light bulb. It barely resists current on its own, so if you connect it straight across 5V, current shoots up far past what the LED can handle and it burns out, sometimes instantly. A resistor in series limits that current to a safe level.' },
      { type: 'callout', title: 'Watch it happen', text: 'Connect an LED with no resistor and it flares then dies. Add the right resistor and it glows steadily. Same parts, one number different.' },
      { type: 'h2', text: 'Calculate the right resistor' },
      { type: 'p', text: 'Use this formula for an LED in series with a resistor:' },
      { type: 'quote', text: 'R = (V_supply - V_led) / I_led' },
      { type: 'p', text: 'For a 5V Arduino pin, a red LED that drops about 2V, and a target current of about 13mA (0.013A):' },
      { type: 'quote', text: 'R = (5 - 2) / 0.013 = about 230Ω' },
      { type: 'p', text: 'The nearest common resistor is 220Ω, which is why 220Ω is the classic LED resistor. Slightly higher (like 330Ω) just makes the LED a little dimmer and is perfectly safe.' },
      { type: 'media', kind: 'image', note: 'Side-by-side: LED with no resistor (burned) vs LED with 220Ω (glowing), with the calculation overlaid.' },
      { type: 'h2', text: 'A quick reference' },
      { type: 'table', head: ['Supply', 'LED drop', 'Target current', 'Resistor'], rows: [
        ['5V', '2.0V (red)', '13mA', '220Ω'],
        ['5V', '3.2V (blue)', '15mA', '120Ω'],
        ['3.3V', '2.0V (red)', '10mA', '130Ω'],
      ] },
      { type: 'p', text: 'Once Ohm’s law clicks for an LED, the same reasoning scales to every circuit you will ever build.' },
    ],
    faqs: [
      { q: 'What resistor do I need for an LED on 5V?', a: 'For a typical red LED, 220Ω is the standard safe choice. Use the formula R = (supply - LED voltage) / current to be exact.' },
      { q: 'What happens if I use a bigger resistor?', a: 'A larger resistor lets less current through, so the LED is dimmer but completely safe. A too-small resistor risks burning the LED out.' },
      { q: 'Do all LEDs need a resistor?', a: 'Almost always, unless the LED has a built-in resistor or the driver already limits current. When in doubt, add a current-limiting resistor.' },
    ],
    related: ['resistor-color-codes-cheat-sheet', 'how-to-read-a-breadboard'],
  },
  {
    slug: 'arduino-sensor-reads-garbage',
    title: 'Why Your Arduino Sensor Reads Garbage, and How to Fix It',
    excerpt: 'Floating pins, missing pull-downs, and noisy analog reads: the usual suspects behind numbers that make no sense.',
    metaDescription:
      'Arduino sensor giving random or stuck values? Here are the most common causes (floating pins, wiring, power, noise) and exactly how to debug each one.',
    keywords: ['arduino sensor random values', 'floating pin arduino', 'analogRead noise', 'arduino sensor not working'],
    category: 'Debugging',
    date: 'May 30, 2026',
    read: '8 min read',
    author: 'The Ohmlet Team',
    swatch: 'from-ohmlet-red to-[#c2493b]',
    takeaways: [
      'A reading stuck at 1023 usually means the pin is shorted to 5V.',
      'A reading stuck at 0 usually means a broken connection or short to ground.',
      'Wildly jumping values often mean a floating pin or loose wire.',
      'Add the serial monitor early: numbers tell you what eyes cannot.',
    ],
    body: [
      { type: 'p', text: 'Your sensor is wired up, your code looks right, and the serial monitor is spitting out numbers that make no sense: stuck at a maximum, frozen at zero, or bouncing around randomly. Before you blame the sensor, work through these causes in order. One of them is almost always the culprit.' },
      { type: 'h2', text: 'Read the symptom first' },
      { type: 'table', head: ['What you see', 'Most likely cause'], rows: [
        ['Stuck at 1023', 'Analog pin shorted directly to 5V, or no voltage divider'],
        ['Stuck at 0', 'Broken connection, or pin shorted to ground'],
        ['Jumping randomly', 'Floating pin or a loose wire'],
        ['Reasonable but offset', 'Wrong reference voltage or sensor calibration'],
      ] },
      { type: 'p', text: 'A 10-bit Arduino ADC returns 0 to 1023. The extremes (0 and 1023) almost always mean a wiring problem, not a sensor problem.' },
      { type: 'h2', text: 'The floating pin problem' },
      { type: 'p', text: 'An input pin connected to nothing is "floating": it picks up electrical noise from the air and returns random values. Buttons are the classic case. The fix is a pull-down (or pull-up) resistor that ties the pin to a known voltage when nothing else is driving it.' },
      { type: 'callout', title: 'Shortcut', text: 'For buttons, INPUT_PULLUP in pinMode uses the Arduino’s internal pull-up resistor so you do not need an external one.' },
      { type: 'h2', text: 'Check power and ground' },
      { type: 'list', ordered: true, items: [
        'Confirm the sensor’s VCC actually reaches 5V (or 3.3V) with a multimeter.',
        'Confirm a solid common ground between the sensor and the Arduino.',
        'Reseat every jumper wire: breadboard contacts loosen constantly.',
        'Verify you are reading the pin you think you are reading.',
      ] },
      { type: 'media', kind: 'video', note: 'Screen recording of the serial monitor as a floating pin is fixed with a pull-down resistor: noise to clean readings.' },
      { type: 'h2', text: 'Trust the serial monitor' },
      { type: 'p', text: 'The single most useful debugging habit is printing your raw sensor value to the serial monitor early and often. Eyes cannot see a 4.8V vs 5.0V difference, but the numbers can. Add Serial.println(analogRead(PIN)) and watch how the value responds as you change the input by hand.' },
      { type: 'p', text: 'When you can see the number react correctly to light, heat, or a press, the hard part is done. Everything after that is just thresholds in code.' },
    ],
    faqs: [
      { q: 'Why does my Arduino analog read stay at 1023?', a: 'A value pinned at the maximum almost always means the analog pin is connected directly to 5V, usually a missing voltage divider or a short. Check your wiring before the sensor.' },
      { q: 'What is a floating pin?', a: 'An input pin not connected to a defined voltage. It picks up ambient noise and returns random values. Fix it with a pull-down or pull-up resistor.' },
      { q: 'How do I debug a sensor that gives random values?', a: 'Print the raw value to the serial monitor, check for a floating pin, verify power and ground, and reseat loose breadboard wires.' },
    ],
    related: ['multimeter-skills-for-beginners', 'how-to-read-a-breadboard'],
  },
  {
    slug: 'resistor-color-codes-cheat-sheet',
    title: 'Resistor Color Codes: A 5-Minute Cheat Sheet',
    excerpt: 'Stop squinting at tiny bands. A simple way to read any resistor and never mix up your 220Ω and 22kΩ again.',
    metaDescription:
      'Read any resistor in seconds. A clear resistor color code chart plus a simple method for 4-band and 5-band resistors, with worked examples.',
    keywords: ['resistor color code', 'resistor color code chart', 'how to read resistor bands', '4 band resistor'],
    category: 'Reference',
    date: 'May 24, 2026',
    read: '4 min read',
    author: 'The Ohmlet Team',
    swatch: 'from-ohmlet-gold to-ohmlet-gold-deep',
    takeaways: [
      'The first bands are digits, the next is a multiplier, the last is tolerance.',
      'Black=0, Brown=1, Red=2, Orange=3, Yellow=4, Green=5, Blue=6, Violet=7, Grey=8, White=9.',
      'A gold or silver band marks the tolerance end. Read from the other side.',
      'When in doubt, just measure it with a multimeter.',
    ],
    body: [
      { type: 'p', text: 'Resistors are labelled with colored bands instead of numbers because they are too small to print on. Once you know the system, you can read any resistor in a few seconds. Here is the whole thing on one page.' },
      { type: 'h2', text: 'The color-to-number key' },
      { type: 'table', head: ['Color', 'Digit', 'Multiplier'], rows: [
        ['Black', '0', '×1'],
        ['Brown', '1', '×10'],
        ['Red', '2', '×100'],
        ['Orange', '3', '×1k'],
        ['Yellow', '4', '×10k'],
        ['Green', '5', '×100k'],
        ['Blue', '6', '×1M'],
        ['Violet', '7', '×10M'],
        ['Grey', '8', '-'],
        ['White', '9', '-'],
      ] },
      { type: 'h2', text: 'How to read a 4-band resistor' },
      { type: 'list', ordered: true, items: [
        'Orient the resistor so the gold or silver tolerance band is on the right.',
        'Read the first two bands as digits.',
        'Read the third band as the multiplier (number of zeros).',
        'The fourth band is tolerance (gold = 5%, silver = 10%).',
      ] },
      { type: 'callout', title: 'Worked example', text: 'Red, Red, Brown, Gold = 2, 2, ×10 = 220Ω at 5% tolerance. Red, Red, Orange = 2, 2, ×1k = 22kΩ.' },
      { type: 'media', kind: 'image', note: 'Clean resistor color code wheel or chart graphic for readers to save.' },
      { type: 'h2', text: '5-band resistors' },
      { type: 'p', text: 'Precision resistors use five bands: three digit bands, one multiplier, and one tolerance. The method is identical, you just read three digits instead of two before the multiplier.' },
      { type: 'h2', text: 'The honest shortcut' },
      { type: 'p', text: 'Color codes are worth knowing, but every maker eventually just reaches for a multimeter. Set it to ohms, touch the probes to each leg, and read the value directly. It is faster and removes any doubt, especially under bad lighting.' },
    ],
    faqs: [
      { q: 'How do I read resistor color bands?', a: 'Put the tolerance band (gold or silver) on the right. The first bands are digits, the next is a multiplier, and the last is tolerance.' },
      { q: 'What color is a 220 ohm resistor?', a: 'Red, red, brown (then a gold tolerance band): 2, 2, ×10 = 220Ω.' },
      { q: 'Which side do I start reading a resistor from?', a: 'From the side opposite the gold or silver tolerance band, which always marks the end, not the start.' },
    ],
    related: ['ohms-law-explained-with-an-led', 'multimeter-skills-for-beginners'],
  },
  {
    slug: 'pwm-explained-make-an-led-breathe',
    title: 'PWM Explained: Make an LED Breathe',
    excerpt: 'Pulse-width modulation sounds intimidating. It’s really just blinking fast enough to fake brightness. Here’s how.',
    metaDescription:
      'PWM explained simply. Learn how pulse-width modulation fakes analog brightness, which Arduino pins support it, and how to make an LED fade in and out.',
    keywords: ['pwm explained', 'arduino analogWrite', 'led fade arduino', 'pulse width modulation'],
    category: 'Projects',
    date: 'May 18, 2026',
    read: '6 min read',
    author: 'The Ohmlet Team',
    swatch: 'from-ohmlet-blue to-ohmlet-blue-deep',
    takeaways: [
      'PWM switches a pin on and off very fast to fake in-between brightness.',
      'Duty cycle is the percentage of time the pin is on.',
      'On Arduino Uno, analogWrite works on pins 3, 5, 6, 9, 10, and 11.',
      'analogWrite takes 0 to 255, where 128 is roughly half brightness.',
    ],
    body: [
      { type: 'p', text: 'A digital pin can only be on (5V) or off (0V), so how does an Arduino dim an LED to half brightness? The answer is pulse-width modulation, or PWM, and it is much simpler than the name suggests.' },
      { type: 'h2', text: 'The core idea: blink faster than the eye' },
      { type: 'p', text: 'PWM turns the pin on and off hundreds of times per second. If it is on half the time and off half the time, the LED receives roughly half the power, and because the switching is faster than your eye can follow, you see steady half brightness instead of flicker.' },
      { type: 'h3', text: 'Duty cycle' },
      { type: 'p', text: 'Duty cycle is the fraction of each cycle the pin spends on. 0% duty is off, 100% is full brightness, 50% is half. That single number is what you control.' },
      { type: 'media', kind: 'image', note: 'Diagram of PWM square waves at 25%, 50%, and 75% duty cycle with the matching LED brightness.' },
      { type: 'h2', text: 'PWM on an Arduino' },
      { type: 'p', text: 'On an Arduino Uno, use analogWrite(pin, value) on a PWM-capable pin. The value runs from 0 (off) to 255 (full on), so 128 is about half brightness.' },
      { type: 'callout', title: 'Which pins?', text: 'On the Uno, only pins 3, 5, 6, 9, 10, and 11 support analogWrite. They are usually marked with a ~ symbol on the board.' },
      { type: 'h2', text: 'Make an LED breathe' },
      { type: 'p', text: 'A breathing effect just ramps the duty cycle up to 255 and back down to 0 in a loop. In code you increase analogWrite from 0 to 255 with a small delay, then decrease it back. The LED smoothly fades in and out, as if it is breathing.' },
      { type: 'list', ordered: true, items: [
        'Wire an LED and resistor to a PWM pin (one with a ~).',
        'Loop a value from 0 up to 255, writing it with analogWrite and a short delay.',
        'Loop it back down from 255 to 0.',
        'Repeat forever. Adjust the delay to change the breathing speed.',
      ] },
      { type: 'p', text: 'The same technique controls motor speed, servo position, and audio tone. Master it on an LED first, where you can see exactly what the duty cycle is doing.' },
    ],
    faqs: [
      { q: 'What does PWM stand for?', a: 'Pulse-width modulation: rapidly switching a pin on and off and varying the on-time to control average power.' },
      { q: 'Which Arduino pins support PWM?', a: 'On the Arduino Uno, pins 3, 5, 6, 9, 10, and 11. They are marked with a ~ symbol.' },
      { q: 'What range does analogWrite use?', a: 'analogWrite accepts 0 to 255, where 0 is fully off, 255 is fully on, and 128 is about half brightness.' },
    ],
    related: ['ohms-law-explained-with-an-led', 'tutorial-hell-to-first-circuit'],
  },
  {
    slug: 'multimeter-skills-for-beginners',
    title: 'The Multimeter Skills That Save Every Build',
    excerpt: 'Continuity, voltage, and resistance checks: the three measurements that turn “it doesn’t work” into “found it.”',
    metaDescription:
      'A beginner’s guide to the three multimeter measurements that matter: continuity, voltage, and resistance, with exactly when to use each while debugging.',
    keywords: ['how to use a multimeter', 'multimeter continuity test', 'measure voltage multimeter', 'multimeter for beginners'],
    category: 'Debugging',
    date: 'May 11, 2026',
    read: '7 min read',
    author: 'The Ohmlet Team',
    swatch: 'from-ohmlet-green to-ohmlet-green-deep',
    takeaways: [
      'Continuity test: is this connection actually connected? It beeps if yes.',
      'Voltage test: is power reaching where it should? Measure across two points.',
      'Resistance test: what is this resistor’s real value? Measure it out of circuit.',
      'Most "broken" circuits are one bad connection a multimeter finds in seconds.',
    ],
    body: [
      { type: 'p', text: 'A multimeter is the difference between guessing and knowing. You do not need to understand every mode on the dial. Three measurements solve the vast majority of beginner problems, and you can learn all three in one sitting.' },
      { type: 'h2', text: '1. Continuity: is it connected?' },
      { type: 'p', text: 'Set the dial to the continuity symbol (it looks like a sound wave). Touch the two probes to two points. If they are electrically connected, the meter beeps. This is the fastest way to find a broken wire, a cold joint, or to confirm two breadboard holes are on the same strip.' },
      { type: 'callout', title: 'Power off', text: 'Always run continuity and resistance tests with the circuit powered down. Voltage tests are the only one of the three you do with power on.' },
      { type: 'h2', text: '2. Voltage: is power getting there?' },
      { type: 'p', text: 'Set the dial to DC volts (often marked V with a straight line). With the circuit powered, touch the black probe to ground and the red probe to the point you want to check. This tells you whether 5V is actually reaching your sensor, or whether it drops somewhere it should not.' },
      { type: 'list', items: [
        'Across the power rails: confirms your supply is present.',
        'At a component’s pin: confirms power reaches it.',
        'Before and after a part: shows the voltage it drops.',
      ] },
      { type: 'media', kind: 'image', note: 'Photo showing probe placement for a voltage measurement across a breadboard power rail.' },
      { type: 'h2', text: '3. Resistance: what is this part?' },
      { type: 'p', text: 'Set the dial to ohms. With the component out of the circuit (or at least unpowered and isolated), touch a probe to each leg. This reads a resistor’s true value, which beats decoding color bands, and confirms whether a sensor like an LDR changes resistance as you cover it.' },
      { type: 'h2', text: 'A debugging routine' },
      { type: 'list', ordered: true, items: [
        'Power off. Run continuity along the path that should connect.',
        'Power on. Check voltage reaches each stage of the circuit.',
        'Suspect a part? Measure its resistance out of circuit.',
        'Found the break or the wrong value? Fix that one thing and retest.',
      ] },
      { type: 'p', text: 'Nine times out of ten, a dead circuit is one loose wire or one wrong part, and a multimeter finds it in under a minute. It is the most useful tool on your bench.' },
    ],
    faqs: [
      { q: 'What are the three most important multimeter functions?', a: 'Continuity (is it connected), DC voltage (is power present), and resistance (what is this part’s value). They solve most beginner debugging.' },
      { q: 'Do I test continuity with the power on or off?', a: 'Off. Continuity and resistance are measured unpowered. Only voltage is measured with the circuit powered.' },
      { q: 'How do I check if a wire is broken?', a: 'Use the continuity setting and touch a probe to each end of the wire. No beep means the wire (or its connection) is broken.' },
    ],
    related: ['arduino-sensor-reads-garbage', 'resistor-color-codes-cheat-sheet'],
  },
];

export const findPost = (slug: string): BlogPost | undefined => POSTS.find((p) => p.slug === slug);
export const featuredPost = (): BlogPost => POSTS.find((p) => p.featured) ?? POSTS[0];
export const otherPosts = (): BlogPost[] => POSTS.filter((p) => !p.featured);
