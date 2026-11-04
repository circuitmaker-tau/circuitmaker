/**
 * Event-driven simulator with a propagation delay (Tp) per component.
 *
 * Semantics follow the course and COMPONENT_SPEC §1, and match reference_sim.py
 * tick for tick:
 * - E1  time is an integer number of ticks, 10 ticks per unit (Tp = 1.5 -> 15).
 * - E2  every change at an input re-evaluates the component, and each new
 *       output is scheduled Tp later. A pulse shorter than Tp still reaches the
 *       output, as in the course's timing diagrams and the official exam
 *       solutions. (In simulation jargon: a transport delay.) A rise uses tpLH
 *       and a fall uses tpHL when they are set. With different rise and fall
 *       delays a newer value can be due before an older one; then, as in the
 *       standard transport rule (VHDL), the newer one cancels every pending
 *       value of that output due at the same time or later. Otherwise the older
 *       value would land last and the output would disagree with its inputs.
 *       With equal delays nothing is ever cancelled. (Found by the comparison
 *       with Icarus Verilog, verify/.)
 * - E3  all events at the same tick are applied together, then the affected
 *       components are evaluated. More than 1000 rounds at one tick (a
 *       zero-delay loop) stops the run and is reported as an oscillation.
 * - E4  flip-flops, registers and counters change on a rising clock edge
 *       (0 -> 1) and sample their inputs as they were just before the edge
 *       (exam 2026B, 2D: "the sampling is always just before the clk change").
 *       A clock going 0 -> X or X -> 1 is not a defined edge, so Q becomes X.
 * - E6  a clock starts at its start level and toggles every half period.
 * - E8  a net that keeps changing with no outside change (a switch, a clock
 *       edge) more than OSCILLATION_LIMIT times is reported as oscillating.
 *       The run goes on, since a ring oscillator is a legitimate circuit.
 *
 * The circuit starts from its steady state (settle.ts), so a simulation shows
 * only what happens after a switch is flipped or the clock ticks.
 */
import type { Circuit } from '../model';
import { counterReset, edgeStep, flipFlopAsync, latchStep, stateOutputs } from './behavior';
import type { Logic } from './logic';
import { delayToTicks } from '../model/time';
import { buildNetlist, delayFor, netKey } from './netlist';
import type { Clock, Device } from './netlist';
import { combinational, settle } from './settle';

const MAX_ROUNDS_PER_TICK = 1000;
/** E8: changes of one net between two outside changes before it counts as oscillating. */
export const OSCILLATION_LIMIT = 50;

export interface Transition {
  time: number; // ticks
  value: Logic;
  /**
   * Tick of the outside change (switch or clock) that led to this transition,
   * -1 for the starting value. Two transitions with the same cause make a
   * glitch (glitches.ts).
   */
  cause: number;
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
  /** A change from outside the circuit: a switch flip or a scheduled stimulus. */
  external?: boolean;
  /** Tick of the outside change this event follows from. */
  cause: number;
  /** Tick at which a component scheduled it (its Tp started), for the wire animation. */
  born?: number;
  /** Cancelled by a newer value of the same output that is due no later (E2). */
  cancelled?: boolean;
}

/** A new value on its way through a component's delay (shown travelling along the wire). */
export interface InFlight {
  /** Tick at which the delay started. */
  from: number;
  /** Tick at which the value arrives. */
  at: number;
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

  /** Every pending event, in no particular order. */
  all(): readonly SimEvent[] {
    return this.heap;
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
  /** Things the student should know about: a forbidden SR input, a latch race, oscillation. */
  warnings: SimWarning[] = [];
  /**
   * Ticks at which something outside the circuit changed (a switch or a clock).
   * A glitch is a pulse between two of these (see glitches.ts).
   */
  external: number[] = [];
  /** Nets reported as oscillating (E8). */
  oscillating = new Set<string>();

  private values = new Map<string, Logic>();
  private traces = new Map<string, Transition[]>();
  private fanout: Map<string, Device[]>;
  private queue = new EventQueue();
  private seq = 0;
  /** Pending events that are not clock toggles. */
  private pending = 0;
  private lastPushed: SimEvent | undefined;
  /** Pending values each component output has scheduled, for the cancelling rule of E2. */
  private scheduled = new Map<string, SimEvent[]>();
  /** Cause of the latest change of each net. */
  private causeOf = new Map<string, number>();
  /** Changes of each net since the last outside change (E8). */
  private changesSinceExternal = new Map<string, number>();

  constructor(circuit: Circuit) {
    const netlist = buildNetlist(circuit);
    this.fanout = netlist.fanout;
    const start = settle(circuit);
    for (const [net, v] of start.nets) {
      this.values.set(net, v);
      this.traces.set(net, [{ time: 0, value: v, cause: -1 }]);
    }
    for (const d of netlist.devices) {
      d.state = start.states.get(d.id) ?? d.state;
      if (d.kind === 'latch') d.last = d.inputs.map((n) => this.value(n));
    }
    for (const c of netlist.clocks) {
      this.push(c.half, c.net, c.start === 1 ? 0 : 1, { clock: c, cause: c.half });
    }
    // planned switch changes (stimuli), as in "S0 goes to 0 at t = 5"
    for (const comp of circuit.components) {
      if (comp.type !== 'INPUT') continue;
      for (const st of comp.props?.schedule ?? []) {
        const at = delayToTicks(st.time);
        this.push(at, netKey(comp.id, 'out'), st.value, { external: true, cause: at });
      }
    }
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
    const t = Math.max(at, this.now);
    this.push(t, net, value, { external: true, cause: t });
  }

  /**
   * Values travelling through a delay right now, per net, earliest first. Only
   * real changes are listed: an event that would not change the net (given the
   * ones before it) is left out.
   */
  inFlight(): Map<string, InFlight[]> {
    const byNet = new Map<string, SimEvent[]>();
    for (const e of this.queue.all()) {
      if (e.born === undefined || e.cancelled || e.time <= e.born) continue;
      const list = byNet.get(e.net) ?? [];
      list.push(e);
      byNet.set(e.net, list);
    }
    const result = new Map<string, InFlight[]>();
    for (const [net, events] of byNet) {
      events.sort((a, b) => a.time - b.time || a.seq - b.seq);
      let v = this.value(net);
      const changes: InFlight[] = [];
      for (const e of events) {
        if (e.value === v) continue;
        v = e.value;
        changes.push({ from: e.born!, at: e.time, value: e.value });
      }
      if (changes.length > 0) result.set(net, changes);
    }
    return result;
  }

  /** Time of the next pending event, or undefined when nothing is scheduled. */
  nextEventTime(): number | undefined {
    return this.top()?.time;
  }

  /** Nothing will ever happen again (no events, or the run stopped on an oscillation). */
  get idle(): boolean {
    return this.top() === undefined || this.oscillation !== null;
  }

  /** Nothing is on its way except clock ticks: every change so far has arrived. */
  get quiet(): boolean {
    return this.pending === 0 || this.oscillation !== null;
  }

  /** Process every event up to and including `until`, then move the clock there. */
  runUntil(until: number) {
    while (!this.oscillation) {
      const next = this.top();
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

  /** The earliest live event; cancelled ones are dropped on the way. */
  private top(): SimEvent | undefined {
    while (this.queue.peek()?.cancelled) this.queue.pop();
    return this.queue.peek();
  }

  private push(
    time: number,
    net: string,
    value: Logic,
    opts: { cause: number; clock?: Clock; external?: boolean; born?: number },
  ) {
    if (!opts.clock) this.pending++;
    this.lastPushed = { time, seq: this.seq++, net, value, ...opts };
    this.queue.push(this.lastPushed);
  }

  private emit(d: Device, t: number, values: Logic[], cause: number) {
    values.forEach((v, i) => {
      const net = d.outputs[i];
      const at = t + delayFor(d, v);
      const list = this.scheduled.get(net) ?? [];
      // E2: a newer value cancels older ones that are due at the same time or later
      const keep = list.filter((e) => {
        if (e.time < at) return true;
        e.cancelled = true;
        this.pending--;
        return false;
      });
      this.push(at, net, v, { cause, born: t });
      keep.push(this.lastPushed!);
      this.scheduled.set(net, keep);
    });
  }

  private processTick(t: number) {
    this.now = t;
    for (let round = 0; ; round++) {
      const top = this.top();
      if (!top || top.time !== t) return;
      if (round >= MAX_ROUNDS_PER_TICK) {
        const nets = new Set<string>();
        while (this.top()?.time === t) nets.add(this.queue.pop()!.net);
        this.oscillation = { time: t, nets: [...nets] };
        return;
      }

      // apply everything scheduled for this tick; the last one scheduled for a net wins
      const prior = new Map<string, Logic>();
      const outside = new Set<string>();
      const causeNow = new Map<string, number>();
      while (this.top()?.time === t) {
        const e = this.queue.pop()!;
        if (e.born !== undefined) {
          const list = this.scheduled.get(e.net)!;
          list.splice(list.indexOf(e), 1);
        }
        if (e.clock) {
          const next = t + e.clock.half;
          this.push(next, e.net, e.value === 1 ? 0 : 1, { clock: e.clock, cause: next });
        } else this.pending--;
        causeNow.set(e.net, e.cause);
        if (e.clock || e.external) outside.add(e.net);
        if (!prior.has(e.net)) prior.set(e.net, this.value(e.net));
        this.values.set(e.net, e.value);
      }
      const changed = [...prior].filter(([net, old]) => this.value(net) !== old).map(([n]) => n);
      if (changed.some((n) => outside.has(n))) {
        if (this.external.at(-1) !== t) this.external.push(t);
        this.changesSinceExternal.clear();
      }
      for (const net of changed) {
        const list = this.traces.get(net) ?? [];
        const cause = causeNow.get(net)!;
        this.causeOf.set(net, cause);
        list.push({ time: t, value: this.value(net), cause });
        this.traces.set(net, list);
        if (!outside.has(net)) this.countChange(net, t);
      }

      // re-evaluate each affected component once
      const before = (net: string): Logic => (prior.has(net) ? prior.get(net)! : this.value(net));
      const changedSet = new Set(changed);
      const touched = new Set<Device>();
      for (const net of changed) for (const d of this.fanout.get(net) ?? []) touched.add(d);
      for (const d of touched) this.evaluate(d, t, before, changedSet);
    }
  }

  private countChange(net: string, t: number) {
    const n = (this.changesSinceExternal.get(net) ?? 0) + 1;
    this.changesSinceExternal.set(net, n);
    if (n > OSCILLATION_LIMIT && !this.oscillating.has(net)) {
      this.oscillating.add(net);
      this.warnings.push({
        time: t,
        component: net.split(':')[0],
        message: `תנודה: ${net.replace(':', '.')} מחליף ערך שוב ושוב בלי שינוי בכניסות`,
      });
    }
  }

  private evaluate(d: Device, t: number, before: (net: string) => Logic, changed: Set<string>) {
    const ins = d.inputs.map((n) => this.value(n));
    // the newest outside change among the inputs that just changed
    const cause = Math.max(
      ...d.inputs.filter((n) => changed.has(n)).map((n) => this.causeOf.get(n)!),
    );
    if (d.kind === 'gate' || d.kind === 'block') {
      this.emit(d, t, combinational(d, ins), cause);
      return;
    }
    if (d.kind === 'latch') {
      const r = latchStep(d.type, ins, d.last, d.state[0]);
      d.state = [r.state];
      d.last = ins;
      if (r.warning) this.warnings.push({ time: t, component: d.id, message: r.warning });
      this.emit(d, t, r.outputs, cause);
      return;
    }

    // edge triggered: only a change of CLK (or of an asynchronous RESET, CLR' or PRE') matters
    let next: Logic[] | null = null;
    // a held CLR' or PRE' blocks the clock
    const free = (k: number) => k < 0 || before(d.inputs[k]) === 1;
    const clk = d.inputs[d.clock];
    if (clk && changed.has(clk)) {
      const from = before(clk);
      const to = this.value(clk);
      if (from === 0 && to === 1) {
        if ((d.reset < 0 || before(d.inputs[d.reset]) === 0) && free(d.clr) && free(d.pre)) {
          const r = edgeStep(d.type, d.inputs.map(before), d.state);
          if (r.warning) this.warnings.push({ time: t, component: d.id, message: r.warning });
          next = r.state;
        }
      } else if ((from === 0 && to === 'X') || (from === 'X' && to === 1)) {
        next = d.state.map(() => 'X' as const);
      }
    }
    if (d.reset >= 0) next = counterReset(ins[d.reset], next ?? d.state) ?? next;
    if (d.clr >= 0 || d.pre >= 0) {
      const current = next ?? d.state;
      const r = flipFlopAsync(
        d.clr >= 0 ? ins[d.clr] : 1,
        d.pre >= 0 ? ins[d.pre] : 1,
        current,
      );
      if (r) {
        if (r.warning && current[0] !== 'X') {
          this.warnings.push({ time: t, component: d.id, message: r.warning });
        }
        next = r.state;
      }
    }
    if (next) {
      d.state = next;
      this.emit(d, t, stateOutputs(d.type, next), cause);
    }
  }
}
