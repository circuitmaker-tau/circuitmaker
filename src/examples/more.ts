import { buildCircuit } from './build';

/**
 * WK7A and exam 2026A, 2C: a plain encoder next to a priority encoder, fed by
 * the same four switches. With one input on they agree; with two on, the plain
 * encoder's output is undefined (X), and the priority encoder gives the code of
 * the highest input. V = 0 when no input is on.
 */
export const encoders = buildCircuit(
  'מקודד רגיל מול מקודד עדיפויות (WK7A)',
  'none',
  [
    ['D3', 'INPUT', 0, 0, { props: { value: 0 } }],
    ['D2', 'INPUT', 0, 90, { props: { value: 1 } }],
    ['D1', 'INPUT', 0, 180, { props: { value: 0 } }],
    ['D0', 'INPUT', 0, 270, { props: { value: 0 } }],
    ['En', 'CONST1', 0, 380],
    ['enc', 'ENC4x2', 260, 20, { delay: 1 }],
    ['penc', 'PRIORITY_ENC4x2', 260, 240, { delay: 1 }],
    ['X1', 'OUTPUT', 500, 0],
    ['X0', 'OUTPUT', 500, 90],
    ['P1', 'OUTPUT', 500, 220],
    ['P0', 'OUTPUT', 500, 300],
    ['V', 'OUTPUT', 500, 380],
  ],
  [
    'D0>enc.D0',
    'D1>enc.D1',
    'D2>enc.D2',
    'D3>enc.D3',
    'En>enc.En',
    'D0>penc.D0',
    'D1>penc.D1',
    'D2>penc.D2',
    'D3>penc.D3',
    'En>penc.En',
    'enc.X1>X1.in',
    'enc.X0>X0.in',
    'penc.X1>P1.in',
    'penc.X0>P0.in',
    'penc.V>V.in',
  ],
);

/**
 * Exam 2024B, 2E: a JK-FF with J = K = 1 (Q0), a D-FF with D = Q0 (Q1) and a
 * T-FF with T = Q0 (Q2), all on one clock, starting at 000, Tp negligible.
 * Q2Q1Q0 runs 001, 110, 101, 010 and repeats: periodic, and the sum of one
 * period is 1 + 6 + 5 + 2 = 14, as in the solution.
 */
export const ffChain = buildCircuit(
  'JK, D ו-T על שעון אחד (2024 מועד ב, 2E)',
  's',
  [
    ['CLK', 'CLOCK', 0, 200],
    ['one', 'CONST1', 0, 40],
    ['f0', 'JK_FF', 160, 40, { delay: 0, props: { init: 0 } }],
    ['f1', 'D_FF', 360, 60, { delay: 0, props: { init: 0 } }],
    ['f2', 'T_FF', 560, 60, { delay: 0, props: { init: 0 } }],
    ['Q0', 'OUTPUT', 760, 0],
    ['Q1', 'OUTPUT', 760, 90],
    ['Q2', 'OUTPUT', 760, 180],
  ],
  [
    'one>f0.J',
    'one>f0.K',
    'f0.Q>f1.D',
    'f0.Q>f2.T',
    'CLK>f0.CLK',
    'CLK>f1.CLK',
    'CLK>f2.CLK',
    'f0.Q>Q0.in',
    'f1.Q>Q1.in',
    'f2.Q>Q2.in',
  ],
);
