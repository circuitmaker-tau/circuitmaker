/**
 * How well the analysis finds hazards (work plan, testing methods: "the rate
 * of correct detection and the rate of false alarms").
 *
 * The analytic method is checked against the simulation on random two-level
 * circuits (sums of products, with inverters on the inputs):
 * - a miss: the simulation shows a static hazard on a single-input change,
 *   with some delays, that the analysis did not report;
 * - a false alarm: the analysis reports a hazard that no choice of delays
 *   makes visible.
 * For each reported hazard we look for delays that expose it: random Tp per
 * gate, a fixed number of tries.
 */
import { Simulator } from '../engine/simulator';
import { netKey } from '../engine/netlist';
import { createComponent, createWire } from '../model';
import type { Circuit, ComponentType } from '../model';
import { withInputs, variablesOf } from './func';
import { analyse, scanTransitions } from './hazards';

function rng(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NAMES = ['A', 'B', 'C', 'D'];

/** A random sum of products over 3 or 4 variables, every gate Tp = 1. */
export function randomSop(seed: number): Circuit {
  const r = rng(seed);
  const n = 3 + Math.floor(r() * 2);
  const c: Circuit = { version: 1, name: `sop ${seed}`, timeUnit: 'ns', components: [], wires: [] };
  const wire = (from: string, to: string, port: string) =>
    c.wires.push(createWire(`w${c.wires.length}`, [from, 'out'], [to, port]));
  const add = (type: ComponentType, id: string, inputs?: number) =>
    c.components.push(createComponent(type, id, undefined, inputs ? { inputs } : {}));
  for (let k = 0; k < n; k++) {
    add('INPUT', NAMES[k]);
    add('NOT', `n${NAMES[k]}`);
    wire(NAMES[k], `n${NAMES[k]}`, 'in0');
  }
  const terms = 2 + Math.floor(r() * 3); // 2 to 4 products: the OR has at most 4 inputs
  add('OR', 'F', terms);
  const seen = new Set<string>();
  for (let t = 0; t < terms; t++) {
    // 2 or 3 literals on distinct variables
    let lits: [number, 0 | 1][];
    let key: string;
    do {
      const vars = [...Array(n).keys()].sort(() => r() - 0.5).slice(0, 2 + Math.floor(r() * 2));
      lits = vars.sort((a, b) => a - b).map((k) => [k, r() < 0.5 ? 0 : 1] as [number, 0 | 1]);
      key = lits.map(([k, v]) => `${k}${v}`).join();
    } while (seen.has(key));
    seen.add(key);
    add('AND', `p${t}`, lits.length);
    lits.forEach(([k, v], i) => wire(v === 1 ? NAMES[k] : `n${NAMES[k]}`, `p${t}`, `in${i}`));
    wire(`p${t}`, 'F', `in${t}`);
  }
  return c;
}

/** The circuit with a random Tp (0.5 to 4) on every gate. */
function withRandomDelays(c: Circuit, r: () => number): Circuit {
  return {
    ...c,
    components: c.components.map((x) =>
      x.type === 'INPUT' ? x : { ...x, delay: (1 + Math.floor(r() * 8)) / 2 },
    ),
  };
}

/** Does the output glitch when variable k changes from minterm m, with these delays? */
function glitches(c: Circuit, m: number, k: number): boolean {
  const vars = variablesOf(c);
  const n = vars.length;
  const sim = new Simulator(withInputs(c, vars, m));
  sim.setNet(netKey(vars[k].id, 'out'), ((m >> (n - 1 - k)) & 1) === 1 ? 0 : 1, 0);
  sim.runToEnd(100_000);
  return sim.trace('F:out').length > 1;
}

export interface Evaluation {
  circuits: number;
  /** Hazards the analysis reported (each in both directions counts once). */
  reported: number;
  /** Reported hazards that some delays exposed. */
  confirmed: number;
  /** Static hazards the simulation found (random delays) that were not reported. */
  missed: number;
  /** Reported hazards that the simulation with every Tp = 1 already shows. */
  visibleWithUnitDelays: number;
  /** Single-input changes checked by simulation. */
  transitionsChecked: number;
}

export function evaluate(count: number, tries = 40, seed = 1): Evaluation {
  const r = rng(seed);
  const e: Evaluation = {
    circuits: count,
    reported: 0,
    confirmed: 0,
    missed: 0,
    visibleWithUnitDelays: 0,
    transitionsChecked: 0,
  };
  for (let i = 0; i < count; i++) {
    const c = randomSop(seed * 1000 + i);
    const analytic = analyse(c, 'F:out')!;
    const reported = new Set(
      analytic.hazards.map((h) => `${h.variable}:${Math.min(...h.minterms)}`),
    );
    e.reported += reported.size;
    const unit = new Set(
      scanTransitions(c, 'F:out')
        .filter((h) => h.kind !== 'dynamic')
        .map((h) => `${h.variable}:${Math.min(h.from, h.to)}`),
    );
    e.visibleWithUnitDelays += [...reported].filter((k) => unit.has(k)).length;

    // confirm each reported hazard: some delays (either direction) must show it
    for (const h of analytic.hazards) {
      let found = false;
      for (let t = 0; t < tries && !found; t++) {
        const d = withRandomDelays(c, r);
        found = glitches(d, h.minterms[0], h.variable) || glitches(d, h.minterms[1], h.variable);
      }
      if (found) e.confirmed++;
    }

    // look for misses: static glitches with random delays that were not reported
    for (let t = 0; t < 5; t++) {
      const found = scanTransitions(withRandomDelays(c, r), 'F:out');
      const n = variablesOf(c).length;
      e.transitionsChecked += n << n;
      for (const h of found) {
        if (h.kind === 'dynamic') continue;
        if (!reported.has(`${h.variable}:${Math.min(h.from, h.to)}`)) e.missed++;
      }
    }
  }
  return e;
}
