import type { Circuit } from '../model/types';
import { downCounter } from './downCounter';
import { jkFromClock } from './jkFromClock';
import { mux2FromGates } from './mux2FromGates';

/** Example circuits from the course, in the order they appear in the menu. */
export const EXAMPLES: { id: string; label: string; circuit: Circuit }[] = [
  { id: 'mux2', label: 'MUX 2:1 משערים: ריצוד (WK5)', circuit: mux2FromGates },
  { id: 'jk', label: 'JK עם J = K = CLK׳ (2026ב)', circuit: jkFromClock },
  { id: 'down', label: 'מונה מטה מ-4 JK (2025א)', circuit: downCounter },
];
