/**
 * Static hazards, found two ways (work plan, component D):
 *
 * 1. Analytically, for two-level circuits (WK5): in a sum of products, two
 *    neighbouring minterms of the ON set (they differ in one variable) that no
 *    single product covers give a static-1 hazard when that variable changes:
 *    one product turns off before the other turns on. The fix is the
 *    consensus term of the two products, which covers both. A product of sums
 *    is the dual: neighbouring OFF minterms, static-0, a consensus sum.
 *
 * 2. By simulation, for any combinational circuit and with its real delays:
 *    every change of one input, for every value of the others, is run from
 *    the steady state. A static hazard is a change on an output that should
 *    not move; a dynamic hazard is more than one change on an output that
 *    should move once.
 */
import { findGlitches } from '../engine/glitches';
import type { Logic } from '../engine/logic';
import { netKey } from '../engine/netlist';
import { Simulator } from '../engine/simulator';
import { delayToTicks } from '../model/time';
import type { Circuit } from '../model';
import { cubeCovers, truthTable, twoLevel, variablesOf, withInputs } from './func';
import type { Cube, TwoLevel } from './func';

export interface AnalyticHazard {
  kind: 'static-1' | 'static-0';
  /** Index of the variable whose change exposes the hazard. */
  variable: number;
  /** The two neighbouring minterms. */
  minterms: [number, number];
  /** Indexes (in TwoLevel.terms) of the term covering each minterm. */
  terms: [number, number];
  /** The consensus term that covers both (a product for SOP, a sum for POS). */
  consensus: Cube;
}

export interface AnalyticResult {
  structure: TwoLevel;
  hazards: AnalyticHazard[];
}

/**
 * For a sum term (OR of literals), the cube of minterms where it is 0:
 * x + y' is 0 exactly when x = 0 and y = 1.
 */
const zeros = (sum: Cube): Cube => new Map([...sum].map(([k, v]) => [k, v === 1 ? 0 : 1]));

export function analyse(circuit: Circuit, net: string): AnalyticResult | null {
  const structure = twoLevel(circuit, net);
  if (!structure) return null;
  const n = variablesOf(circuit).length;
  const sop = structure.form === 'sop';
  // the cubes of the set we care about: ON set for SOP, OFF set for POS
  const cubes = structure.terms.map((t) => (sop ? t.cube : zeros(t.cube)));
  const inSet = (m: number) => cubes.some((c) => cubeCovers(c, m, n));

  const hazards: AnalyticHazard[] = [];
  for (let m = 0; m < 1 << n; m++) {
    if (!inSet(m)) continue;
    for (let k = 0; k < n; k++) {
      const bit = 1 << (n - 1 - k);
      const m2 = m ^ bit;
      if (m2 < m || !inSet(m2)) continue; // each pair once, and both in the set
      if (cubes.some((c) => cubeCovers(c, m, n) && cubeCovers(c, m2, n))) continue;
      const a = cubes.findIndex((c) => cubeCovers(c, m, n));
      const b = cubes.findIndex((c) => cubeCovers(c, m2, n));
      // consensus of the two cubes on variable k: everything they fix, except k
      const both = new Map([...cubes[a], ...cubes[b]]);
      both.delete(k);
      hazards.push({
        kind: sop ? 'static-1' : 'static-0',
        variable: k,
        minterms: [m, m2],
        terms: [a, b],
        consensus: sop ? both : zeros(both), // back to a sum term for POS
      });
    }
  }
  return { structure, hazards };
}

// ---------------------------------------------------------------- simulation

export interface SimulatedHazard {
  kind: 'static-1' | 'static-0' | 'dynamic';
  variable: number;
  /** Minterm before the change. */
  from: number;
  to: number;
  /** The output's transitions after the change, in ticks from the change. */
  transitions: { time: number; value: Logic }[];
  /** Pulses that are glitches, with their width. */
  glitches: { start: number; end: number }[];
}

/** Every single-input change from the steady state, with the circuit's real delays. */
export function scanTransitions(circuit: Circuit, net: string): SimulatedHazard[] {
  const vars = variablesOf(circuit);
  const n = vars.length;
  const table = truthTable(circuit, net);
  const found: SimulatedHazard[] = [];
  for (let m = 0; m < 1 << n; m++) {
    for (let k = 0; k < n; k++) {
      const m2 = m ^ (1 << (n - 1 - k));
      const sim = new Simulator(withInputs(circuit, vars, m));
      const bit = ((m2 >> (n - 1 - k)) & 1) as 0 | 1;
      sim.setNet(netKey(vars[k].id, 'out'), bit, 0);
      sim.runToEnd(100_000);
      const trace = sim.trace(net);
      const transitions = trace.slice(1).map((t) => ({ time: t.time, value: t.value }));
      const moves = table[m] !== table[m2];
      if (transitions.length <= (moves ? 1 : 0)) continue;
      found.push({
        kind: moves ? 'dynamic' : table[m] === 1 ? 'static-1' : 'static-0',
        variable: k,
        from: m,
        to: m2,
        transitions,
        glitches: findGlitches(trace).map((g) => ({ start: g.start, end: g.end })),
      });
    }
  }
  return found;
}

// ---------------------------------------------------------------- paths

export interface Path {
  /** Components along the path, from the input's first gate to the output's driver. */
  through: string[];
  /** Sum of the Tp along the path, in ticks. */
  delay: number;
  /** Number of inverting gates on the path. */
  inversions: number;
}

const INVERTING = new Set(['NOT', 'NAND', 'NOR', 'XNOR']);

/**
 * Every path from a switch to the component driving `net`. Two paths that
 * meet again with different delays and opposite inversion are what make a
 * static hazard: the change arrives at the meeting gate twice, at two times.
 */
export function pathsFrom(circuit: Circuit, switchId: string, net: string, limit = 64): Path[] {
  const target = net.split(':')[0];
  const byId = new Map(circuit.components.map((c) => [c.id, c]));
  const fanout = new Map<string, string[]>();
  for (const w of circuit.wires) {
    const list = fanout.get(w.from.component) ?? [];
    if (!list.includes(w.to.component)) list.push(w.to.component);
    fanout.set(w.from.component, list);
  }
  const paths: Path[] = [];
  const walk = (id: string, through: string[], delay: number, inversions: number) => {
    if (paths.length >= limit) return;
    const c = byId.get(id)!;
    const here = [...through, id];
    const d = delay + delayToTicks(c.delay);
    const inv = inversions + (INVERTING.has(c.type) ? 1 : 0);
    if (id === target) {
      paths.push({ through: here, delay: d, inversions: inv });
      return;
    }
    for (const next of fanout.get(id) ?? []) {
      if (!here.includes(next) && byId.get(next)?.type !== 'OUTPUT') walk(next, here, d, inv);
    }
  };
  for (const first of fanout.get(switchId) ?? []) {
    if (byId.get(first)?.type !== 'OUTPUT') walk(first, [], 0, 0);
  }
  return paths.sort((a, b) => a.delay - b.delay);
}
