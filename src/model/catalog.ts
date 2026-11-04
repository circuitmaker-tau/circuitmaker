/**
 * Port layout and defaults for every component type (COMPONENT_SPEC §2).
 * Port names follow the 2026 exams: indices start at 0, and 0 is the LSB.
 */
import type { Component, ComponentType } from './types';

export type Category = 'io' | 'gate' | 'combinational' | 'sequential';

export interface ComponentDef {
  category: Category;
  /** Hebrew name for the palette and the help panel. */
  label: string;
  /** Input port names for a given fan-in. */
  inputPorts: (inputs: number) => string[];
  outputPorts: readonly string[];
  /** Allowed fan-in. Fixed-port components have min === max. */
  minInputs: number;
  maxInputs: number;
  defaultDelay: number;
  /** Latches and flip-flops accept `init` (rule E5). */
  stateful: boolean;
}

const seq = (prefix: string, count: number): string[] =>
  Array.from({ length: count }, (_, i) => `${prefix}${i}`);

const fixed = (ports: string[]) => () => ports;

const gate = (label: string, minInputs: number, maxInputs: number): ComponentDef => ({
  category: 'gate',
  label,
  inputPorts: (n) => seq('in', n),
  outputPorts: ['out'],
  minInputs,
  maxInputs,
  defaultDelay: 1,
  stateful: false,
});

const block = (
  category: Category,
  label: string,
  inputs: string[],
  outputs: string[],
  stateful = false,
): ComponentDef => ({
  category,
  label,
  inputPorts: fixed(inputs),
  outputPorts: outputs,
  minInputs: inputs.length,
  maxInputs: inputs.length,
  defaultDelay: 1,
  stateful,
});

const source = (label: string): ComponentDef => ({
  ...block('io', label, [], ['out']),
  defaultDelay: 0,
});

export const CATALOG: Record<ComponentType, ComponentDef> = {
  CONST0: source('קבוע 0'),
  CONST1: source('קבוע 1'),
  INPUT: source('מתג'),
  CLOCK: source('שעון'),
  OUTPUT: { ...block('io', 'נורה', ['in'], []), defaultDelay: 0 },

  NOT: gate('NOT', 1, 1),
  BUF: gate('BUF (משהה)', 1, 1),
  AND: gate('AND', 2, 4),
  OR: gate('OR', 2, 4),
  NAND: gate('NAND', 2, 4),
  NOR: gate('NOR', 2, 4),
  XOR: gate('XOR', 2, 4),
  XNOR: gate('XNOR', 2, 2),

  HALF_ADDER: block('combinational', 'חצי מסכם', ['A', 'B'], ['S', 'C']),
  FULL_ADDER: block('combinational', 'מסכם מלא', ['A', 'B', 'Cin'], ['S', 'Cout']),
  MUX2: block('combinational', 'MUX 2:1', [...seq('I', 2), 'S0'], ['f']),
  MUX4: block('combinational', 'MUX 4:1', [...seq('I', 4), ...seq('S', 2)], ['f']),
  MUX8: block('combinational', 'MUX 8:1', [...seq('I', 8), ...seq('S', 3)], ['f']),
  MUX16: block('combinational', 'MUX 16:1', [...seq('I', 16), ...seq('S', 4)], ['f']),
  DEC2x4: block('combinational', 'מפענח 2:4', [...seq('I', 2), 'En'], seq('D', 4)),
  DEC3x8: block('combinational', 'מפענח 3:8', [...seq('I', 3), 'En'], seq('D', 8)),
  ENC4x2: block('combinational', 'מקודד 4:2 (לימודי)', [...seq('D', 4), 'En'], ['X1', 'X0']),
  PRIORITY_ENC4x2: block(
    'combinational',
    'מקודד עדיפויות 4:2',
    [...seq('D', 4), 'En'],
    ['X1', 'X0', 'V'],
  ),

  SR_LATCH: block('sequential', 'SR latch', ['S', 'R'], ['Q', "Q'"], true),
  D_LATCH: block('sequential', 'D latch', ['D', 'En'], ['Q', "Q'"], true),
  D_FF: block('sequential', 'D flip-flop', ['D', 'CLK'], ['Q', "Q'"], true),
  T_FF: block('sequential', 'T flip-flop', ['T', 'CLK'], ['Q', "Q'"], true),
  JK_FF: block('sequential', 'JK flip-flop', ['J', 'K', 'CLK'], ['Q', "Q'"], true),
  SR_FF: block('sequential', 'SR flip-flop', ['S', 'R', 'CLK'], ['Q', "Q'"], true),
  REGISTER4: block('sequential', 'אוגר 4 ביט', [...seq('D', 4), 'CLK'], seq('Q', 4), true),
  COUNTER4: block('sequential', 'מונה 4 ביט', ['CLK', 'RESET'], seq('Q', 4), true),
};

export function inputPortsOf(type: ComponentType, inputs: number): string[] {
  return CATALOG[type].inputPorts(inputs);
}

/**
 * Active-low asynchronous clear and preset of a flip-flop (WK8A: "nullifying
 * inputs will always be async"). They are shown only when the component's
 * `async` prop is on, and an unconnected one is inactive (1).
 */
export const ASYNC_PORTS = ["CLR'", "PRE'"] as const;

const WITH_ASYNC: ReadonlySet<ComponentType> = new Set(['D_FF', 'T_FF', 'JK_FF', 'SR_FF']);

export const hasAsyncOption = (type: ComponentType) => WITH_ASYNC.has(type);

/** Every input port of this component, including CLR' and PRE' when they are turned on. */
export function inputsOfComponent(c: Pick<Component, 'type' | 'inputs' | 'props'>): string[] {
  const base = inputPortsOf(c.type, c.inputs);
  return c.props?.async && hasAsyncOption(c.type) ? [...base, ...ASYNC_PORTS] : base;
}

/** An input that may stay unconnected without becoming X. */
export const isOptionalInput = (port: string) => (ASYNC_PORTS as readonly string[]).includes(port);

export function outputPortsOf(type: ComponentType): readonly string[] {
  return CATALOG[type].outputPorts;
}
