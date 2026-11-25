/** Component names in the interface language (the catalog keeps the Hebrew ones). */
import { CATALOG } from '../model';
import type { ComponentType } from '../model';
import { isEnglish } from './lang';

const EN: Partial<Record<ComponentType, string>> = {
  CONST0: 'Constant 0',
  CONST1: 'Constant 1',
  INPUT: 'Switch',
  CLOCK: 'Clock',
  OUTPUT: 'Lamp',
  BUF: 'BUF (delay)',
  HALF_ADDER: 'Half adder',
  FULL_ADDER: 'Full adder',
  DEC2x4: 'Decoder 2:4',
  DEC3x8: 'Decoder 3:8',
  ENC4x2: 'Encoder 4:2 (for teaching)',
  PRIORITY_ENC4x2: 'Priority encoder 4:2',
  REGISTER4: '4-bit register',
  COUNTER4: '4-bit counter',
  BLOCK: 'Your own block',
};

export const labelOf = (type: ComponentType): string =>
  isEnglish() ? (EN[type] ?? CATALOG[type].label) : CATALOG[type].label;
