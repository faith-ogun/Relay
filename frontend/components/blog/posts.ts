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
  | { type: 'code'; caption?: string; code: string }
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

  // ── Build guides (SEO; step-by-step projects) ──
  {
    slug: 'build-a-light-activated-alarm-arduino',
    title: 'Build a Light-Activated Alarm with Arduino (LDR + Buzzer)',
    excerpt:
      'A complete beginner build: wire an LDR and a buzzer to an Arduino so an alarm sounds the moment a light turns on, like when someone opens a drawer or a fridge. Parts list, wiring, full code, and the calibration trick that makes it actually work.',
    metaDescription:
      'Step-by-step Arduino light-activated alarm using an LDR (photoresistor) and a buzzer. Full wiring diagram, complete code, and how to calibrate the light threshold.',
    keywords: [
      'arduino light activated alarm',
      'ldr arduino tutorial',
      'photoresistor arduino',
      'arduino light sensor buzzer',
      'arduino alarm project',
    ],
    category: 'Build Guides',
    date: 'Jun 26, 2026',
    read: '10 min read',
    author: 'The Ohmlet Team',
    swatch: 'from-ohmlet-gold to-ohmlet-gold-deep',
    takeaways: [
      'An LDR (photoresistor) changes resistance with light; a voltage divider turns that into a signal the Arduino can read.',
      'analogRead gives 0–1023; you pick a threshold to decide "dark" vs "light".',
      'The whole build is an LDR, one fixed resistor, a buzzer, and four jumper wires.',
      'Calibration (reading real values in your own room) is the step beginners skip and then wonder why it never triggers.',
    ],
    body: [
      { type: 'p', text: 'A light-activated alarm sounds the moment light hits a sensor, which makes it perfect for catching when someone opens a drawer, a cupboard, or the fridge at midnight. It is one of the best first Arduino builds because every part of it is visible: light goes up, a number goes up, a buzzer goes off. Nothing is hidden.' },
      { type: 'p', text: 'This guide builds the whole thing end to end with an LDR (also called a photoresistor), one resistor, and a buzzer. You will wire it, load the code, and then do the one step that beginners skip: calibrating the threshold to your actual room.' },
      { type: 'h2', text: 'What you need' },
      {
        type: 'table',
        head: ['Part', 'Quantity', 'Notes'],
        rows: [
          ['Arduino Uno (or compatible)', '1', 'Any board with analog pins works'],
          ['LDR / photoresistor', '1', 'The light sensor'],
          ['Resistor, 10kΩ', '1', 'The fixed half of the voltage divider'],
          ['Active buzzer', '1', 'Active = makes sound on its own with DC'],
          ['Breadboard + jumper wires', '1 set', 'Four wires is enough'],
        ],
      },
      { type: 'callout', title: 'Active vs passive buzzer', text: 'An active buzzer beeps when you simply put voltage across it (digitalWrite HIGH). A passive buzzer needs a tone() signal. This guide uses an active buzzer; if yours stays silent on HIGH, you likely have a passive one, see the code note below.' },
      { type: 'h2', text: 'How it works: the voltage divider' },
      { type: 'p', text: 'An LDR is just a resistor whose resistance falls as light increases: dark might be 100kΩ, bright daylight might be 1kΩ. An Arduino cannot read resistance directly, only voltage. So we pair the LDR with a fixed 10kΩ resistor to form a voltage divider: the two resistors split the 5V supply in proportion to their resistances, and the Arduino reads the voltage at the midpoint.' },
      { type: 'p', text: 'When it is dark, the LDR resistance is high, so most of the voltage drops across it and the midpoint reads low. When light hits it, the LDR resistance falls and the midpoint voltage rises. That changing midpoint is what analogRead measures.' },
      { type: 'media', kind: 'image', note: 'Breadboard wiring diagram: LDR and 10kΩ resistor forming a divider, midpoint to A0, buzzer on pin 8.' },
      { type: 'h2', text: 'Wiring it up' },
      {
        type: 'list',
        ordered: true,
        items: [
          'Place the LDR across the breadboard gap. Connect one leg to 5V.',
          'Connect the LDR’s other leg to one end of the 10kΩ resistor, and that same junction to analog pin A0. This junction is the divider midpoint.',
          'Connect the resistor’s free end to GND.',
          'Connect the buzzer: positive (longer) leg to digital pin 8, negative leg to GND.',
          'Double-check 5V and GND are the only things on the power rails before plugging in.',
        ],
      },
      { type: 'callout', title: 'Why A0, not a digital pin', text: 'A digital pin can only tell you HIGH or LOW. Light is a smooth range, so we use an analog pin (A0) to read the full 0–1023 scale and choose our own cut-off.' },
      { type: 'h2', text: 'The code' },
      { type: 'p', text: 'Upload this sketch. It reads the sensor, prints the value so you can calibrate, and sounds the buzzer when the reading crosses your threshold.' },
      {
        type: 'code',
        caption: 'light_alarm.ino',
        code: `const int LDR_PIN = A0;     // divider midpoint
const int BUZZER_PIN = 8;   // active buzzer
int threshold = 600;        // tune this after calibrating

void setup() {
  pinMode(BUZZER_PIN, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  int light = analogRead(LDR_PIN);   // 0 (dark) .. 1023 (bright)
  Serial.println(light);             // watch this in the Serial Monitor

  if (light > threshold) {
    digitalWrite(BUZZER_PIN, HIGH);  // light detected -> alarm
  } else {
    digitalWrite(BUZZER_PIN, LOW);   // dark -> quiet
  }
  delay(50);
}`,
      },
      { type: 'callout', title: 'Passive buzzer?', text: 'If your buzzer is passive, swap digitalWrite(BUZZER_PIN, HIGH) for tone(BUZZER_PIN, 1000) and digitalWrite(..., LOW) for noTone(BUZZER_PIN).' },
      { type: 'h2', text: 'Calibrate the threshold (the step everyone skips)' },
      { type: 'p', text: 'The 600 in the code is a placeholder. Your room is not our room. Open the Serial Monitor (Tools → Serial Monitor, 9600 baud) and watch the numbers: cover the LDR and note the "dark" value, then shine a phone torch on it and note the "bright" value. Pick a threshold roughly halfway between the two.' },
      {
        type: 'table',
        head: ['Reading', 'Typical value', 'Meaning'],
        rows: [
          ['LDR covered', '~150–350', 'Dark; alarm should be silent'],
          ['Room light', '~500–700', 'Ambient; decide which side this is on'],
          ['Torch on sensor', '~850–1000', 'Bright; alarm should fire'],
        ],
      },
      { type: 'p', text: 'Set threshold a little above your normal room reading so everyday light does not trip it, but below the torch value so a real light source does. Re-upload and test by covering and uncovering the sensor.' },
      { type: 'h2', text: 'Troubleshooting' },
      {
        type: 'list',
        items: [
          'Buzzer never sounds: your threshold is higher than any reading. Lower it toward your bright value.',
          'Buzzer always sounds: threshold is below your dark reading. Raise it.',
          'Readings stuck at 0 or 1023: the divider is miswired, A0 is reading a bare 5V or GND rail instead of the midpoint.',
          'Faint buzzing only: you likely have a passive buzzer, use tone() as noted above.',
        ],
      },
      { type: 'callout', title: 'Build it with a tutor watching', text: 'In Ohmlet, this exact build is guided live: the tutor sees your breadboard through your camera, checks each wire as you place it, and helps you calibrate the threshold against your real readings, so a miswired divider gets caught in seconds, not after ten minutes of confusion.' },
      { type: 'h2', text: 'Where to take it next' },
      { type: 'p', text: 'Once it works, try these upgrades: add an LED that lights with the buzzer, invert the logic to make a darkness alarm (a night light), or add a potentiometer so you can turn the threshold by hand instead of editing code. Each is a small change to the same circuit and a real lesson in how the pieces compose.' },
    ],
    faqs: [
      { q: 'Do I need a specific LDR?', a: 'No. Any common photoresistor (often sold as GL5528) works. The exact resistance does not matter because you calibrate the threshold to whatever your LDR reads in your room.' },
      { q: 'Can I use an LED instead of a buzzer?', a: 'Yes. Wire an LED (with a 220–330Ω resistor) to pin 8 instead of, or alongside, the buzzer. The code is identical because both are just outputs you drive HIGH.' },
      { q: 'Why is my reading the opposite of what I expect?', a: 'It depends on which side of the divider the LDR is on. If bright light gives a low number, swap the LDR and the fixed resistor positions, or simply flip the comparison to light < threshold.' },
      { q: 'What resistor value should I use with the LDR?', a: '10kΩ is a good default that centres the divider for indoor light. If your readings bunch up at one end, try 4.7kΩ (for brighter environments) or 22kΩ (for dimmer ones).' },
    ],
    related: ['ohms-law-explained-with-an-led', 'arduino-sensor-reads-garbage', 'build-an-arduino-traffic-light'],
  },

  {
    slug: 'build-an-arduino-traffic-light',
    title: 'Build an Arduino Traffic Light (3 LEDs, Step by Step)',
    excerpt:
      'The classic first project that teaches timing and sequencing: three LEDs that cycle red, green, amber like a real traffic light. Parts, wiring, full code, and how to extend it to a pedestrian crossing.',
    metaDescription:
      'Beginner Arduino traffic light project with 3 LEDs. Full wiring, complete code with millis vs delay, resistor values, and a pedestrian-crossing extension.',
    keywords: [
      'arduino traffic light',
      'arduino traffic light code',
      'arduino led sequence',
      'arduino beginner project',
      'arduino 3 led project',
    ],
    category: 'Build Guides',
    date: 'Jun 26, 2026',
    read: '9 min read',
    author: 'The Ohmlet Team',
    swatch: 'from-ohmlet-red to-ohmlet-gold',
    takeaways: [
      'Three LEDs plus three resistors is all the hardware a traffic light needs.',
      'Every LED needs its own current-limiting resistor (220–330Ω), never wire one bare to a pin.',
      'The logic is just a timed sequence: which light is on, and for how long.',
      'Swapping delay() for millis() is the upgrade that lets the light do more than one thing at once.',
    ],
    body: [
      { type: 'p', text: 'A traffic light is the project almost every maker builds early, and for good reason: it is pure sequencing. Red, then green, then amber, then back, each for a set time. You will learn how to drive multiple outputs, why every LED needs a resistor, and the difference between delay() and millis() that separates toy code from code that scales.' },
      { type: 'h2', text: 'What you need' },
      {
        type: 'table',
        head: ['Part', 'Quantity', 'Notes'],
        rows: [
          ['Arduino Uno (or compatible)', '1', 'Three digital pins used'],
          ['LEDs (red, green, yellow)', '3', 'Yellow stands in for amber'],
          ['Resistor, 220–330Ω', '3', 'One per LED, current limiting'],
          ['Breadboard + jumper wires', '1 set', ''],
        ],
      },
      { type: 'callout', title: 'Never skip the resistors', text: 'An LED wired straight to a 5V pin draws too much current and burns out (and stresses the pin). Each LED needs a series resistor of about 220–330Ω. This is the single most common beginner mistake.' },
      { type: 'h2', text: 'Wiring it up' },
      {
        type: 'list',
        ordered: true,
        items: [
          'For each LED: the long leg (anode, +) connects through a 220Ω resistor to a digital pin. Use pin 4 for red, pin 3 for yellow, pin 2 for green.',
          'The short leg (cathode, −) of every LED goes to the GND rail.',
          'Connect one Arduino GND pin to the breadboard’s GND rail so all three LEDs share ground.',
          'Sanity check: each LED has exactly one resistor in series, and all cathodes meet at GND.',
        ],
      },
      { type: 'media', kind: 'image', note: 'Breadboard layout: three LEDs in a column, each with a 220Ω resistor to pins 2/3/4, all cathodes to the GND rail.' },
      { type: 'h2', text: 'The code (simple version)' },
      { type: 'p', text: 'Start with the readable, delay-based version. It cycles like a UK-style light: red, red+amber, green, amber, repeat. Trim it to red/green/amber if you prefer.' },
      {
        type: 'code',
        caption: 'traffic_light.ino',
        code: `const int RED = 4;
const int YELLOW = 3;
const int GREEN = 2;

void setup() {
  pinMode(RED, OUTPUT);
  pinMode(YELLOW, OUTPUT);
  pinMode(GREEN, OUTPUT);
}

void loop() {
  // RED
  set(HIGH, LOW, LOW);
  delay(4000);

  // RED + AMBER (get ready)
  set(HIGH, HIGH, LOW);
  delay(1500);

  // GREEN (go)
  set(LOW, LOW, HIGH);
  delay(4000);

  // AMBER (stop soon)
  set(LOW, HIGH, LOW);
  delay(1500);
}

void set(int r, int y, int g) {
  digitalWrite(RED, r);
  digitalWrite(YELLOW, y);
  digitalWrite(GREEN, g);
}`,
      },
      { type: 'callout', title: 'Why a helper function', text: 'The set(r, y, g) helper means each phase is one readable line instead of three. Small habit, big payoff when the sequence grows.' },
      { type: 'h2', text: 'The upgrade: millis() instead of delay()' },
      { type: 'p', text: 'delay() freezes the whole board: while it waits, the Arduino can do nothing else, no button check, no second light. Real projects use millis(), which lets you track time without blocking. Here is the same sequence written so the board stays responsive.' },
      {
        type: 'code',
        caption: 'traffic_light_millis.ino',
        code: `const int RED = 4, YELLOW = 3, GREEN = 2;

// phase durations in ms: red, red+amber, green, amber
const unsigned long DUR[4] = {4000, 1500, 4000, 1500};
int phase = 0;
unsigned long phaseStart = 0;

void setup() {
  pinMode(RED, OUTPUT); pinMode(YELLOW, OUTPUT); pinMode(GREEN, OUTPUT);
  phaseStart = millis();
}

void loop() {
  // advance the phase when its time is up, without blocking
  if (millis() - phaseStart >= DUR[phase]) {
    phase = (phase + 1) % 4;
    phaseStart = millis();
  }

  digitalWrite(RED,    phase == 0 || phase == 1);
  digitalWrite(YELLOW, phase == 1 || phase == 3);
  digitalWrite(GREEN,  phase == 2);

  // ... room here to read a button, blink a pedestrian light, etc.
}`,
      },
      { type: 'h2', text: 'Troubleshooting' },
      {
        type: 'list',
        items: [
          'An LED never lights: check it is not in backwards (long leg to the resistor/pin side) and the resistor is actually in series.',
          'All LEDs dim: you may have wired them through one shared resistor; each needs its own.',
          'Nothing happens: confirm the board’s GND is tied to the breadboard GND rail.',
          'Sequence runs but order is wrong: your pin numbers in code do not match the wiring, line them up.',
        ],
      },
      { type: 'callout', title: 'See it before you wire it', text: 'You can prototype this exact circuit in Ohmlet’s simulator first, drag the LEDs and resistors, watch current flow and the heat map, then build the real thing with the live tutor checking each leg as you go.' },
      { type: 'h2', text: 'Extend it: a pedestrian crossing' },
      { type: 'p', text: 'Add a pushbutton and a fourth LED (a walk light). When the button is pressed, finish the current green, then run a pedestrian phase. Because the millis() version never blocks, the button is easy to fold in, which is exactly why that upgrade was worth making.' },
    ],
    faqs: [
      { q: 'What resistor value for the LEDs?', a: '220Ω to 330Ω is the safe range for standard LEDs on a 5V Arduino. 220Ω is brighter, 330Ω is dimmer and gentler. Either is fine.' },
      { q: 'Can I use delay() forever?', a: 'For a single blinking light, sure. The moment you want a second thing to happen (a button, a buzzer, another light) delay() gets in the way, which is why the millis() version exists.' },
      { q: 'My yellow LED looks orange/amber, is that wrong?', a: 'No. Real traffic "amber" is a yellow-orange. A standard yellow LED is the right stand-in; a true amber LED just shifts the hue slightly.' },
      { q: 'Do all the LEDs share one ground?', a: 'Yes. All cathodes connect to the GND rail, and that rail connects to an Arduino GND pin. Each LED still has its own resistor on the positive side.' },
    ],
    related: ['ohms-law-explained-with-an-led', 'resistor-color-codes-cheat-sheet', 'build-a-light-activated-alarm-arduino'],
  },
];

export const findPost = (slug: string): BlogPost | undefined => POSTS.find((p) => p.slug === slug);
export const featuredPost = (): BlogPost => POSTS.find((p) => p.featured) ?? POSTS[0];
export const otherPosts = (): BlogPost[] => POSTS.filter((p) => !p.featured);
