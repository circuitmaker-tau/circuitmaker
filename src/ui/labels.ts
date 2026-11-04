import type { ComponentType } from '../model';

/** Title drawn inside a block, as in the course slides. */
export const BOX_TITLE: Partial<Record<ComponentType, string>> = {
  HALF_ADDER: 'HA',
  FULL_ADDER: 'FA',
  MUX2: 'MUX 2:1',
  MUX4: 'MUX 4:1',
  MUX8: 'MUX 8:1',
  MUX16: 'MUX 16:1',
  DEC2x4: 'DEC 2:4',
  DEC3x8: 'DEC 3:8',
  ENC4x2: 'ENC 4:2',
  PRIORITY_ENC4x2: 'P-ENC 4:2',
  SR_LATCH: 'SR latch',
  D_LATCH: 'D latch',
  D_FF: 'D-FF',
  T_FF: 'T-FF',
  JK_FF: 'JK-FF',
  SR_FF: 'SR-FF',
  REGISTER4: 'REG 4',
  COUNTER4: 'CNT 4',
};

/** Short name on the palette button (the full name is in its tooltip). */
export const PALETTE_LABEL: Partial<Record<ComponentType, string>> = {
  PRIORITY_ENC4x2: 'מקודד עדיפות',
  ENC4x2: 'מקודד 4:2',
  D_FF: 'D-FF',
  T_FF: 'T-FF',
  JK_FF: 'JK-FF',
  SR_FF: 'SR-FF',
};
