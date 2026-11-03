import { createComponent, createWire } from '../model/factory';
import type { Circuit } from '../model/types';

/**
 * A 4-bit counter driven by a clock, with a reset switch (part of the
 * project's exam demo). It counts up on every rising edge, 0 to 15 and back
 * to 0; RESET = 1 clears it at once.
 */
export const counter4: Circuit = {
  version: 1,
  name: 'מונה 4 ביט עם שעון',
  timeUnit: 'ns',
  components: [
    createComponent('CLOCK', 'CLK', { x: 0, y: 0 }),
    createComponent('INPUT', 'RESET', { x: 0, y: 100 }),
    createComponent('COUNTER4', 'cnt', { x: 160, y: 20 }, { props: { init: 0 } }),
    // lamps in the order of the outputs, so no wires cross
    createComponent('OUTPUT', 'Q0', { x: 400, y: 0 }),
    createComponent('OUTPUT', 'Q1', { x: 400, y: 60 }),
    createComponent('OUTPUT', 'Q2', { x: 400, y: 120 }),
    createComponent('OUTPUT', 'Q3', { x: 400, y: 180 }),
  ],
  wires: [
    createWire('w1', ['CLK', 'out'], ['cnt', 'CLK']),
    createWire('w2', ['RESET', 'out'], ['cnt', 'RESET']),
    createWire('w3', ['cnt', 'Q3'], ['Q3', 'in']),
    createWire('w4', ['cnt', 'Q2'], ['Q2', 'in']),
    createWire('w5', ['cnt', 'Q1'], ['Q1', 'in']),
    createWire('w6', ['cnt', 'Q0'], ['Q0', 'in']),
  ],
};
