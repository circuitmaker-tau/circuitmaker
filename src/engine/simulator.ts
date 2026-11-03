/**
 * Event-driven simulator with a propagation delay (Tp) per component.
 *
 * Semantics follow the course and COMPONENT_SPEC §1, and match reference_sim.py
 * tick for tick:
 * - E1  time is an integer number of ticks, 10 ticks per unit (Tp = 1.5 -> 15).
 * - E2  every change at an input re-evaluates the component, and each new
 *       output is scheduled Tp later. Nothing is cancelled, so even a pulse
 *       shorter than Tp reaches the output, as in the course's timing diagrams
 *       and the official exam solutions. (In simulation jargon: a transport
 *       delay.) A rise uses tpLH and a fall uses tpHL when they are set.
 * - E3  all events at the same tick are applied together, then the affected
 *       components are evaluated. More than 1000 rounds at one tick (a
 *       zero-delay loop) stops the run and is reported as an oscillation.
 * - E4  flip-flops, registers and counters change on a rising clock edge
 *       (0 -> 1) and sample their inputs as they were just before the edge
 *       (exam 2026B, 2D: "the sampling is always just before the clk change").
 *       A clock going 0 -> X or X -> 1 is not a defined edge, so Q becomes X.
 * - E6  a clock starts at its start level and toggles every half period.
 *
 * The circuit starts from its steady state (settle.ts), so a simulation shows
 * only what happens after a switch is flipped or the clock ticks.
 */
import type { Circuit } from '../model';
import { counterReset, edgeStep, latchStep, stateOutputs } from './behavior';
import type { Logic } from './logic';
import { buildNetlist, delayFor } from './netlist';
import type { Clock, Device } from './netlist';
import { combinational, settle } from './settle';

const MAX_ROUNDS_PER_TICK = 1000;

export interface Transition {
  time: number; // ticks
  value: Logic;
}

export interface SimWarning {
  time: number; // ticks
  component: string;
  message: string;
}

interface SimEvent {
  time: number;
  seq: number;
  net: string;
  value: Logic;
  /** The next toggle of this clock is scheduled when this one is applied. */
  clock?: Clock;
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
  /** Things the student should know about: a forbidden SR input, a latch race. */
  warnings: SimWarning[] = [];

  private values = new Map<string, Logic>();
  private traces = new Map<string, Transition[]>();
  private fanout: Map<string, Device[]>;
  private queue = new EventQueue();
  private seq = 0;
  /** Pending events that are not clock toggles. */
  private pending = 0;

  constructor(circuit: Circuit) {
    const netlist = buildNetlist(circuit);
    this.fanout = netlist.fanout;
    const start = settle(circuit);
    for (const [net, v] of start.nets) {
      this.values.set(net, v);
      this.traces.set(net, [{ time: 0, value: v }]);
    }
    for (const d of netlist.devices) {
      d.state = start.states.get(d.id) ?? d.state;
      if (d.kind === 'latch') d.last = d.inputs.map((n) => this.value(n));
    }
    for (const c of netlist.clocks) this.push(c.half, c.net, c.start === 1 ? 0 : 1, c);
  }

  /** Value of a net now (X if it does not exist). */
  value(net: string): Logic {
    return net ? (this.values.get(net) ?? 'X') : 'X';
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
    this.push(Math.max(at, this.now), net, value);
  }

  /** Time of the next pending event, or undefined when nothing is scheduled. */
  nextEventTime(): number | undefined {
    return this.queue.peek()?.time;
  }

  /** Nothing will ever happen again (no events, or the run stopped on an oscillation). */
  get idle(): boolean {
    return this.queue.size === 0 || this.oscillation !== null;
  }

  /** Nothing is on its way except clock ticks: every change so far has arrived. */
  get quiet(): boolean {
    return this.pending === 0 || this.oscillation !== null;
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

  /** Run until only clock ticks are left (or nothing at all), or a safety limit is hit. */
  runToEnd(limit = this.now + 1_000_000) {
    while (!this.quiet) {
      const t = this.nextEventTime()!;
      if (t > limit) break;
      this.runUntil(t);
    }
  }

  private push(time: number, net: string, value: Logic, clock?: Clock) {
    if (!clock) this.pending++;
    this.queue.push({ time, seq: this.seq++, net, value, clock });
  }

  private emit(d: Device, t: number, values: Logic[]) {
    values.forEach((v, i) => this.push(t + delayFor(d, v), d.outputs[i], v));
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
        if (e.clock) this.push(t + e.clock.half, e.net, e.value === 1 ? 0 : 1, e.clock);
        else this.pending--;
        if (!prior.has(e.net)) prior.set(e.net, this.value(e.net));
        this.values.set(e.net, e.value);
      }
      const changed = [...prior].filter(([net, old]) => this.value(net) !== old).map(([n]) => n);
      for (const net of changed) {
        const list = this.traces.get(net) ?? [];
        list.push({ time: t, value: this.value(net) });
        this.traces.set(net, list);
      }

      // re-evaluate each affected component once
      const before = (net: string): Logic => (prior.has(net) ? prior.get(net)! : this.value(net));
      const changedSet = new Set(changed);
      const touched = new Set<Device>();
      for (const net of changed) for (const d of this.fanout.get(net) ?? []) touched.add(d);
      for (const d of touched) this.evaluate(d, t, before, changedSet);
    }
  }

  private evaluate(d: Device, t: number, before: (net: string) => Logic, changed: Set<string>) {
    const ins = d.inputs.map((n) => this.value(n));
    if (d.kind === 'gate' || d.kind === 'block') {
      this.emit(d, t, combinational(d, ins));
      return;
    }
    if (d.kind === 'latch') {
      const r = latchStep(d.type, ins, d.last, d.state[0]);
      d.state = [r.state];
      d.last = ins;
      if (r.warning) this.warnings.push({ time: t, component: d.id, message: r.warning });
      this.emit(d, t, r.outputs);
      return;
    }

    // edge triggered: only a change of CLK (or of an asynchronous RESET) matters
    let next: Logic[] | null = null;
    const clk = d.inputs[d.clock];
    if (clk && changed.has(clk)) {
      const from = before(clk);
      const to = this.value(clk);
      if (from === 0 && to === 1) {
        if (d.reset < 0 || before(d.inputs[d.reset]) === 0) {
          const r = edgeStep(d.type, d.inputs.map(before), d.state);
          if (r.warning) this.warnings.push({ time: t, component: d.id, message: r.warning });
          next = r.state;
        }
      } else if ((from === 0 && to === 'X') || (from === 'X' && to === 1)) {
        next = d.state.map(() => 'X' as const);
      }
    }
    if (d.reset >= 0) next = counterReset(ins[d.reset], next ?? d.state) ?? next;
    if (next) {
      d.state = next;
      this.emit(d, t, stateOutputs(d.type, next));
    }
  }
}
