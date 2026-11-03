/**
 * What every component other than a plain gate computes (COMPONENT_SPEC §2.3,
 * §2.4, rules E4 and E7).
 *
 * Each behaviour is written for definite bits only. Unknown inputs are handled
 * once, in `expand`: every X is tried as 0 and as 1, and an output keeps a
 * definite value only when all the tries agree. This gives exactly the X rules
 * of E7, for example a MUX whose select is X still outputs 1 when both data
 * inputs are 1, and a decoder with En = X can only put X on the outputs that
 * could be 1.
 */
import type { ComponentType } from '../model';
import type { Logic } from './logic';

type Bit = 0 | 1;

/** More unknowns than this and we give up and output X everywhere. */
const MAX_EXPANDED = 12;

/**
 * Evaluate `f` over every way of replacing the X values in `values` with 0 or
 * 1, and merge the results position by position.
 */
export function expand(
  values: readonly Logic[],
  width: number,
  f: (bits: Bit[]) => Logic[],
): Logic[] {
  const unknown = values.flatMap((v, i) => (v === 'X' ? [i] : []));
  if (unknown.length > MAX_EXPANDED) return Array<Logic>(width).fill('X');
  const bits = values.map((v) => (v === 'X' ? 0 : v));
  let merged: Logic[] | null = null;
  for (let m = 0; m < 1 << unknown.length; m++) {
    unknown.forEach((pos, k) => (bits[pos] = ((m >> k) & 1) as Bit));
    const out = f(bits);
    merged = merged ? merged.map((v, i) => (v === out[i] ? v : 'X')) : out;
  }
  return merged!;
}

const index = (bits: readonly Bit[]) => bits.reduce<number>((n, b, i) => n | (b << i), 0);
const bit = (n: number, i: number) => ((n >> i) & 1) as Bit;

// ---------------------------------------------------------------- combinational

/** Input ports follow catalog.ts: data first, then selects or En; index 0 is the LSB. */
const COMBINATIONAL: Partial<Record<ComponentType, (x: Bit[]) => Logic[]>> = {
  HALF_ADDER: ([a, b]) => [(a ^ b) as Bit, (a & b) as Bit],
  FULL_ADDER: ([a, b, c]) => [(a ^ b ^ c) as Bit, a + b + c >= 2 ? 1 : 0],
  MUX2: (x) => [x[index(x.slice(2))]],
  MUX4: (x) => [x[index(x.slice(4))]],
  MUX8: (x) => [x[index(x.slice(8))]],
  DEC2x4: (x) => decode(x.slice(0, 2), x[2]),
  DEC3x8: (x) => decode(x.slice(0, 3), x[3]),
  ENC4x2: (x) => {
    const [d, en] = [x.slice(0, 4), x[4]];
    if (en === 0) return [0, 0];
    const ones = d.flatMap((v, i) => (v === 1 ? [i] : []));
    // a plain encoder expects exactly one 1 (exam 2026A, 2C)
    if (ones.length !== 1) return ['X', 'X'];
    return [bit(ones[0], 1), bit(ones[0], 0)];
  },
  PRIORITY_ENC4x2: (x) => {
    const [d, en] = [x.slice(0, 4), x[4]];
    const top = d.lastIndexOf(1);
    if (en === 0 || top < 0) return [0, 0, 0];
    return [bit(top, 1), bit(top, 0), 1];
  },
};

function decode(select: Bit[], en: Bit): Logic[] {
  const n = index(select);
  return Array.from({ length: 1 << select.length }, (_, i) => (en === 1 && i === n ? 1 : 0));
}

export const isCombinationalBlock = (type: ComponentType) => type in COMBINATIONAL;

/** Outputs of a combinational block, in the order of its output ports. */
export function evalBlock(type: ComponentType, inputs: readonly Logic[], width: number): Logic[] {
  return expand(inputs, width, COMBINATIONAL[type]!);
}

// ---------------------------------------------------------------- latches

export const LATCHES: readonly ComponentType[] = ['SR_LATCH', 'D_LATCH'];

export interface LatchResult {
  state: Logic;
  outputs: Logic[]; // Q, Q'
  warning?: string;
}

/**
 * A latch reacts to its inputs at once (after its Tp), with no clock.
 * SR latch (NOR based): S = R = 1 gives Q = Q' = 0, and leaving that state
 * with both inputs falling together is a race, so Q becomes X (exam 2026C, 2C).
 */
export function latchStep(
  type: ComponentType,
  inputs: readonly Logic[],
  previous: readonly Logic[] | undefined,
  state: Logic,
): LatchResult {
  if (type === 'SR_LATCH') {
    const race = previous?.[0] === 1 && previous[1] === 1 && inputs[0] === 0 && inputs[1] === 0;
    const [next, q, qn] = expand([...inputs, state], 3, ([s, r, y]) => {
      if (s === 1 && r === 1) return ['X', 0, 0]; // after 11 nothing is held
      const n: Bit = s === 1 ? 1 : r === 1 ? 0 : y;
      return [n, n, (1 - n) as Bit];
    });
    return race
      ? { state: 'X', outputs: ['X', 'X'], warning: 'S ו-R ירדו יחד מ-1 ל-0: מרוץ, Q לא ידוע' }
      : { state: next, outputs: [q, qn] };
  }
  // D latch: transparent while En = 1, holds while En = 0
  const [next] = expand([...inputs, state], 1, ([d, en, y]) => [en === 1 ? d : y]);
  return { state: next, outputs: [next, next === 'X' ? 'X' : next === 1 ? 0 : 1] };
}

// ---------------------------------------------------------------- edge triggered

export const EDGE_TRIGGERED: readonly ComponentType[] = [
  'D_FF',
  'T_FF',
  'JK_FF',
  'SR_FF',
  'REGISTER4',
  'COUNTER4',
];

export interface EdgeResult {
  state: Logic[];
  warning?: string;
}

/**
 * Next state on a rising clock edge. `inputs` are the values just before the
 * edge (rule E4), in port order; the CLK entry is ignored. Formulas from the
 * exam formula sheet: D: D, T: T ⊕ y, JK: J·y' + K'·y, SR: S + R'·y.
 */
export function edgeStep(
  type: ComponentType,
  inputs: readonly Logic[],
  state: Logic[],
): EdgeResult {
  switch (type) {
    case 'D_FF':
      return { state: [inputs[0]] };
    case 'T_FF':
      return { state: expand([inputs[0], state[0]], 1, ([t, y]) => [(t ^ y) as Bit]) };
    case 'JK_FF':
      return {
        state: expand([inputs[0], inputs[1], state[0]], 1, ([j, k, y]) => [
          ((j & (1 - y)) | ((1 - k) & y)) as Bit,
        ]),
      };
    case 'SR_FF': {
      if (inputs[0] === 1 && inputs[1] === 1) {
        return { state: ['X'], warning: 'מצב אסור: S = R = 1 בעליית השעון' };
      }
      return {
        state: expand([inputs[0], inputs[1], state[0]], 1, ([s, r, y]) => [
          s === 1 && r === 1 ? 'X' : ((s | ((1 - r) & y)) as Bit),
        ]),
      };
    }
    case 'REGISTER4':
      return { state: inputs.slice(0, 4) };
    case 'COUNTER4':
      return {
        state: expand(state, 4, (q) => {
          const n = (index(q) + 1) % 16;
          return [0, 1, 2, 3].map((i) => bit(n, i));
        }),
      };
    default:
      throw new Error(`${type} is not edge triggered`);
  }
}

/** Output values for a given state, in the order of the output ports. */
export function stateOutputs(type: ComponentType, state: readonly Logic[]): Logic[] {
  if (type === 'REGISTER4' || type === 'COUNTER4') return [...state];
  const q = state[0];
  return [q, q === 'X' ? 'X' : q === 1 ? 0 : 1];
}

export function stateWidth(type: ComponentType): number {
  return type === 'REGISTER4' || type === 'COUNTER4' ? 4 : 1;
}

/**
 * COUNTER4 RESET is asynchronous and active high: while it is 1 the counter
 * is held at 0 and ignores the clock (WK8A: "nullifying inputs will always be
 * async"). With RESET = X, any bit that is not already 0 becomes X.
 */
export function counterReset(reset: Logic, state: Logic[]): Logic[] | null {
  if (reset === 1) return [0, 0, 0, 0];
  if (reset === 'X') return state.map((v) => (v === 0 ? 0 : 'X'));
  return null;
}
