// ── Ohmlet AVR runner (#73) ──
//
// Runs REAL ATmega328P firmware in the browser with Wokwi's AVR8js (MIT). The
// firmware comes from our compile service (avr-gcc), so a learner's actual
// Arduino sketch executes cycle-accurately and drives the simulated board. This
// module owns the CPU + its peripherals and exposes a tiny surface: load a hex,
// step real time, read pin states, push button inputs, read the serial stream.

import {
  CPU, avrInstruction,
  AVRIOPort, portBConfig, portCConfig, portDConfig,
  AVRTimer, timer0Config, timer1Config, timer2Config,
  AVRUSART, usart0Config, AVRADC, adcConfig, PinState,
} from 'avr8js';

export const FREQ = 16_000_000; // 16 MHz Uno
export const CYCLES_PER_MS = FREQ / 1000;

/** Parse an Intel HEX string into the 32 KB flash image of a 328P. */
export function parseHex(hex: string): Uint8Array {
  const flash = new Uint8Array(0x8000);
  for (const line of hex.split('\n')) {
    if (line.length < 11 || line[0] !== ':') continue;
    const len = parseInt(line.substr(1, 2), 16);
    const addr = parseInt(line.substr(3, 4), 16);
    const type = parseInt(line.substr(7, 2), 16);
    if (type === 1) break;            // EOF
    if (type !== 0) continue;         // ignore extended-addressing for a 32K part
    for (let i = 0; i < len; i++) {
      const b = parseInt(line.substr(9 + i * 2, 2), 16);
      if (addr + i < flash.length) flash[addr + i] = b;
    }
  }
  return flash;
}

export type Port = 'B' | 'C' | 'D';

export class AVRRunner {
  readonly cpu: CPU;
  readonly portB: AVRIOPort;
  readonly portC: AVRIOPort;
  readonly portD: AVRIOPort;
  private readonly usart: AVRUSART;
  private readonly adc: AVRADC;
  serial = '';

  constructor(hex: string) {
    const flash = parseHex(hex);
    this.cpu = new CPU(new Uint16Array(flash.buffer));
    // Timers drive millis()/delay()/PWM; without timer0 the Arduino time base is dead.
    new AVRTimer(this.cpu, timer0Config);
    new AVRTimer(this.cpu, timer1Config);
    new AVRTimer(this.cpu, timer2Config);
    this.portB = new AVRIOPort(this.cpu, portBConfig);
    this.portC = new AVRIOPort(this.cpu, portCConfig);
    this.portD = new AVRIOPort(this.cpu, portDConfig);
    this.adc = new AVRADC(this.cpu, adcConfig); // analogRead(A0..A5)
    this.usart = new AVRUSART(this.cpu, usart0Config, FREQ);
    this.usart.onByteTransmit = (b: number) => {
      this.serial += String.fromCharCode(b);
      if (this.serial.length > 6000) this.serial = this.serial.slice(-4000);
    };
  }

  private port(p: Port): AVRIOPort { return p === 'B' ? this.portB : p === 'C' ? this.portC : this.portD; }

  /** Drive an external input pin (e.g. a button): high = not pressed with pull-up. */
  setInput(p: Port, pin: number, high: boolean) { this.port(p).setPin(pin, high); }

  /** Is this output pin currently driven HIGH? */
  isHigh(p: Port, pin: number): boolean { return this.port(p).pinState(pin) === PinState.High; }

  /** Feed an analog voltage (0..AVcc) to an ADC channel, e.g. a pot on A0. */
  setAnalog(channel: number, volts: number) {
    if (this.adc.channelValues) this.adc.channelValues[channel] = Math.max(0, Math.min(5, volts));
  }

  /** Execute approximately `cycles` clock cycles (one animation frame's worth). */
  runCycles(cycles: number) {
    const target = this.cpu.cycles + cycles;
    while (this.cpu.cycles < target) {
      avrInstruction(this.cpu);
      this.cpu.tick();
    }
  }

  /**
   * Run a frame's worth of cycles, sampling the given pins in sub-frame chunks so
   * a PWM (analogWrite) pin reports its real duty cycle (0..1), not a single
   * instant. A plain digital pin reports ~0 or ~1 as expected.
   */
  runFrame(cycles: number, sample: Array<[Port, number]>): number[] {
    const CHUNKS = 100;
    const per = Math.max(1, Math.floor(cycles / CHUNKS));
    const acc = sample.map(() => 0);
    let n = 0;
    for (let c = 0; c < CHUNKS; c++) {
      this.runCycles(per);
      for (let i = 0; i < sample.length; i++) if (this.isHigh(sample[i][0], sample[i][1])) acc[i]++;
      n++;
    }
    return acc.map((a) => a / n);
  }
}

// ── Arduino Uno pin → (port, bit) map for the digital pins we expose ──
export const UNO_PIN: Record<number, [Port, number]> = {
  0: ['D', 0], 1: ['D', 1], 2: ['D', 2], 3: ['D', 3], 4: ['D', 4], 5: ['D', 5], 6: ['D', 6], 7: ['D', 7],
  8: ['B', 0], 9: ['B', 1], 10: ['B', 2], 11: ['B', 3], 12: ['B', 4], 13: ['B', 5],
};
