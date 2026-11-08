import type { Stimulus } from '../model/types';
import { buildCircuit } from './build';
import { FSM_PERIOD, perCycle } from './fsm';

/**
 * WK5, slide 11 (levels and delays): f = X1'X3 + X2(X3 + X1X0), drawn as in
 * the lecture, with Tp(NOT) = 1, Tp(AND) = 2.5 and Tp(OR) = 2 ns. The longest
 * of the five paths on the slide is X0 or X1 → AND → OR → AND → OR:
 * 2.5 + 2 + 2.5 + 2 = 9 ns. Through the inverter it is only 1 + 2.5 + 2 = 5.5.
 */
export const wk5Levels = buildCircuit(
  'רמות והשהיות (WK5, שקף 11)',
  'ns',
  [
    ['X0', 'INPUT', 0, 0, { props: { value: 1 } }],
    ['X1', 'INPUT', 0, 100, { props: { value: 1 } }],
    ['X2', 'INPUT', 0, 200, { props: { value: 1 } }],
    ['X3', 'INPUT', 0, 300, { props: { value: 0 } }],
    ['a1', 'AND', 160, 20, { delay: 2.5 }],
    ['o1', 'OR', 320, 80, { delay: 2 }],
    ['a2', 'AND', 480, 150, { delay: 2.5 }],
    ['n1', 'NOT', 160, 240, { delay: 1 }],
    ['a3', 'AND', 320, 280, { delay: 2.5 }],
    ['o2', 'OR', 640, 210, { delay: 2 }],
    ['f', 'OUTPUT', 800, 220],
  ],
  [
    'X1>a1.in0',
    'X0>a1.in1',
    'a1>o1.in0',
    'X3>o1.in1',
    'X2>a2.in0',
    'o1>a2.in1',
    'X1>n1.in0',
    'n1>a3.in0',
    'X3>a3.in1',
    'a2>o2.in0',
    'a3>o2.in1',
    'o2>f.in',
  ],
);

/** X of exam 2025B, 2D: 0 at first, and it switches every second (rising at 1, 3, …, 11). */
const X_2025B: Stimulus[] = Array.from({ length: 11 }, (_, i) => ({ time: i + 1, value: i % 2 === 0 ? 1 : 0 }));

/**
 * Exam 2025B, 2D: Q0 = NAND(X, X'), Q1 = NAND(X, X), Q2 = NOR(Q0, Q1).
 * With Tp = 0 everywhere Q0 = 1, Q1 = X' and Q2 = 0. Sub-section 2 (as
 * corrected by hand in the official solution): only the inverter has
 * Tp = 0.5. Each time X rises, X and X' are both 1 for 0.5 s, so Q0 drops to
 * 0 for 0.5 s, and since Q1 = 0 then, Q2 has a pulse of 0.5 s. When X falls
 * both are 0 for a moment, and nothing happens.
 */
export const nandGlitch = buildCircuit(
  'מהפך, שני NAND ו-NOR (2025 מועד ב, 2D)',
  's',
  [
    ['X', 'INPUT', 0, 120, { props: { value: 0, schedule: X_2025B } }],
    ['nX', 'NOT', 140, 60, { delay: 0.5 }],
    ['Q0', 'NAND', 300, 20, { delay: 0 }],
    ['Q1', 'NAND', 300, 220, { delay: 0 }],
    ['Q2', 'NOR', 480, 120, { delay: 0 }],
    ['L', 'OUTPUT', 640, 130],
  ],
  ['X>Q0.in0', 'X>nX.in0', 'nX>Q0.in1', 'X>Q1.in0', 'X>Q1.in1', 'Q0>Q2.in0', 'Q1>Q2.in1', 'Q2>L.in'],
);

/**
 * Exam 2024A, 2E: a T-FF with T = 1 (Q0), a D-FF with D = Q0 (Q1) and a T-FF
 * with T = Q1 (Q2), on one clock, starting at 000, Tp negligible. Q2Q1Q0 runs
 * 001, 010, 101, 110 and repeats, so the smallest number is 1 and the largest
 * 6, as in the solution.
 */
export const tdtChain = buildCircuit(
  'T, D ו-T בשרשרת (2024 מועד א, 2E)',
  's',
  [
    ['CLK', 'CLOCK', 0, 200],
    ['one', 'CONST1', 0, 40],
    ['f0', 'T_FF', 160, 40, { delay: 0, props: { init: 0 } }],
    ['f1', 'D_FF', 360, 40, { delay: 0, props: { init: 0 } }],
    ['f2', 'T_FF', 560, 40, { delay: 0, props: { init: 0 } }],
    ['Q0', 'OUTPUT', 760, 0],
    ['Q1', 'OUTPUT', 760, 90],
    ['Q2', 'OUTPUT', 760, 180],
  ],
  [
    'one>f0.T',
    'f0.Q>f1.D',
    'f1.Q>f2.T',
    'CLK>f0.CLK',
    'CLK>f1.CLK',
    'CLK>f2.CLK',
    'f0.Q>Q0.in',
    'f1.Q>Q1.in',
    'f2.Q>Q2.in',
  ],
);

/** The example series of exam 2026A, question 3 (one bit per clock cycle). */
export const PLANE_XL: (0 | 1)[] = [...'11100001111111000111110011111111'].map((b) => +b as 0 | 1);
export const PLANE_XR: (0 | 1)[] = [...'11111111100000000000111100111111'].map((b) => +b as 0 | 1);
export const PLANE_Z: (0 | 1)[] = [...'00010100010101111010001010000000'].map((b) => +b as 0 | 1);

/**
 * Exam 2026A, question 3: the 737-MAX machine with two SR flip-flops, with the
 * equations of the official solution:
 *   S1 = XL'XR' + y2XL' + y2XR'    R1 = XLXR + y2'XR + y2'XL
 *   S2 = y2'XR' + y2'XL'           R2 = y2XR + y2XL
 *   Z  = y2'XR' + y2'XL' + XL'XR'  (Mealy)
 * Both sensors fine: Z = 0; one down: Z toggles 1010…; both down: Z = 1.
 * y1 drives nothing, which is why 3D says one T-FF is enough. The clock and
 * the inputs are timed like the week 9 machines (inputs change at 10i, edges
 * at 10i + 5).
 */
export const planeFsm = buildCircuit(
  'מכונת המטוס 737-MAX עם שני SR-FF (2026 מועד א, שאלה 3)',
  'none',
  [
    ['XL', 'INPUT', 0, 40, { props: perCycle(PLANE_XL) }],
    ['XR', 'INPUT', 0, 200, { props: perCycle(PLANE_XR) }],
    ['CLK', 'CLOCK', 0, 760, { props: { halfPeriod: FSM_PERIOD / 2, startLevel: 0 } }],
    ['nL', 'NOT', 140, 0],
    ['nR', 'NOT', 140, 240],
    ['a1', 'AND', 320, 0],
    ['a2', 'AND', 320, 80],
    ['a3', 'AND', 320, 160],
    ['a4', 'AND', 320, 260],
    ['a5', 'AND', 320, 340],
    ['a6', 'AND', 320, 420],
    ['a7', 'AND', 320, 520],
    ['a8', 'AND', 320, 600],
    ['a9', 'AND', 320, 680],
    ['a10', 'AND', 320, 760],
    ['S1', 'OR', 500, 60, { inputs: 3 }],
    ['R1', 'OR', 500, 320, { inputs: 3 }],
    ['S2', 'OR', 500, 540],
    ['R2', 'OR', 500, 700],
    ['z', 'OR', 860, 0, { inputs: 3 }],
    ['y1', 'SR_FF', 680, 160, { props: { init: 0 } }],
    ['y2', 'SR_FF', 680, 600, { props: { init: 0 } }],
    ['Z', 'OUTPUT', 1020, 10],
  ],
  [
    'XL>nL.in0',
    'XR>nR.in0',
    // XL'XR'
    'nL>a1.in0',
    'nR>a1.in1',
    // y2XL', y2XR'
    'y2.Q>a2.in0',
    'nL>a2.in1',
    'y2.Q>a3.in0',
    'nR>a3.in1',
    // XLXR, y2'XR, y2'XL
    'XL>a4.in0',
    'XR>a4.in1',
    "y2.Q'>a5.in0",
    'XR>a5.in1',
    "y2.Q'>a6.in0",
    'XL>a6.in1',
    // y2'XR', y2'XL'
    "y2.Q'>a7.in0",
    'nR>a7.in1',
    "y2.Q'>a8.in0",
    'nL>a8.in1',
    // y2XR, y2XL
    'y2.Q>a9.in0',
    'XR>a9.in1',
    'y2.Q>a10.in0',
    'XL>a10.in1',
    'a1>S1.in0',
    'a2>S1.in1',
    'a3>S1.in2',
    'a4>R1.in0',
    'a5>R1.in1',
    'a6>R1.in2',
    'a7>S2.in0',
    'a8>S2.in1',
    'a9>R2.in0',
    'a10>R2.in1',
    'S1>y1.S',
    'R1>y1.R',
    'S2>y2.S',
    'R2>y2.R',
    'CLK>y1.CLK',
    'CLK>y2.CLK',
    'a7>z.in0',
    'a8>z.in1',
    'a1>z.in2',
    'z>Z.in',
  ],
);
