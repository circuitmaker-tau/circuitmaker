import type { ComponentType } from '../model';

/** Formula under each gate, in the course notation (formula sheet). */
export const GATE_FORMULA: Partial<Record<ComponentType, string>> = {
  AND: 'x·y',
  OR: 'x+y',
  NOT: "x'",
  BUF: 'x',
  NAND: "(x·y)'",
  NOR: "(x+y)'",
  XOR: 'x⊕y',
  XNOR: 'x⊙y',
};
