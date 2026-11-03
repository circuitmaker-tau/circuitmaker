import { createComponent, createWire } from '../model/factory';
import type { Circuit } from '../model/types';

/**
 * Exam 2025A, 2D (TEST_CIRCUITS TC-S1): a synchronous 4-bit down counter
 * from JK flip-flops. J0 = K0 = 1, J1 = K1 = Q0', J2 = K2 = Q0'·Q1',
 * J3 = K3 = Q0'·Q1'·Q2'. From 0000 it counts 1111, 1110, 1101, …
 * Every Tp = 0 (negligible, as in the exam).
 */
const ff = (id: string, x: number) =>
  createComponent('JK_FF', id, { x, y: 40 }, { delay: 0, props: { init: 0 } });
const and = (id: string, x: number) => createComponent('AND', id, { x, y: 180 }, { delay: 0 });
const lamp = (id: string, y: number) => createComponent('OUTPUT', id, { x: 1040, y });

export const downCounter: Circuit = {
  version: 1,
  name: 'מונה מטה מ-4 JK (2025 מועד א, 2D)',
  timeUnit: 's',
  components: [
    createComponent('CONST1', 'one', { x: 0, y: 30 }),
    createComponent('CLOCK', 'CLK', { x: 0, y: 330 }),
    ff('J0', 160),
    ff('J1', 380),
    and('a1', 380),
    ff('J2', 600),
    and('a2', 600),
    ff('J3', 820),
    lamp('Q3', 0),
    lamp('Q2', 70),
    lamp('Q1', 140),
    lamp('Q0', 210),
  ],
  wires: [
    createWire('w1', ['one', 'out'], ['J0', 'J']),
    createWire('w2', ['one', 'out'], ['J0', 'K']),
    createWire('w3', ['J0', "Q'"], ['J1', 'J']),
    createWire('w4', ['J0', "Q'"], ['J1', 'K']),
    createWire('w5', ['J0', "Q'"], ['a1', 'in0']),
    createWire('w6', ['J1', "Q'"], ['a1', 'in1']),
    createWire('w7', ['a1', 'out'], ['J2', 'J']),
    createWire('w8', ['a1', 'out'], ['J2', 'K']),
    createWire('w9', ['a1', 'out'], ['a2', 'in0']),
    createWire('w10', ['J2', "Q'"], ['a2', 'in1']),
    createWire('w11', ['a2', 'out'], ['J3', 'J']),
    createWire('w12', ['a2', 'out'], ['J3', 'K']),
    createWire('w13', ['CLK', 'out'], ['J0', 'CLK']),
    createWire('w14', ['CLK', 'out'], ['J1', 'CLK']),
    createWire('w15', ['CLK', 'out'], ['J2', 'CLK']),
    createWire('w16', ['CLK', 'out'], ['J3', 'CLK']),
    createWire('w17', ['J3', 'Q'], ['Q3', 'in']),
    createWire('w18', ['J2', 'Q'], ['Q2', 'in']),
    createWire('w19', ['J1', 'Q'], ['Q1', 'in']),
    createWire('w20', ['J0', 'Q'], ['Q0', 'in']),
  ],
};
