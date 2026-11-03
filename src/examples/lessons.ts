/**
 * Small teaching circuits from the course, one idea each: hazards from the
 * lectures and homework, and the timing questions of the 2026 exams.
 * Expected waveforms are those of TEST_CIRCUITS.md.
 */
import { buildCircuit } from './build';

/** WK5 + the fix: the consensus term I0·I1 covers the jump between the two AND terms. */
export const mux2Fixed = buildCircuit(
  'MUX 2:1 עם מונח קונצנזוס (בלי ריצוד)',
  'ns',
  [
    ['S0', 'INPUT', 0, 0, { props: { value: 1 } }],
    ['I1', 'INPUT', 0, 120, { props: { value: 1 } }],
    ['I0', 'INPUT', 0, 240, { props: { value: 1 } }],
    ['n1', 'NOT', 140, 0],
    ['a1', 'AND', 280, 80],
    ['a2', 'AND', 280, 200],
    ['a3', 'AND', 280, 320],
    ['o1', 'OR', 440, 180, { inputs: 3 }],
    ['F', 'OUTPUT', 600, 190],
  ],
  [
    'S0>n1.in0',
    'S0>a1.in0',
    'I1>a1.in1',
    'n1>a2.in0',
    'I0>a2.in1',
    'I0>a3.in0',
    'I1>a3.in1',
    'a1>o1.in0',
    'a2>o1.in1',
    'a3>o1.in2',
    'o1>F.in',
  ],
);

/** Homework 5, Q4: X = A' + B, Y = B' + C, Z = X·Y, every delay 10; B rises at t = 30. */
export const staticZero = buildCircuit(
  'static-0 hazard (תרגיל בית 5, שאלה 4)',
  'ns',
  [
    ['A', 'INPUT', 0, 0, { props: { value: 1 } }],
    ['B', 'INPUT', 0, 120, { props: { value: 0, schedule: [{ time: 30, value: 1 }] } }],
    ['C', 'INPUT', 0, 240, { props: { value: 0 } }],
    ['nA', 'NOT', 140, 0, { delay: 10 }],
    ['nB', 'NOT', 140, 180, { delay: 10 }],
    ['X', 'OR', 300, 40, { delay: 10 }],
    ['Y', 'OR', 300, 200, { delay: 10 }],
    ['Z', 'AND', 460, 120, { delay: 10 }],
    ['F', 'OUTPUT', 620, 130],
  ],
  [
    'A>nA.in0',
    'B>nB.in0',
    'nA>X.in0',
    'B>X.in1',
    'nB>Y.in0',
    'C>Y.in1',
    'X>Z.in0',
    'Y>Z.in1',
    'Z>F.in',
  ],
);

/** Recitation 5: f = AB ⊕ CD, AND with tpLH = 10 and tpHL = 20, XOR 5; ABCD 1100 → 1011 at t = 60. */
export const asymmetric = buildCircuit(
  'השהיית עלייה וירידה שונות (תרגול 5)',
  'ns',
  [
    ['A', 'INPUT', 0, 0, { props: { value: 1 } }],
    ['B', 'INPUT', 0, 70, { props: { value: 1, schedule: [{ time: 60, value: 0 }] } }],
    ['C', 'INPUT', 0, 170, { props: { value: 0, schedule: [{ time: 60, value: 1 }] } }],
    ['D', 'INPUT', 0, 240, { props: { value: 0, schedule: [{ time: 60, value: 1 }] } }],
    ['I1', 'AND', 160, 30, { delay: 10, props: { tpLH: 10, tpHL: 20 } }],
    ['I2', 'AND', 160, 200, { delay: 10, props: { tpLH: 10, tpHL: 20 } }],
    ['f', 'XOR', 320, 110, { delay: 5 }],
    ['F', 'OUTPUT', 480, 120],
  ],
  ['A>I1.in0', 'B>I1.in1', 'C>I2.in0', 'D>I2.in1', 'I1>f.in0', 'I2>f.in1', 'f>F.in'],
);

/** WK7: an SR latch built from two cross-coupled NOR gates. */
export const norLatch = buildCircuit(
  'SR latch משני שערי NOR',
  'ns',
  [
    ['R', 'INPUT', 0, 0],
    ['S', 'INPUT', 0, 160],
    ['q', 'NOR', 180, 10],
    ['qb', 'NOR', 180, 150],
    ['Q', 'OUTPUT', 380, 20],
    ["Q'", 'OUTPUT', 380, 160],
  ],
  ['R>q.in0', 'qb>q.in1', 'S>qb.in1', 'q>qb.in0', 'q>Q.in', "qb>Q'.in"],
);

/** Exam 2026A, 2D (TC-T1): T-FF with T = 1, Q1 = NOT(Q0), Q2 = AND(Q1, Q0'); gates Tp = 0.5. */
export const tffPulses = buildCircuit(
  'T-FF, מהפך ו-AND עם Tp = 0.5 (2026 מועד א, 2D)',
  's',
  [
    ['one', 'CONST1', 0, 0],
    ['CLK', 'CLOCK', 0, 100],
    ['ff', 'T_FF', 140, 30, { delay: 0, props: { init: 0 } }],
    ['Q1', 'NOT', 340, 20, { delay: 0.5 }],
    ['Q2', 'AND', 500, 50, { delay: 0.5 }],
    ['L', 'OUTPUT', 660, 60],
  ],
  ['one>ff.T', 'CLK>ff.CLK', 'ff.Q>Q1.in0', 'Q1>Q2.in0', "ff.Q'>Q2.in1", 'Q2>L.in'],
);

/** Exam 2026C, 2D (TC-T3): D = NOT(NOT(Q')), Q1 = NOT(Q); inverters Tp = 1, FF Tp = 0; Q starts at 1. */
export const dffFeedback = buildCircuit(
  'D-FF עם משוב דרך מהפכים (2026 מועד ג, 2D)',
  's',
  [
    ['CLK', 'CLOCK', 0, 90],
    ['ff', 'D_FF', 160, 60, { delay: 0, props: { init: 1 } }],
    ['m', 'NOT', 360, 150, { delay: 1 }],
    ['D', 'NOT', 200, 220, { delay: 1 }],
    ['Q1', 'NOT', 360, 30, { delay: 1 }],
    ['L', 'OUTPUT', 520, 40],
  ],
  ["ff.Q'>m.in0", 'm>D.in0', 'D>ff.D', 'CLK>ff.CLK', 'ff.Q>Q1.in0', 'Q1>L.in'],
);
