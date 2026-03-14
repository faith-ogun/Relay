import type { PlacedComponent } from './SandboxScene';

export type SandboxPreset = {
  name: string;
  components: PlacedComponent[];
  code: string;
};

const LIGHT_ALARM_CODE = `// Light-Activated Alarm — Relay Sandbox
// Circuit: LDR voltage divider on A0, LED on D9

const int LDR_PIN = A0;
const int LED_PIN = 9;
const int BUZZER_PIN = 8;
const int THRESHOLD = 400;

void setup() {
  pinMode(LED_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  Serial.begin(9600);
  Serial.println("Light Alarm Ready");
}

void loop() {
  int lightLevel = analogRead(LDR_PIN);
  Serial.print("Light: ");
  Serial.println(lightLevel);

  if (lightLevel < THRESHOLD) {
    digitalWrite(LED_PIN, HIGH);
    tone(BUZZER_PIN, 1000);
    Serial.println(">> ALARM ON");
  } else {
    digitalWrite(LED_PIN, LOW);
    noTone(BUZZER_PIN);
  }

  delay(200);
}
`;

const LIGHT_ALARM_COMPONENTS: PlacedComponent[] = [
  { id: 'board-bb', type: 'breadboard', row: -1, col: -1, rotation: 0 },
  { id: 'board-ard', type: 'arduino', row: -1, col: -1, rotation: 0 },
  { id: 'p-ldr', type: 'ldr', row: 8, col: 3, rotation: 0 },
  { id: 'p-r10k', type: 'resistor_10k', row: 8, col: 7, rotation: 0 },
  { id: 'p-r220', type: 'resistor_220', row: 22, col: 3, rotation: 0 },
  { id: 'p-led', type: 'led_red', row: 22, col: 7, rotation: 0 },
  { id: 'p-buzzer', type: 'buzzer', row: 32, col: 5, rotation: 0 },
  { id: 'w1', type: 'wire', row: 5, col: 2, rotation: 0, endRow: 8, endCol: 2 },
  { id: 'w2', type: 'wire', row: 8, col: 4, rotation: 0, endRow: 12, endCol: 4 },
  { id: 'w3', type: 'wire', row: 8, col: 8, rotation: 0, endRow: 5, endCol: 8 },
  { id: 'w4', type: 'wire', row: 18, col: 2, rotation: 0, endRow: 22, endCol: 2 },
  { id: 'w5', type: 'wire', row: 22, col: 8, rotation: 0, endRow: 26, endCol: 8 },
  { id: 'w6', type: 'wire', row: 28, col: 4, rotation: 0, endRow: 32, endCol: 4 },
  { id: 'w7', type: 'wire', row: 32, col: 6, rotation: 0, endRow: 36, endCol: 6 },
];

export const SANDBOX_PRESETS: Record<string, SandboxPreset> = {
  'Light-Activated Alarm': {
    name: 'Light-Activated Alarm',
    components: LIGHT_ALARM_COMPONENTS,
    code: LIGHT_ALARM_CODE,
  },
};
