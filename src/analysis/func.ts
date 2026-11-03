/**
 * The Boolean function an output computes, and its structure (work plan,
 * component D: the analysis module).
 *
 * Variables are the switches. Their order follows the course: A, B, C, D with
 * A as the MSB, and for numbered names (X0, X1, X2) the highest index is the
 * MSB, as in "X2X1X0" (WK5). Minterm m has variable k (0 = MSB) equal to bit
 * (n - 1 - k) of m.
 */
import { settle } from '../engine/settle';
import type { Logic } from '../engine/logic';
import { CATALOG } from '../model';
import type { Circuit, Component } from '../model';

/** Above this many switches the truth table (2^n rows) is not built. */
export const MAX_VARS = 6;

/** A product (or sum) term: the variables it fixes, by index, to 0 or 1. */
export type Cube = Map<number, 0 | 1>;

const natural = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });

/** The switches in MSB-first order. */
export function variablesOf(circuit: Circuit): Component[] {
  const inputs = circuit.components.filter((c) => c.type === 'INPUT');
  const sorted = [...inputs].sort((a, b) => natural(a.id, b.id));
  // X0, X1, X2: the highest number is the MSB
  const numbered = sorted.length > 1 && sorted.every((c) => /\d+$/.test(c.id));
  return numbered ? sorted.reverse() : sorted;
}

/** Why a circuit cannot be analysed, or null. */
export function unsupportedReason(circuit: Circuit): string | null {
  if (
    circuit.components.some((c) => CATALOG[c.type].category === 'sequential' || c.type === 'CLOCK')
  ) {
    return 'הניתוח מיועד למעגלים צירופיים. במעגל יש שעון, latch או flip-flop.';
  }
  const n = variablesOf(circuit).length;
  if (n === 0) return 'אין במעגל מתגים, ולכן אין כניסות לנתח.';
  if (n > MAX_VARS) return `יש ${n} מתגים. הניתוח תומך בעד ${MAX_VARS} כניסות.`;
  return null;
}

/** The circuit with the switches set to minterm m. */
export function withInputs(circuit: Circuit, vars: readonly Component[], m: number): Circuit {
  const n = vars.length;
  const value = new Map(vars.map((v, k) => [v.id, ((m >> (n - 1 - k)) & 1) as 0 | 1]));
  return {
    ...circuit,
    components: circuit.components.map((c) =>
      value.has(c.id)
        ? { ...c, props: { ...c.props, value: value.get(c.id)!, schedule: undefined } }
        : c,
    ),
  };
}

/** The value of `net` for every minterm. */
export function truthTable(circuit: Circuit, net: string): Logic[] {
  const vars = variablesOf(circuit);
  return Array.from(
    { length: 1 << vars.length },
    (_, m) => settle(withInputs(circuit, vars, m)).nets.get(net) ?? 'X',
  );
}

export const cubeCovers = (cube: Cube, m: number, n: number) =>
  [...cube].every(([k, v]) => ((m >> (n - 1 - k)) & 1) === v);

// ---------------------------------------------------------------- structure

export interface TwoLevel {
  /** 'sop': an OR of AND terms (a sum of products); 'pos': an AND of OR terms. */
  form: 'sop' | 'pos';
  /** The terms, each with the gate that makes it (undefined for a lone literal). */
  terms: { cube: Cube; gate?: string }[];
  /** The gate that combines the terms. */
  root: string;
}

/**
 * Recognise a two-level circuit behind `net`: OR of ANDs (or of literals),
 * or AND of ORs. A literal is a switch or a NOT of a switch. Returns null
 * for anything else (for example f = AB ⊕ CD), where only the simulation
 * applies.
 */
export function twoLevel(circuit: Circuit, net: string): TwoLevel | null {
  const vars = variablesOf(circuit);
  const byId = new Map(circuit.components.map((c) => [c.id, c]));
  const driverOf = new Map(
    circuit.wires.map((w) => [
      `${w.to.component}:${w.to.port}`,
      `${w.from.component}:${w.from.port}`,
    ]),
  );
  const inputs = (c: Component) =>
    Array.from({ length: c.inputs }, (_, i) => driverOf.get(`${c.id}:in${i}`));

  /** A net that is a literal: [variable index, polarity]. */
  const literal = (n: string | undefined): [number, 0 | 1] | null => {
    if (!n) return null;
    const c = byId.get(n.split(':')[0]);
    if (!c) return null;
    if (c.type === 'INPUT') return [vars.indexOf(c), 1];
    if (c.type === 'NOT' || c.type === 'BUF') {
      const inner = literal(inputs(c)[0]);
      return inner && c.type === 'NOT' ? [inner[0], inner[1] === 1 ? 0 : 1] : inner;
    }
    return null;
  };

  /** A term: a literal, or a gate of `type` whose inputs are all literals. */
  const term = (
    n: string | undefined,
    type: 'AND' | 'OR',
  ): { cube: Cube; gate?: string } | null => {
    const lit = literal(n);
    if (lit) return { cube: new Map([lit]) };
    const c = n ? byId.get(n.split(':')[0]) : undefined;
    if (!c || c.type !== type) return null;
    const cube: Cube = new Map();
    for (const i of inputs(c)) {
      const l = literal(i);
      if (!l) return null;
      // x·x' (or x + x'): a constant term, not a two-level form worth analysing
      if (cube.has(l[0]) && cube.get(l[0]) !== l[1]) return null;
      cube.set(l[0], l[1]);
    }
    return { cube, gate: c.id };
  };

  const root = byId.get(net.split(':')[0]);
  if (!root) return null;
  for (const [form, outer, inner] of [
    ['sop', 'OR', 'AND'],
    ['pos', 'AND', 'OR'],
  ] as const) {
    if (root.type !== outer) continue;
    const terms = inputs(root).map((i) => term(i, inner));
    if (terms.every((t) => t !== null))
      return { form, terms: terms as TwoLevel['terms'], root: root.id };
  }
  // a single product term feeding the output directly is trivially hazard-free
  return null;
}
