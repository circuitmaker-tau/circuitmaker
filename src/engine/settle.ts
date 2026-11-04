/**
 * Steady state (rule E5): the value every net settles to before time starts,
 * with no timing. The simulator starts from here.
 *
 * Switches, constants and clocks have their starting values, and flip-flops,
 * registers and counters hold their `init` value. Every other net starts at X
 * and gates, blocks and latches are evaluated again and again until nothing
 * changes. Three-valued logic is monotone (an X can only become 0 or 1), so
 * this always ends; whatever is still X is genuinely unknown: an unconnected
 * input, a latch that was never set, or a loop with no stable state such as a
 * ring of inverters.
 */
import { inputsOfComponent } from '../model';
import type { Circuit } from '../model';
import { counterReset, evalBlock, flipFlopAsync, latchStep, stateOutputs } from './behavior';
import { evalGate } from './logic';
import type { GateType, Logic } from './logic';
import { buildNetlist, netKey } from './netlist';
import type { Device } from './netlist';

export { netKey } from './netlist';

export interface SettledValues {
  /** Value of each driven net, keyed by `component:port` of its driver. */
  nets: Map<string, Logic>;
  /** Value seen at each input port, keyed by `component:port`. */
  inputs: Map<string, Logic>;
  /** Stored bits of every latch, flip-flop, register and counter. */
  states: Map<string, Logic[]>;
}

/** Outputs of a gate or a combinational block for the given input values. */
export function combinational(d: Device, ins: Logic[]): Logic[] {
  return d.kind === 'gate'
    ? [evalGate(d.type as GateType, ins)]
    : evalBlock(d.type, ins, d.outputs.length);
}

/** The state a flip-flop's CLR' and PRE' force right now, or null. */
function asyncState(d: Device, read: (net: string) => Logic): Logic[] | null {
  if (d.clr < 0 && d.pre < 0) return null;
  const r = flipFlopAsync(
    d.clr >= 0 ? read(d.inputs[d.clr]) : 1,
    d.pre >= 0 ? read(d.inputs[d.pre]) : 1,
    d.state,
  );
  return r?.state ?? null;
}

export function settle(circuit: Circuit): SettledValues {
  const { devices, sources } = buildNetlist(circuit);
  const nets = new Map<string, Logic>(sources);
  const read = (net: string): Logic => (net ? (nets.get(net) ?? 'X') : 'X');

  for (const d of devices) {
    if (d.kind === 'edge') {
      if (d.reset >= 0) d.state = counterReset(read(d.inputs[d.reset]), d.state) ?? d.state;
      d.state = asyncState(d, read) ?? d.state;
      stateOutputs(d.type, d.state).forEach((v, i) => nets.set(d.outputs[i], v));
    } else if (d.kind === 'latch') {
      stateOutputs(d.type, d.state).forEach((v, i) => nets.set(d.outputs[i], v));
    } else {
      for (const o of d.outputs) nets.set(o, 'X');
    }
  }

  // each pass can only turn some X into 0 or 1, so this many passes always suffice
  const limit = 2 * devices.length + 2;
  for (let pass = 0; pass < limit; pass++) {
    let changed = false;
    const set = (net: string, v: Logic) => {
      if (nets.get(net) !== v) {
        nets.set(net, v);
        changed = true;
      }
    };
    for (const d of devices) {
      const ins = d.inputs.map(read);
      if (d.kind === 'gate' || d.kind === 'block') {
        combinational(d, ins).forEach((v, i) => set(d.outputs[i], v));
      } else if (d.kind === 'latch') {
        const r = latchStep(d.type, ins, undefined, d.state[0]);
        d.state = [r.state];
        r.outputs.forEach((v, i) => set(d.outputs[i], v));
      } else if (d.reset >= 0) {
        const r = counterReset(ins[d.reset], d.state);
        if (r) {
          d.state = r;
          stateOutputs(d.type, r).forEach((v, i) => set(d.outputs[i], v));
        }
      } else if (d.clr >= 0 || d.pre >= 0) {
        const r = asyncState(d, read);
        if (r) {
          d.state = r;
          stateOutputs(d.type, r).forEach((v, i) => set(d.outputs[i], v));
        }
      }
    }
    if (!changed) break;
  }

  const inputs = new Map<string, Logic>();
  const driverOf = new Map<string, string>();
  for (const w of circuit.wires) {
    driverOf.set(netKey(w.to.component, w.to.port), netKey(w.from.component, w.from.port));
  }
  for (const c of circuit.components) {
    for (const p of inputsOfComponent(c)) {
      const key = netKey(c.id, p);
      inputs.set(key, read(driverOf.get(key) ?? ''));
    }
  }
  const states = new Map(
    devices.filter((d) => d.state.length > 0).map((d): [string, Logic[]] => [d.id, [...d.state]]),
  );
  return { nets, inputs, states };
}
