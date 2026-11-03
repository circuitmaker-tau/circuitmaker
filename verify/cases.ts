/**
 * Circuits compared with Icarus Verilog: every example of the app (with
 * planned switch changes, so something happens), the exam variants of
 * TEST_CIRCUITS, and random circuits with random delays and inputs.
 */
import { EXAMPLES } from '../src/examples';
import { createComponent, createWire } from '../src/model';
import type { Circuit, ComponentType, Stimulus } from '../src/model';

export interface Case {
  name: string;
  circuit: Circuit;
  /** Ticks to simulate. */
  until: number;
}

const example = (id: string) => structuredClone(EXAMPLES.find((x) => x.id === id)!.circuit);

function edit(c: Circuit, changes: Record<string, { delay?: number; schedule?: Stimulus[] }>) {
  for (const [id, ch] of Object.entries(changes)) {
    const comp = c.components.find((x) => x.id === id)!;
    if (ch.delay !== undefined) comp.delay = ch.delay;
    if (ch.schedule) comp.props = { ...comp.props, schedule: ch.schedule };
  }
  return c;
}

const at = (...pairs: [number, 0 | 1][]): Stimulus[] =>
  pairs.map(([time, value]) => ({ time, value }));
const allDelays = (c: Circuit, delay: number) => {
  for (const comp of c.components)
    if (comp.type !== 'INPUT' && comp.type !== 'CLOCK') comp.delay = delay;
  return c;
};

export const COURSE_CASES: Case[] = [
  {
    name: 'TC-H1 MUX glitch',
    circuit: edit(example('mux2'), { S0: { schedule: at([5, 0], [9, 1]) } }),
    until: 200,
  },
  {
    name: 'TC-H1, change at t = 0',
    circuit: edit(example('mux2'), { S0: { schedule: at([0, 0]) } }),
    until: 100,
  },
  {
    name: 'TC-H1 fixed',
    circuit: edit(example('mux2fix'), { S0: { schedule: at([5, 0], [9, 1]) } }),
    until: 200,
  },
  { name: 'TC-H2 static-0', circuit: example('static0'), until: 1000 },
  { name: 'TC-H3 tpLH/tpHL', circuit: example('asym'), until: 1200 },
  {
    name: 'ripple-carry',
    circuit: edit(example('ripple'), {
      A0: { schedule: at([5, 0], [20, 1]) },
      B3: { schedule: at([12, 0]) },
    }),
    until: 400,
  },
  {
    name: 'NOR latch set/reset',
    circuit: edit(example('latch'), {
      S: { schedule: at([2, 1], [4, 0]) },
      R: { schedule: at([8, 1], [10, 0]) },
    }),
    until: 200,
  },
  {
    name: 'NOR latch race',
    circuit: edit(example('latch'), {
      S: { schedule: at([2, 1], [6, 0]) },
      R: { schedule: at([2, 1], [6, 0]) },
    }),
    until: 300,
  },
  {
    name: 'counter + reset',
    circuit: edit(example('counter'), { RESET: { schedule: at([9.5, 1], [14, 0]) } }),
    until: 400,
  },
  { name: 'TC-T1 (1)', circuit: example('tff'), until: 130 },
  { name: 'TC-T1 (2)', circuit: edit(example('tff'), { ff: { delay: 0.5 } }), until: 130 },
  { name: 'TC-T2 (1)', circuit: allDelays(example('jk'), 0), until: 130 },
  { name: 'TC-T2 (2)', circuit: example('jk'), until: 130 },
  { name: 'TC-T2 (3)', circuit: allDelays(example('jk'), 1), until: 130 },
  { name: 'TC-T3 (1)', circuit: allDelays(example('dff'), 0), until: 170 },
  { name: 'TC-T3 (2)', circuit: example('dff'), until: 170 },
  { name: 'TC-T3 (3)', circuit: allDelays(example('dff'), 1), until: 170 },
  { name: 'TC-S1 down counter', circuit: example('down'), until: 340 },
  { name: 'WK9B Bamba FSM (T-FF)', circuit: example('bamba'), until: 1700 },
  { name: 'WK9A 0101 detector (JK + D)', circuit: example('detector'), until: 1700 },
];

// ---------------------------------------------------------------- random circuits

/** Small deterministic PRNG (mulberry32), so a failing case can be reproduced. */
function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const GATES: ComponentType[] = ['AND', 'OR', 'NOT', 'BUF', 'NAND', 'NOR', 'XOR', 'XNOR'];
const DELAYS = [0, 0.5, 1, 1, 1.5, 2, 3];

/** A random circuit: switches with random changes, a DAG of gates, and optionally clocked FFs. */
export function randomCase(seed: number, sequential: boolean): Case {
  const r = rng(seed);
  const pick = <T>(xs: readonly T[]) => xs[Math.floor(r() * xs.length)];
  const c: Circuit = {
    version: 1,
    name: `random ${seed}`,
    timeUnit: 'ns',
    components: [],
    wires: [],
  };
  const nets: [string, string][] = [];
  const wire = (from: [string, string], to: [string, string]) =>
    c.wires.push(createWire(`w${c.wires.length}`, from, to));

  for (let k = 0; k < 4; k++) {
    const times = [
      ...new Set(Array.from({ length: 2 + Math.floor(r() * 5) }, () => Math.round(r() * 300) / 10)),
    ]
      .filter((t) => t > 0)
      .sort((a, b) => a - b);
    let v: 0 | 1 = r() < 0.5 ? 0 : 1;
    const start = v;
    const schedule = times.map((time) => ({ time, value: (v = v === 1 ? 0 : 1) }));
    c.components.push(
      createComponent('INPUT', `x${k}`, undefined, { props: { value: start, schedule } }),
    );
    nets.push([`x${k}`, 'out']);
  }

  const ffs: string[] = [];
  if (sequential) {
    c.components.push(
      createComponent('CLOCK', 'clk', undefined, {
        props: { halfPeriod: pick([1, 1.5, 2]), startLevel: 0 },
      }),
    );
    for (let k = 0; k < 3; k++) {
      const type = pick(['D_FF', 'T_FF', 'JK_FF'] as const);
      const id = `f${k}`;
      c.components.push(
        createComponent(type, id, undefined, {
          delay: pick(DELAYS),
          props: { init: r() < 0.5 ? 0 : 1 },
        }),
      );
      ffs.push(id);
      nets.push([id, 'Q'], [id, "Q'"]);
    }
  }

  const count = 8 + Math.floor(r() * 12);
  for (let k = 0; k < count; k++) {
    const type = pick(GATES);
    const id = `g${k}`;
    const inputs =
      type === 'NOT' || type === 'BUF' ? 1 : type === 'XNOR' ? 2 : 2 + Math.floor(r() * 3);
    const delay = pick(DELAYS);
    const props = r() < 0.25 ? { tpLH: pick(DELAYS), tpHL: pick(DELAYS) } : undefined;
    c.components.push(createComponent(type, id, undefined, { delay, inputs, props }));
    for (let p = 0; p < inputs; p++) wire(pick(nets), [id, `in${p}`]);
    nets.push([id, 'out']);
  }

  // flip-flop inputs may come from anywhere: the loop goes through the clock edge
  for (const id of ffs) {
    const type = c.components.find((x) => x.id === id)!.type;
    wire(['clk', 'out'], [id, 'CLK']);
    for (const port of type === 'JK_FF' ? ['J', 'K'] : type === 'T_FF' ? ['T'] : ['D'])
      wire(pick(nets), [id, port]);
  }
  return { name: c.name, circuit: c, until: 400 };
}

export const RANDOM_CASES: Case[] = [
  ...Array.from({ length: 200 }, (_, i) => randomCase(1000 + i, false)),
  ...Array.from({ length: 200 }, (_, i) => randomCase(5000 + i, true)),
];
