/**
 * Three-valued logic for the simulation engine (COMPONENT_SPEC §1, rule E7).
 *
 * A signal is 0, 1 or 'X' (unknown). Gates use controlling values:
 * a single 0 forces AND to 0 and a single 1 forces OR to 1 even when other
 * inputs are X. XOR has no controlling value, so any X input gives X.
 */
export type Logic = 0 | 1 | 'X';

export type GateType = 'AND' | 'OR' | 'NOT' | 'BUF' | 'NAND' | 'NOR' | 'XOR' | 'XNOR';

export function not(a: Logic): Logic {
  if (a === 'X') return 'X';
  return a === 0 ? 1 : 0;
}

export function and(inputs: readonly Logic[]): Logic {
  if (inputs.includes(0)) return 0;
  if (inputs.includes('X')) return 'X';
  return 1;
}

export function or(inputs: readonly Logic[]): Logic {
  if (inputs.includes(1)) return 1;
  if (inputs.includes('X')) return 'X';
  return 0;
}

export function xor(inputs: readonly Logic[]): Logic {
  if (inputs.includes('X')) return 'X';
  const ones = inputs.filter((v) => v === 1).length;
  return ones % 2 === 1 ? 1 : 0;
}

/** Evaluate one gate. NOT and BUF take exactly one input; the rest take two or more. */
export function evalGate(type: GateType, inputs: readonly Logic[]): Logic {
  const single = type === 'NOT' || type === 'BUF';
  if (single ? inputs.length !== 1 : inputs.length < 2) {
    throw new Error(`${type} got ${inputs.length} inputs`);
  }
  switch (type) {
    case 'AND':
      return and(inputs);
    case 'OR':
      return or(inputs);
    case 'NOT':
      return not(inputs[0]);
    case 'BUF':
      return inputs[0];
    case 'NAND':
      return not(and(inputs));
    case 'NOR':
      return not(or(inputs));
    case 'XOR':
      return xor(inputs);
    case 'XNOR':
      return not(xor(inputs));
  }
}
