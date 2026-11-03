/**
 * Steady-state evaluation (milestone 4, first step): the value every net
 * settles to once all delays have passed, with no timing. This is what the
 * lamps and wire colours show while the user flips switches. The event-driven
 * engine with per-gate Tp (rules E1–E3) builds on top of it.
 *
 * Every net starts at X and gates are re-evaluated until nothing changes.
 * Three-valued logic is monotone, so this always terminates; whatever is
 * still X at the end is genuinely unknown (an unconnected input, or a
 * feedback loop with no defined state, such as a latch that was never set).
 */
import { inputPortsOf } from '../model';
import type { Circuit, Component } from '../model';
import { evalGate } from './logic';
import type { GateType, Logic } from './logic';

const GATES: readonly string[] = ['AND', 'OR', 'NOT', 'BUF', 'NAND', 'NOR', 'XOR', 'XNOR'];

/** Key of a net: the output port that drives it. */
export const netKey = (component: string, port: string) => `${component}:${port}`;

export interface SettledValues {
  /** Value of each driven net, keyed by `component:port` of its driver. */
  nets: Map<string, Logic>;
  /** Value seen at each input port, keyed by `component:port`. */
  inputs: Map<string, Logic>;
}

export function settle(circuit: Circuit): SettledValues {
  const nets = new Map<string, Logic>();
  const driverOf = new Map<string, string>(); // input "comp:port" -> net key
  for (const w of circuit.wires) {
    driverOf.set(netKey(w.to.component, w.to.port), netKey(w.from.component, w.from.port));
  }
  const read = (c: Component, port: string): Logic => {
    const net = driverOf.get(netKey(c.id, port));
    return net === undefined ? 'X' : (nets.get(net) ?? 'X');
  };

  const sources = circuit.components.filter((c) =>
    ['INPUT', 'CONST0', 'CONST1', 'CLOCK'].includes(c.type),
  );
  for (const c of sources) {
    const v: Logic =
      c.type === 'CONST1'
        ? 1
        : c.type === 'CONST0'
          ? 0
          : c.type === 'INPUT'
            ? (c.props?.value ?? 0)
            : (c.props?.startLevel ?? 0); // a clock shows its level before the first edge
    nets.set(netKey(c.id, 'out'), v);
  }

  const gates = circuit.components.filter((c) => GATES.includes(c.type));
  for (const g of gates) nets.set(netKey(g.id, 'out'), 'X');
  // each pass can only turn an X into 0 or 1, so gates + 1 passes always suffice
  for (let pass = 0; pass <= gates.length; pass++) {
    let changed = false;
    for (const g of gates) {
      const ins = inputPortsOf(g.type, g.inputs).map((p) => read(g, p));
      const v = evalGate(g.type as GateType, ins);
      const key = netKey(g.id, 'out');
      if (nets.get(key) !== v) {
        nets.set(key, v);
        changed = true;
      }
    }
    if (!changed) break;
  }

  const inputs = new Map<string, Logic>();
  for (const c of circuit.components) {
    for (const p of inputPortsOf(c.type, c.inputs)) inputs.set(netKey(c.id, p), read(c, p));
  }
  return { nets, inputs };
}
