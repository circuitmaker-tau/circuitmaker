import { buildCircuit } from './build';
import type { Part } from './build';

/**
 * Counters of week 8B. The clock has a period of 10 (rising edges at 5, 15,
 * 25, …), and every flip-flop and gate has Tp = 1, so the delays inside one
 * count are easy to read in the timing diagram.
 */
const clock = { halfPeriod: 5, startLevel: 0 as const };
const ff = (k: number, x: number, extra = {}): Part => [
  `FF${k}`,
  'T_FF',
  x,
  220,
  { props: { init: 0, ...extra } },
];
const lamps: Part[] = [0, 1, 2, 3].map((k) => [`Q${k}`, 'OUTPUT', 140 + k * 200, 380]);

/**
 * WK8B, "arbitrary base counter": a synchronous 4-bit counter of T flip-flops
 * (T0 = 1, T1 = Q0, T2 = Q0Q1, T3 = Q0Q1Q2) with an asynchronous active-low
 * CLR'. CLR' = NAND(Q2, Q1) clears it as soon as it reaches 6 (0110), so it
 * counts 0 to 5. The state 6 appears for a moment: from the edge until the
 * NAND and the clear have gone through their Tp.
 */
export const modulo6 = buildCircuit(
  'מונה מודולו 6 עם CLR\' אסינכרוני (WK8B)',
  'none',
  [
    ['CLK', 'CLOCK', 0, 120, { props: clock }],
    ['one', 'CONST1', 0, 240],
    ff(0, 140, { async: true }),
    ff(1, 340, { async: true }),
    ff(2, 540, { async: true }),
    ff(3, 740, { async: true }),
    ['T2', 'AND', 440, 100],
    ['T3', 'AND', 640, 40, { inputs: 3 }],
    ['clr', 'NAND', 860, 120],
    ...lamps,
  ],
  [
    'one>FF0.T',
    'FF0.Q>FF1.T',
    'FF0.Q>T2.in0',
    'FF1.Q>T2.in1',
    'T2>FF2.T',
    'FF0.Q>T3.in0',
    'FF1.Q>T3.in1',
    'FF2.Q>T3.in2',
    'T3>FF3.T',
    ...[0, 1, 2, 3].map((k) => `CLK>FF${k}.CLK`),
    'FF2.Q>clr.in0',
    'FF1.Q>clr.in1',
    ...[0, 1, 2, 3].map((k) => `clr>FF${k}.CLR'`),
    ...[0, 1, 2, 3].map((k) => `FF${k}.Q>Q${k}.in`),
  ],
);

/**
 * WK8B, ripple counter: T = 1 for all four T flip-flops, the clock only into
 * the first, and the Q' of each one is the clock of the next, so it counts up.
 * Every stage waits for the one before it: from 7 (0111) to 8 (1000) the
 * outputs pass through 6, 4 and 0 before they settle, 4 Tp after the edge.
 */
export const rippleCounter = buildCircuit(
  'מונה ripple מ-4 T-FF (WK8B)',
  'none',
  [
    ['CLK', 'CLOCK', 0, 120, { props: clock }],
    ['one', 'CONST1', 0, 280],
    ff(0, 140),
    ff(1, 340),
    ff(2, 540),
    ff(3, 740),
    ...lamps,
  ],
  [
    ...[0, 1, 2, 3].map((k) => `one>FF${k}.T`),
    'CLK>FF0.CLK',
    "FF0.Q'>FF1.CLK",
    "FF1.Q'>FF2.CLK",
    "FF2.Q'>FF3.CLK",
    ...[0, 1, 2, 3].map((k) => `FF${k}.Q>Q${k}.in`),
  ],
);
