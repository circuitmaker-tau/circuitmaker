/**
 * Critical path (WK5): the longest chain of delays from where a change can
 * start to where it is used. Starts are switches, clocks and the outputs of
 * flip-flops, latches, registers and counters (after their own Tp); ends are
 * lamps and the inputs of those stored components. Each component on the way
 * counts with its worst delay (the larger of tpLH and tpHL). The longest end
 * is the delay of the whole circuit, and for a synchronous circuit the
 * shortest clock period it can work with.
 */
import { CATALOG } from '../model';
import type { Circuit, Component } from '../model';
import { delayToTicks } from '../model/time';

export interface CriticalPath {
  /** Lamp id, or "ff.D" for an input of a stored component. */
  end: string;
  /** Total delay in ticks. */
  delay: number;
  /** Components on the way, from the start to the last one before the end. */
  components: string[];
  /** Wires on the way, in order. */
  wires: string[];
  /** How many components with a delay the change passes (levels, as in WK5). */
  levels: number;
}

export type CriticalResult = { ok: true; paths: CriticalPath[] } | { ok: false; reason: string };

/** The larger of the rise and fall delays: the worst case for the path. */
export function worstDelay(c: Component): number {
  const plain = delayToTicks(c.delay);
  const rise = c.props?.tpLH !== undefined ? delayToTicks(c.props.tpLH) : plain;
  const fall = c.props?.tpHL !== undefined ? delayToTicks(c.props.tpHL) : plain;
  return Math.max(rise, fall);
}

const isStart = (c: Component) => c.type === 'INPUT' || c.type === 'CLOCK' || CATALOG[c.type].stateful;
const isConst = (c: Component) => c.type === 'CONST0' || c.type === 'CONST1';

interface Arrival {
  delay: number;
  components: string[];
  wires: string[];
  levels: number;
}

export function criticalPaths(circuit: Circuit): CriticalResult {
  const byId = new Map(circuit.components.map((c) => [c.id, c]));
  const into = new Map<string, typeof circuit.wires>();
  for (const w of circuit.wires) into.set(w.to.component, [...(into.get(w.to.component) ?? []), w]);

  const memo = new Map<string, Arrival | null>();
  const visiting = new Set<string>();
  let loop: string | null = null;

  /** Latest arrival at the output of a component, or null when nothing can change it. */
  const arrival = (id: string): Arrival | null => {
    if (memo.has(id)) return memo.get(id)!;
    const c = byId.get(id)!;
    if (isConst(c)) return null;
    if (isStart(c)) {
      const own = c.type === 'INPUT' || c.type === 'CLOCK' ? 0 : worstDelay(c);
      const a = { delay: own, components: [id], wires: [], levels: own > 0 ? 1 : 0 };
      memo.set(id, a);
      return a;
    }
    if (visiting.has(id)) {
      loop ??= id;
      return null;
    }
    visiting.add(id);
    let best: Arrival | null = null;
    for (const w of into.get(id) ?? []) {
      const a = arrival(w.from.component);
      if (a && (!best || a.delay > best.delay)) best = { ...a, wires: [...a.wires, w.id] };
    }
    visiting.delete(id);
    const own = worstDelay(c);
    const result = best && {
      delay: best.delay + own,
      components: [...best.components, id],
      wires: best.wires,
      levels: best.levels + (own > 0 ? 1 : 0),
    };
    memo.set(id, result);
    return result;
  };

  const paths: CriticalPath[] = [];
  for (const c of circuit.components) {
    const ends =
      c.type === 'OUTPUT'
        ? (into.get(c.id) ?? []).map((w) => ({ w, end: c.id }))
        : CATALOG[c.type].stateful
          ? (into.get(c.id) ?? [])
              .filter((w) => w.to.port !== 'CLK')
              .map((w) => ({ w, end: `${c.id}.${w.to.port}` }))
          : [];
    for (const { w, end } of ends) {
      const a = arrival(w.from.component);
      if (!a) continue;
      paths.push({ end, delay: a.delay, components: a.components, wires: [...a.wires, w.id], levels: a.levels });
    }
  }
  const looped = loop as string | null; // set inside arrival()
  if (looped) {
    return {
      ok: false,
      reason: `יש במעגל לולאה של רכיבים בלי flip-flop (דרך ${looped}), למשל latch שבנוי משערים, ולכן אין לו נתיב קריטי מוגדר.`,
    };
  }
  if (paths.length === 0) {
    return { ok: false, reason: 'מחברים מתג לשערים ומהם לנורה, והנתיב הארוך ביותר יופיע כאן.' };
  }
  paths.sort((a, b) => b.delay - a.delay || b.levels - a.levels || a.end.localeCompare(b.end));
  return { ok: true, paths };
}
