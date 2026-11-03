/**
 * Event-driven simulator with a propagation delay (Tp) per gate.
 *
 * Semantics follow the course and COMPONENT_SPEC §1, and match reference_sim.py
 * tick for tick:
 * - E1  time is an integer number of ticks, 10 ticks per unit (Tp = 1.5 -> 15).
 * - E2  every change at a gate input re-evaluates the gate, and the new output
 *       is scheduled Tp later. Nothing is cancelled, so even a pulse shorter than
 *       Tp reaches the output, as in the course's timing diagrams and the
 *       official exam solutions. (In simulation jargon: a transport delay.)
 *       A rise uses tpLH and a fall uses tpHL when they are set (recitation 5).
 * - E3  all events at the same tick are applied together, then the affected
 *       gates are evaluated. More than 1000 rounds at one tick (a zero-delay
 *       loop) stops the run and is reported as an oscillation.
 *
 * The circuit starts from its steady state (settle.ts), so a simulation shows
 * only what happens after a switch is flipped.
 *
 * Milestone 4 covers gates, switches, constants and lamps. Flip-flops,
 * latches, the clock and the larger blocks are added in milestone 5.
 */
import { inputPortsOf } from '../model';
import type { Circuit, Component } from '../model';
import { delayToTicks } from '../model/time';
import { evalGate } from './logic';
import type { GateType, Logic } from './logic';
import { netKey, settle } from './settle';

const GATE_TYPES: readonly string[] = ['AND', 'OR', 'NOT', 'BUF', 'NAND', 'NOR', 'XOR', 'XNOR'];
const MAX_ROUNDS_PER_TICK = 1000;

export interface Transition {
  time: number; // ticks
  value: Logic;
}

interface Gate {
  id: string;
  type: GateType;
  inputs: string[]; // net keys feeding each input, '' when unconnected
  out: string;
  rise: number; // ticks
  fall: number;
  plain: number;
}

interface SimEvent {
  time: number;
  seq: number;
  net: string;
  value: Logic;
}

/** Binary min-heap ordered by (time, seq): earliest first, then in scheduling order. */
class EventQueue {
  private heap: SimEvent[] = [];

  get size() {
    return this.heap.length;
  }

  peek(): SimEvent | undefined {
    return this.heap[0];
  }

  push(e: SimEvent) {
    const h = this.heap;
    h.push(e);
    let i = h.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!before(h[i], h[p])) break;
      [h[i], h[p]] = [h[p], h[i]];
      i = p;
    }
  }

  pop(): SimEvent | undefined {
    const h = this.heap;
    const top = h[0];
    const last = h.pop();
    if (h.length > 0 && last) {
      h[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < h.length && before(h[l], h[m])) m = l;
        if (r < h.length && before(h[r], h[m])) m = r;
        if (m === i) break;
        [h[i], h[m]] = [h[m], h[i]];
        i = m;
      }
    }
    return top;
  }
}

const before = (a: SimEvent, b: SimEvent) =>
  a.time < b.time || (a.time === b.time && a.seq < b.seq);

export class Simulator {
  /** Current simulation time in ticks. */
  now = 0;
  /** Set when a zero-delay loop kept changing at one tick; the run stops there. */
  oscillation: { time: number; nets: string[] } | null = null;

  private values = new Map<string, Logic>();
  private traces = new Map<string, Transition[]>();
  private fanout = new Map<string, Gate[]>();
  private queue = new EventQueue();
  private seq = 0;

  constructor(circuit: Circuit) {
    const driverOf = new Map<string, string>();
    for (const w of circuit.wires) {
      driverOf.set(netKey(w.to.component, w.to.port), netKey(w.from.component, w.from.port));
    }
    for (const c of circuit.components) {
      if (!GATE_TYPES.includes(c.type)) continue;
      const g = this.buildGate(c, driverOf);
      for (const n of g.inputs) {
        if (!n) continue;
        const list = this.fanout.get(n) ?? [];
        list.push(g);
        this.fanout.set(n, list);
      }
    }
    for (const [net, v] of settle(circuit).nets) {
      this.values.set(net, v);
      this.traces.set(net, [{ time: 0, value: v }]);
    }
  }

  private buildGate(c: Component, driverOf: Map<string, string>): Gate {
    const plain = delayToTicks(c.delay);
    const rise = c.props?.tpLH !== undefined ? delayToTicks(c.props.tpLH) : plain;
    const fall = c.props?.tpHL !== undefined ? delayToTicks(c.props.tpHL) : plain;
    return {
      id: c.id,
      type: c.type as GateType,
      inputs: inputPortsOf(c.type, c.inputs).map((p) => driverOf.get(netKey(c.id, p)) ?? ''),
      out: netKey(c.id, 'out'),
      rise,
      fall,
      plain,
    };
  }

  /** Value of a net now (X if it does not exist). */
  value(net: string): Logic {
    return this.values.get(net) ?? 'X';
  }

  /** Snapshot of every net's current value. */
  snapshot(): Map<string, Logic> {
    return new Map(this.values);
  }

  /** Every change of a net since t = 0, including the starting value. */
  trace(net: string): Transition[] {
    return this.traces.get(net) ?? [];
  }

  /** Flip a switch (or force any net) at a given tick, default now. */
  setNet(net: string, value: Logic, at = this.now) {
    this.schedule(Math.max(at, this.now), net, value);
  }

  /** Time of the next pending event, or undefined when the circuit is at rest. */
  nextEventTime(): number | undefined {
    return this.queue.peek()?.time;
  }

  get idle(): boolean {
    return this.queue.size === 0 || this.oscillation !== null;
  }

  /** Process every event up to and including `until`, then move the clock there. */
  runUntil(until: number) {
    while (!this.oscillation) {
      const next = this.queue.peek();
      if (!next || next.time > until) break;
      this.processTick(next.time);
    }
    if (!this.oscillation) this.now = Math.max(this.now, until);
  }

  /** Jump to the next moment something changes. Returns false when nothing is pending. */
  step(): boolean {
    const t = this.nextEventTime();
    if (t === undefined || this.oscillation) return false;
    this.runUntil(t);
    return true;
  }

  /** Run until the circuit is at rest (or a safety limit is hit). */
  runToEnd(limit = this.now + 1_000_000) {
    while (!this.idle) {
      const t = this.nextEventTime()!;
      if (t > limit) break;
      this.runUntil(t);
    }
  }

  private schedule(time: number, net: string, value: Logic) {
    this.queue.push({ time, seq: this.seq++, net, value });
  }

  private processTick(t: number) {
    this.now = t;
    for (let round = 0; ; round++) {
      const top = this.queue.peek();
      if (!top || top.time !== t) return;
      if (round >= MAX_ROUNDS_PER_TICK) {
        const nets = new Set<string>();
        while (this.queue.peek()?.time === t) nets.add(this.queue.pop()!.net);
        this.oscillation = { time: t, nets: [...nets] };
        return;
      }

      // apply everything scheduled for this tick; the last one scheduled for a net wins
      const prior = new Map<string, Logic>();
      while (this.queue.peek()?.time === t) {
        const e = this.queue.pop()!;
        if (!prior.has(e.net)) prior.set(e.net, this.value(e.net));
        this.values.set(e.net, e.value);
      }
      const changed = [...prior].filter(([net, old]) => this.value(net) !== old).map(([n]) => n);
      for (const net of changed) {
        const list = this.traces.get(net) ?? [];
        list.push({ time: t, value: this.value(net) });
        this.traces.set(net, list);
      }

      // re-evaluate each affected gate once and schedule its output Tp later
      const touched = new Set<Gate>();
      for (const net of changed) for (const g of this.fanout.get(net) ?? []) touched.add(g);
      for (const g of touched) {
        const v = evalGate(
          g.type,
          g.inputs.map((n) => (n ? this.value(n) : 'X')),
        );
        const d = v === 1 ? g.rise : v === 0 ? g.fall : g.plain;
        this.schedule(t + d, g.out, v);
      }
    }
  }
}
