import type { Stimulus } from '../model/types';
import { buildCircuit } from './build';

/**
 * Finite state machines from week 9. The clock has a period of 10 (rising
 * edges at 5, 15, 25, …), every gate and flip-flop has Tp = 1, and the input X
 * changes at t = 0, 10, 20, …, half a period away from the edges, so the
 * flip-flops always see a settled input (T ≥ tp(FF) + tp(logic) + Tsetup).
 */
export const FSM_PERIOD = 10;

/** One bit of X per clock cycle, as the planned changes of the switch. */
export function perCycle(bits: (0 | 1)[]): { value: 0 | 1; schedule: Stimulus[] } {
  const schedule: Stimulus[] = [];
  bits.forEach((b, i) => {
    if (i > 0 && b !== bits[i - 1]) schedule.push({ time: i * FSM_PERIOD, value: b });
  });
  return { value: bits[0], schedule };
}

const clock = { halfPeriod: FSM_PERIOD / 2, startLevel: 0 as const };

/**
 * Bamba of 2 and 3 cycles, a gap, a Bamba of 1 cycle and one of 4: only the
 * first two are a normal size.
 */
export const BAMBA_INPUT: (0 | 1)[] = [0, 1, 1, 0, 1, 1, 1, 0, 1, 0, 1, 1, 1, 1, 0, 0];

/**
 * WK9B (design): the Bamba machine with two T flip-flops. a = 00 no Bamba,
 * b = 01 one cycle, c = 10 two cycles, d = 11 three cycles. From the lecture:
 * T1 = x'y1 + xy2, T2 = x + y2, z = x'y1 (Mealy). The AND x'·y1 is both z and
 * the first product of T1, as in the circuit drawing.
 */
export const bambaFsm = buildCircuit(
  'מכונת הבמבה עם שני T-FF (WK9B)',
  'none',
  [
    ['X', 'INPUT', 0, 40, { props: perCycle(BAMBA_INPUT) }],
    ['CLK', 'CLOCK', 0, 360, { props: clock }],
    ['nX', 'NOT', 150, 0],
    ['z', 'AND', 320, 20],
    ['a2', 'AND', 320, 140],
    ['T1', 'OR', 480, 80],
    ['T2', 'OR', 480, 240],
    ['y1', 'T_FF', 640, 70, { props: { init: 0 } }],
    ['y2', 'T_FF', 640, 250, { props: { init: 0 } }],
    ['Z', 'OUTPUT', 840, 0],
  ],
  [
    'X>nX.in0',
    'nX>z.in0',
    'y1.Q>z.in1',
    'X>a2.in0',
    'y2.Q>a2.in1',
    'z>T1.in0',
    'a2>T1.in1',
    'X>T2.in0',
    'y2.Q>T2.in1',
    'T1>y1.T',
    'T2>y2.T',
    'CLK>y1.CLK',
    'CLK>y2.CLK',
    'z>Z.in',
  ],
);

/** 0101 twice, the second time right after another bit, and some noise. */
export const DETECTOR_INPUT: (0 | 1)[] = [1, 0, 1, 0, 1, 1, 0, 0, 1, 0, 1, 1, 0];

/**
 * WK9A (analysis): a JK flip-flop (y1) and a D flip-flop (y2).
 * J = xy2, K = x + y2', D = x'y2' + y1'y2, z = xy1y2'. Analysing it gives
 * a → b → d → c and z = 1 on the next 1: the machine detects 0101.
 */
export const detector0101 = buildCircuit(
  'מזהה הרצף 0101 עם JK ו-D (WK9A)',
  'none',
  [
    ['X', 'INPUT', 0, 120, { props: perCycle(DETECTOR_INPUT) }],
    ['CLK', 'CLOCK', 0, 440, { props: clock }],
    ['nX', 'NOT', 150, 220],
    ['J', 'AND', 320, 0],
    ['K', 'OR', 320, 110],
    ['d1', 'AND', 320, 230],
    ['d2', 'AND', 320, 340],
    ['D', 'OR', 480, 280],
    ['y1', 'JK_FF', 640, 40, { props: { init: 0 } }],
    ['y2', 'D_FF', 640, 290, { props: { init: 0 } }],
    ['z', 'AND', 840, 160, { inputs: 3 }],
    ['Z', 'OUTPUT', 1000, 170],
  ],
  [
    'X>J.in0',
    'y2.Q>J.in1',
    'X>K.in0',
    "y2.Q'>K.in1",
    'X>nX.in0',
    'nX>d1.in0',
    "y2.Q'>d1.in1",
    "y1.Q'>d2.in0",
    'y2.Q>d2.in1',
    'd1>D.in0',
    'd2>D.in1',
    'J>y1.J',
    'K>y1.K',
    'D>y2.D',
    'CLK>y1.CLK',
    'CLK>y2.CLK',
    'X>z.in0',
    'y1.Q>z.in1',
    "y2.Q'>z.in2",
    'z>Z.in',
  ],
);
