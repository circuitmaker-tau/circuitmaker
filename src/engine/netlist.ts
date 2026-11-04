/**
 * The circuit as the engine sees it: every component that computes something
 * becomes a device that reads nets and drives nets. A net is named after the
 * output port that drives it (`component:port`).
 */
import { inputsOfComponent, outputPortsOf } from '../model';
import type { Circuit, Component, ComponentType } from '../model';
import { delayToTicks } from '../model/time';
import { EDGE_TRIGGERED, LATCHES, isCombinationalBlock, stateWidth } from './behavior';
import type { Logic } from './logic';

export const GATE_TYPES: readonly ComponentType[] = [
  'AND',
  'OR',
  'NOT',
  'BUF',
  'NAND',
  'NOR',
  'XOR',
  'XNOR',
];

/** Key of a net: the output port that drives it. */
export const netKey = (component: string, port: string) => `${component}:${port}`;

export type DeviceKind = 'gate' | 'block' | 'latch' | 'edge';

export interface Device {
  id: string;
  type: ComponentType;
  kind: DeviceKind;
  /** Net feeding each input port, '' when the port is unconnected (reads X). */
  inputs: string[];
  /** Net driven by each output port. */
  outputs: string[];
  /** Delays in ticks: for a new value 1, for a new value 0, and for X. */
  rise: number;
  fall: number;
  plain: number;
  /** Index of the CLK input of an edge-triggered device, -1 otherwise. */
  clock: number;
  /** Index of the asynchronous RESET input (COUNTER4), -1 otherwise or when unconnected. */
  reset: number;
  /** Indices of the active-low CLR' and PRE' of a flip-flop, -1 when off or unconnected. */
  clr: number;
  pre: number;
  /** Stored bits of a latch, flip-flop, register or counter. */
  state: Logic[];
  /** Latch inputs at the previous evaluation (to spot the SR race). */
  last?: Logic[];
}

export interface Clock {
  net: string;
  /** Ticks between toggles. */
  half: number;
  start: 0 | 1;
}

export interface Netlist {
  devices: Device[];
  /** Devices that read each net. */
  fanout: Map<string, Device[]>;
  /** Fixed values: switches and constants. */
  sources: Map<string, Logic>;
  clocks: Clock[];
}

function kindOf(type: ComponentType): DeviceKind | null {
  if (GATE_TYPES.includes(type)) return 'gate';
  if (isCombinationalBlock(type)) return 'block';
  if (LATCHES.includes(type)) return 'latch';
  if (EDGE_TRIGGERED.includes(type)) return 'edge';
  return null;
}

/** Initial stored value (rule E5): flip-flops default to 0, latches to X (decision 8). */
function initialState(c: Component, kind: DeviceKind): Logic[] {
  const init = c.props?.init ?? (kind === 'latch' ? 'X' : 0);
  return Array<Logic>(stateWidth(c.type)).fill(init);
}

export function buildNetlist(circuit: Circuit): Netlist {
  const driverOf = new Map<string, string>();
  for (const w of circuit.wires) {
    driverOf.set(netKey(w.to.component, w.to.port), netKey(w.from.component, w.from.port));
  }

  const devices: Device[] = [];
  const fanout = new Map<string, Device[]>();
  const sources = new Map<string, Logic>();
  const clocks: Clock[] = [];

  for (const c of circuit.components) {
    const out = netKey(c.id, 'out');
    if (c.type === 'CONST0') sources.set(out, 0);
    else if (c.type === 'CONST1') sources.set(out, 1);
    else if (c.type === 'INPUT') sources.set(out, c.props?.value ?? 0);
    else if (c.type === 'CLOCK') {
      const start = c.props?.startLevel ?? 0;
      sources.set(out, start);
      clocks.push({ net: out, half: Math.max(1, delayToTicks(c.props?.halfPeriod ?? 1)), start });
    }

    const kind = kindOf(c.type);
    if (!kind) continue;
    const ports = inputsOfComponent(c);
    const plain = delayToTicks(c.delay);
    const device: Device = {
      id: c.id,
      type: c.type,
      kind,
      inputs: ports.map((p) => driverOf.get(netKey(c.id, p)) ?? ''),
      outputs: outputPortsOf(c.type).map((p) => netKey(c.id, p)),
      rise: c.props?.tpLH !== undefined ? delayToTicks(c.props.tpLH) : plain,
      fall: c.props?.tpHL !== undefined ? delayToTicks(c.props.tpHL) : plain,
      plain,
      clock: kind === 'edge' ? ports.indexOf('CLK') : -1,
      reset: -1,
      clr: -1,
      pre: -1,
      state: kind === 'latch' || kind === 'edge' ? initialState(c, kind) : [],
    };
    // an unconnected RESET means the counter is never reset (otherwise X would spread)
    const reset = c.type === 'COUNTER4' ? ports.indexOf('RESET') : -1;
    if (reset >= 0 && device.inputs[reset]) device.reset = reset;
    // the same for an unconnected CLR' or PRE': inactive
    for (const [key, port] of [['clr', "CLR'"], ['pre', "PRE'"]] as const) {
      const k = ports.indexOf(port);
      if (k >= 0 && device.inputs[k]) device[key] = k;
    }
    devices.push(device);
    for (const n of new Set(device.inputs)) {
      if (!n) continue;
      const list = fanout.get(n) ?? [];
      list.push(device);
      fanout.set(n, list);
    }
  }
  return { devices, fanout, sources, clocks };
}

/** Delay before a new output value appears (rule E2: tpLH for 1, tpHL for 0). */
export const delayFor = (d: Device, v: Logic) => (v === 1 ? d.rise : v === 0 ? d.fall : d.plain);
