/**
 * Playback state. Holds the running Simulator and moves simulated time forward
 * in step with real time while playing.
 *
 * Flipping a switch schedules the change at the current simulated time and
 * starts playing, so the change is seen travelling through the circuit one Tp
 * at a time (decision 03.11: slow by default, with faster speeds, pause,
 * single step and "skip to the end").
 */
import { create } from 'zustand';
import { Simulator } from '../engine/simulator';
import type { Circuit } from '../model';
import type { Logic } from '../engine/logic';
import { delayToTicks } from '../model/time';
import { useCircuitStore } from './circuitStore';
import { loadPrefs, savePrefs } from './prefs';
import type { Speed } from './speeds';

/** Real milliseconds for one typical gate delay at speed ×1. */
export const MS_PER_TYPICAL_TP = 600;

export { SPEEDS } from './speeds';
export type { Speed } from './speeds';

const GATE_TYPES = ['AND', 'OR', 'NOT', 'BUF', 'NAND', 'NOR', 'XOR', 'XNOR'];

/** Median non-zero gate delay in ticks, so playback speed feels the same for Tp = 1 and Tp = 10. */
export function typicalTpTicks(circuit: Circuit): number {
  const ds = circuit.components
    .filter((c) => GATE_TYPES.includes(c.type) && c.delay > 0)
    .map((c) => delayToTicks(c.delay))
    .sort((a, b) => a - b);
  return ds.length === 0 ? 10 : ds[Math.floor(ds.length / 2)];
}

/**
 * Everything that changes how the circuit behaves, except switch values and
 * positions. When it changes the simulation starts over from the steady state.
 */
export function structureSignature(circuit: Circuit): string {
  return JSON.stringify({
    c: circuit.components.map((c) => {
      const { value, ...rest } = c.props ?? {};
      void value;
      return [c.id, c.type, c.delay, c.inputs, rest];
    }),
    w: circuit.wires.map((w) => [w.from.component, w.from.port, w.to.component, w.to.port]),
    // what is inside the student's own blocks
    b: circuit.blocks ?? [],
  });
}

export interface Front {
  progress: number;
  value: Logic;
}

/** Where every in-flight change is, as a share of its component's delay. */
export function frontsOf(sim: Simulator): Map<string, Front[]> {
  const fronts = new Map<string, Front[]>();
  for (const [net, list] of sim.inFlight()) {
    fronts.set(
      net,
      list.map((f) => ({
        progress: Math.min(1, Math.max(0, (sim.now - f.from) / (f.at - f.from))),
        value: f.value,
      })),
    );
  }
  return fronts;
}

export interface SimState {
  sim: Simulator | null;
  /** Bumped after every change to the simulator, so components re-render. */
  version: number;
  /**
   * For each wire's net, the new values travelling through the driving
   * component's delay, with how far along they are (0 to 1). Rebuilt on every
   * change, so a wire re-renders only while something is on its way.
   */
  fronts: Map<string, Front[]>;
  playing: boolean;
  speed: Speed;
  /** Ticks per real millisecond at the current speed. */
  rate: number;
  /** Fraction of a tick carried over between animation frames. */
  carry: number;
  /** Warnings already shown to the user. */
  warned: number;
  /** Ticks in one period of the first clock, or 0 when the circuit has no clock. */
  period: number;

  reset: (circuit: Circuit) => void;
  /** A change to make right after the next reset, then play (the analysis demo). */
  prepareDemo: (change: { net: string; value: 0 | 1; at: number }) => void;
  flip: (inputId: string) => void;
  advance: (realMs: number) => void;
  play: () => void;
  pause: () => void;
  step: () => void;
  skipToEnd: () => void;
  /** Run exactly one clock period. */
  cycle: () => void;
  setSpeed: (speed: Speed) => void;
}

/** Ticks in one period of the first clock (two half periods), 0 without a clock. */
export function clockPeriodTicks(circuit: Circuit): number {
  const clk = circuit.components.find((c) => c.type === 'CLOCK');
  return clk ? 2 * Math.max(1, delayToTicks(clk.props?.halfPeriod ?? 1)) : 0;
}

const rateFor = (circuit: Circuit, speed: Speed) =>
  (typicalTpTicks(circuit) * speed) / MS_PER_TYPICAL_TP;

let pendingDemo: { net: string; value: 0 | 1; at: number } | null = null;

export const useSimStore = create<SimState>()((set, get) => {
  const initialSpeed = loadPrefs().speed;
  const bump = () =>
    set((s) => ({ version: s.version + 1, fronts: s.sim ? frontsOf(s.sim) : new Map() }));
  /** Tell the user about an oscillation or a new warning (forbidden SR input, latch race). */
  const report = (sim: Simulator) => {
    const { showMessage } = useCircuitStore.getState();
    if (sim.oscillation) {
      showMessage(
        `המעגל לא מתייצב בזמן t = ${sim.oscillation.time / 10}: יש לולאה שבה כל ה-Tp הם 0`,
      );
      return;
    }
    const { warned } = get();
    if (sim.warnings.length > warned) {
      const w = sim.warnings[sim.warnings.length - 1];
      showMessage(`t = ${w.time / 10}, ${w.component}: ${w.message}`);
      set({ warned: sim.warnings.length });
    }
  };

  return {
    sim: null,
    version: 0,
    fronts: new Map(),
    playing: false,
    // remembered from the last visit
    speed: initialSpeed,
    rate: (10 * initialSpeed) / MS_PER_TYPICAL_TP,
    carry: 0,
    warned: 0,
    period: 0,

    prepareDemo: (change) => {
      pendingDemo = change;
    },

    reset: (circuit) =>
      set((s) => {
        const sim = new Simulator(circuit);
        const demo = pendingDemo;
        pendingDemo = null;
        if (demo) sim.setNet(demo.net, demo.value, demo.at);
        return {
          sim,
          playing: demo !== null,
          carry: 0,
          warned: 0,
          period: clockPeriodTicks(circuit),
          rate: rateFor(circuit, s.speed),
          version: s.version + 1,
          fronts: new Map(),
        };
      }),

    flip: (inputId) => {
      const circuit = useCircuitStore.getState();
      const comp = circuit.circuit.components.find((c) => c.id === inputId);
      if (!comp || comp.type !== 'INPUT') return;
      const { sim } = get();
      // flip what the switch shows now, which a planned change may have moved
      const current = sim ? sim.value(`${inputId}:out`) : (comp.props?.value ?? 0);
      const next = current === 1 ? 0 : 1;
      circuit.updateComponent(inputId, { props: { value: next } }); // the saved circuit keeps it
      if (!sim) return;
      sim.setNet(`${inputId}:out`, next);
      set({ playing: true, carry: 0 });
      bump();
    },

    advance: (realMs) => {
      const { sim, playing, rate, carry } = get();
      if (!sim || !playing) return;
      // a frame is usually a fraction of a tick, so keep the remainder for the next one
      const total = carry + realMs * rate;
      const ticks = Math.floor(total);
      set({ carry: total - ticks });
      if (ticks === 0) return;
      sim.runUntil(sim.now + ticks);
      report(sim);
      if (sim.idle) {
        set({ playing: false, carry: 0 });
      }
      bump();
    },

    play: () => {
      const { sim } = get();
      if (sim && !sim.idle) set({ playing: true });
    },

    pause: () => set({ playing: false }),

    step: () => {
      const { sim } = get();
      if (!sim) return;
      set({ playing: false });
      sim.step();
      report(sim);
      bump();
    },

    skipToEnd: () => {
      const { sim } = get();
      if (!sim) return;
      set({ playing: false });
      sim.runToEnd();
      report(sim);
      bump();
    },

    cycle: () => {
      const { sim, period } = get();
      if (!sim || period === 0) return;
      set({ playing: false });
      sim.runUntil(sim.now + period);
      report(sim);
      bump();
    },

    setSpeed: (speed) => {
      savePrefs({ speed });
      set(() => ({ speed, rate: rateFor(useCircuitStore.getState().circuit, speed) }));
    },
  };
});
