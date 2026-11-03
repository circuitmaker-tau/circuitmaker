import { createComponent, createWire } from '../model/factory';
import type { Circuit, Wire } from '../model/types';

/**
 * A 4-bit ripple-carry adder from four full adders (WK6A, exam 2022A), set to
 * 0011 + 1011 = 1110. Every FA has Tp = 1, so the carry is seen rippling from
 * FA0 to FA3: flip A0 and the sum settles one FA at a time. Part of the
 * project's exam demo.
 */
const A = [1, 1, 0, 0] as const; // A0 … A3 = 0011
const B = [1, 1, 0, 1] as const; // B0 … B3 = 1011

const wires: Wire[] = [];
const wire = (from: [string, string], to: [string, string]) =>
  wires.push(createWire(`w${wires.length + 1}`, from, to));

for (let i = 0; i < 4; i++) {
  wire([`A${i}`, 'out'], [`FA${i}`, 'A']);
  wire([`B${i}`, 'out'], [`FA${i}`, 'B']);
  wire(i === 0 ? ['c0', 'out'] : [`FA${i - 1}`, 'Cout'], [`FA${i}`, 'Cin']);
  wire([`FA${i}`, 'S'], [`S${i}`, 'in']);
}
wire(['FA3', 'Cout'], ['Cout', 'in']);

export const rippleAdder: Circuit = {
  version: 1,
  name: 'מסכם ripple-carry של 4 ביט (0011 + 1011)',
  timeUnit: 'ns',
  components: [
    ...[0, 1, 2, 3].flatMap((i) => [
      createComponent('INPUT', `A${i}`, { x: 0, y: i * 150 }, { props: { value: A[i] } }),
      createComponent('INPUT', `B${i}`, { x: 0, y: i * 150 + 60 }, { props: { value: B[i] } }),
      createComponent('FULL_ADDER', `FA${i}`, { x: 220, y: i * 150 + 10 }),
      createComponent('OUTPUT', `S${i}`, { x: 480, y: i * 150 + 10 }),
    ]),
    createComponent('CONST0', 'c0', { x: 110, y: -40 }),
    createComponent('OUTPUT', 'Cout', { x: 480, y: 610 }),
  ],
  wires,
};
