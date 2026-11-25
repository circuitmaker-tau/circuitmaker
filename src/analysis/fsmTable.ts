/**
 * The state table of a synchronous machine built from flip-flops (WK9:
 * analysis): for every present state and every input, the next state and the
 * output, in the course's layout (PS rows; NS and z columns for each x).
 *
 * Every row is worked out by the engine itself: the flip-flops are set to the
 * present state and the switches to the input, the gates settle (settle.ts),
 * and the next state is what each flip-flop would take on the clock edge
 * (edgeStep), so the table is always the one of the circuit as drawn.
 */
import { netKey, settle } from '../engine/settle';
import { edgeStep } from '../engine/behavior';
import type { Logic } from '../engine/logic';
import { inputsOfComponent } from '../model';
import type { Circuit, Component, ComponentType } from '../model';
import { tr } from '../i18n/lang';

const FLIP_FLOPS: ReadonlySet<ComponentType> = new Set(['D_FF', 'T_FF', 'JK_FF', 'SR_FF']);
const natural = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });

export const MAX_FSM_FLIP_FLOPS = 3;
export const MAX_FSM_INPUTS = 2;

export interface FsmTable {
  /** Flip-flops, in the order of the state bits (y1 y2 …, MSB first). */
  flipFlops: string[];
  /** Switches, in the order of the input bits (MSB first). */
  inputs: string[];
  /** Lamps. */
  outputs: string[];
  /** next[state][input]: the next state, one value per flip-flop. */
  next: Logic[][][];
  /** out[state][input]: one value per lamp. */
  out: Logic[][][];
  /** True when some output depends on the input as well (Mealy); else Moore. */
  mealy: boolean;
}

/** Why the circuit has no state table here, or null when it has one. */
export function fsmProblem(circuit: Circuit): string | null {
  const types = circuit.components.map((c) => c.type);
  const ffs = circuit.components.filter((c) => FLIP_FLOPS.has(c.type));
  if (ffs.length === 0) return tr('במעגל אין flip-flop, ולכן אין לו מצבים.', 'The circuit has no flip-flop, so it has no states.');
  if (ffs.length > MAX_FSM_FLIP_FLOPS) return tr(`יש ${ffs.length} flip-flops. כאן אפשר עד ${MAX_FSM_FLIP_FLOPS}.`, `There are ${ffs.length} flip-flops. Up to ${MAX_FSM_FLIP_FLOPS} here.`);
  const other = types.find(
    (t) => t === 'BLOCK' || t === 'SR_LATCH' || t === 'D_LATCH' || t === 'REGISTER4' || t === 'COUNTER4',
  );
  if (other) return tr('טבלת מצבים נבנית כאן רק ממעגל של D, T, JK או SR flip-flops ושערים.', 'A state table is built here only from D, T, JK or SR flip-flops and gates.');
  const inputs = circuit.components.filter((c) => c.type === 'INPUT');
  if (inputs.length > MAX_FSM_INPUTS) return tr(`יש ${inputs.length} מתגים. כאן אפשר עד ${MAX_FSM_INPUTS} כניסות.`, `There are ${inputs.length} switches. Up to ${MAX_FSM_INPUTS} inputs here.`);
  if (!circuit.components.some((c) => c.type === 'OUTPUT')) return tr('במעגל אין נורה (יציאה).', 'The circuit has no lamp (output).');
  return null;
}

const bitsOf = (value: number, width: number): (0 | 1)[] =>
  Array.from({ length: width }, (_, i) => ((value >> (width - 1 - i)) & 1) as 0 | 1);

/** "01" */
export const code = (value: number, width: number) => bitsOf(value, width).join('');

export function fsmTable(circuit: Circuit): FsmTable {
  const sorted = (type: (c: Component) => boolean) =>
    circuit.components.filter(type).sort((a, b) => natural(a.id, b.id));
  const ffs = sorted((c) => FLIP_FLOPS.has(c.type));
  const switches = sorted((c) => c.type === 'INPUT');
  const lamps = sorted((c) => c.type === 'OUTPUT');
  const k = ffs.length;
  const m = switches.length;

  const next: Logic[][][] = [];
  const out: Logic[][][] = [];
  for (let s = 0; s < 1 << k; s++) {
    next.push([]);
    out.push([]);
    const state = bitsOf(s, k);
    for (let x = 0; x < 1 << m; x++) {
      const input = bitsOf(x, m);
      const fixed: Circuit = {
        ...circuit,
        components: circuit.components.map((c) => {
          const f = ffs.indexOf(c);
          if (f >= 0) return { ...c, props: { ...c.props, init: state[f] } };
          const i = switches.indexOf(c);
          if (i >= 0) {
            const { schedule, ...rest } = c.props ?? {};
            void schedule;
            return { ...c, props: { ...rest, value: input[i] } };
          }
          return c;
        }),
      };
      const settled = settle(fixed);
      const read = (c: Component, port: string): Logic => settled.inputs.get(netKey(c.id, port)) ?? 'X';
      next[s].push(
        ffs.map((c, f) => {
          const ins = inputsOfComponent(c).map((p) => read(c, p));
          return edgeStep(c.type, ins, [state[f]]).state[0];
        }),
      );
      out[s].push(lamps.map((c) => read(c, 'in')));
    }
  }
  const mealy = out.some((row) => row.some((o) => o.join() !== row[0].join()));
  return { flipFlops: ffs.map((c) => c.id), inputs: switches.map((c) => c.id), outputs: lamps.map((c) => c.id), next, out, mealy };
}

/** A transition of the state diagram: from a state, on an input, to a state, with the output. */
export interface Transition {
  from: number;
  input: number;
  to: number;
  /** Output bits written as in the course, e.g. "1" (one lamp) or "10". */
  output: string;
}

/** Every transition of the machine (one per present state and input). */
export function transitionsOf(t: FsmTable): Transition[] {
  const k = t.flipFlops.length;
  return t.next.flatMap((row, from) =>
    row.map((ns, input) => ({
      from,
      input,
      to: ns.every((v) => v !== 'X') ? parseInt(ns.join(''), 2) : -1,
      output: t.out[from][input].join(''),
    })),
  ).filter((tr) => tr.to >= 0 && tr.to < 1 << k);
}

export interface DiagramFeedback {
  /** (from, input) pairs with no arrow. */
  missing: { from: number; input: number }[];
  /** Arrows that go to the wrong state or give the wrong output. */
  wrong: { index: number; to: number; output: string }[];
  /** Arrows for a (from, input) that already has one. */
  duplicate: number[];
  done: boolean;
}

/** Compare the arrows the student drew with the machine's transitions. */
export function checkDiagram(t: FsmTable, drawn: readonly Transition[]): DiagramFeedback {
  const expected = transitionsOf(t);
  const seen = new Set<string>();
  const duplicate: number[] = [];
  const wrong: DiagramFeedback['wrong'] = [];
  drawn.forEach((d, index) => {
    const key = `${d.from}:${d.input}`;
    if (seen.has(key)) {
      duplicate.push(index);
      return;
    }
    seen.add(key);
    const e = expected.find((x) => x.from === d.from && x.input === d.input);
    if (e && (e.to !== d.to || e.output !== d.output)) wrong.push({ index, to: e.to, output: e.output });
  });
  const missing = expected
    .filter((e) => !seen.has(`${e.from}:${e.input}`))
    .map(({ from, input }) => ({ from, input }));
  return { missing, wrong, duplicate, done: missing.length === 0 && wrong.length === 0 && duplicate.length === 0 };
}
