/**
 * Circuit data model (PROJECT_MASTER §3, COMPONENT_SPEC §2).
 *
 * A circuit is a netlist: components with named ports, and wires that each
 * carry a single bit from one output port to one input port. Everything here
 * is plain data so it can be saved as JSON and handed to the engine as is.
 */
import type { Logic } from '../engine/logic';

export type Signal = Logic;

/** Display unit for Tp. The engine always works in integer ticks (see time.ts). */
export type TimeUnit = 'none' | 'ns' | 's';

export const COMPONENT_TYPES = [
  // constants, inputs, outputs (§2.1)
  'CONST0',
  'CONST1',
  'INPUT',
  'CLOCK',
  'OUTPUT',
  // gates (§2.2)
  'NOT',
  'BUF',
  'AND',
  'OR',
  'NAND',
  'NOR',
  'XOR',
  'XNOR',
  // combinational (§2.3)
  'HALF_ADDER',
  'FULL_ADDER',
  'MUX2',
  'MUX4',
  'MUX8',
  'DEC2x4',
  'DEC3x8',
  'ENC4x2',
  'PRIORITY_ENC4x2',
  // sequential (§2.4)
  'SR_LATCH',
  'D_LATCH',
  'D_FF',
  'T_FF',
  'JK_FF',
  'SR_FF',
  'REGISTER4',
  'COUNTER4',
] as const;

export type ComponentType = (typeof COMPONENT_TYPES)[number];

export interface Position {
  x: number;
  y: number;
}

/**
 * Optional per-type settings. Only the keys that make sense for a type are
 * checked by validate.ts; anything else is kept but ignored.
 */
/** One planned change of a switch, e.g. "S0 goes to 0 at t = 5". */
export interface Stimulus {
  /** In the circuit's time unit. */
  time: number;
  value: 0 | 1;
}

export interface ComponentProps {
  /** INPUT: current switch value. */
  value?: 0 | 1;
  /** INPUT: changes that happen by themselves when time runs (exam questions, FSM input). */
  schedule?: Stimulus[];
  /** CLOCK: half period in the circuit's time unit (rule E6). */
  halfPeriod?: number;
  /** CLOCK: level before the first edge. */
  startLevel?: 0 | 1;
  /** Latches and flip-flops: value before the first event (rule E5). */
  init?: Signal;
  /** Any component with a delay: separate rise / fall delay (rule E2). */
  tpLH?: number;
  tpHL?: number;
  [key: string]: unknown;
}

export interface Component {
  id: string;
  type: ComponentType;
  position: Position;
  /** Tp in the circuit's time unit, in steps of 0.1. */
  delay: number;
  /** Number of inputs, for gates with a variable fan-in. */
  inputs: number;
  props?: ComponentProps;
}

export interface PortRef {
  component: string;
  port: string;
}

export interface Wire {
  id: string;
  from: PortRef;
  to: PortRef;
}

export interface Circuit {
  version: 1;
  name: string;
  timeUnit: TimeUnit;
  components: Component[];
  wires: Wire[];
}

export const CIRCUIT_VERSION = 1;
