import { createComponent, createWire } from '../model/factory';
import type { Circuit } from '../model/types';

/**
 * Exam 2026B, 2D (TEST_CIRCUITS TC-T2, part 2): a JK flip-flop whose J and K
 * are the clock through an inverter. Tp(inverter) = 0.5, Tp(JK) = 1, Q starts
 * at 0. The FF samples J and K just before each rising edge, so Q changes at
 * t = 2, 4, 6, …
 */
export const jkFromClock: Circuit = {
  version: 1,
  name: 'JK עם J = K = CLK׳ (2026 מועד ב, 2D)',
  timeUnit: 's',
  components: [
    createComponent('CLOCK', 'CLK', { x: 0, y: 120 }),
    createComponent('NOT', 'nJ', { x: 160, y: 0 }, { delay: 0.5 }),
    createComponent('NOT', 'nK', { x: 160, y: 200 }, { delay: 0.5 }),
    createComponent('JK_FF', 'ff', { x: 340, y: 90 }, { delay: 1, props: { init: 0 } }),
    createComponent('OUTPUT', 'Q', { x: 540, y: 90 }),
  ],
  wires: [
    createWire('w1', ['CLK', 'out'], ['nJ', 'in0']),
    createWire('w2', ['CLK', 'out'], ['nK', 'in0']),
    createWire('w3', ['nJ', 'out'], ['ff', 'J']),
    createWire('w4', ['nK', 'out'], ['ff', 'K']),
    createWire('w5', ['CLK', 'out'], ['ff', 'CLK']),
    createWire('w6', ['ff', 'Q'], ['Q', 'in']),
  ],
};
