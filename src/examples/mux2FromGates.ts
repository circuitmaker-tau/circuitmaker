import type { Circuit } from '../model/types';

/**
 * MUX 2:1 built from gates, f = S0'·I0 + S0·I1, every Tp = 1.
 * The exam demo and TEST_CIRCUITS TC-H1: with I0 = I1 = 1, switching S0 from
 * 1 to 0 at t = 5 gives a static-1 glitch on F between t = 7 and t = 8.
 */
export const mux2FromGates: Circuit = {
  version: 1,
  name: 'MUX 2:1 משערים (static-1 hazard)',
  timeUnit: 'ns',
  components: [
    {
      id: 'I0',
      type: 'INPUT',
      position: { x: 0, y: 240 },
      delay: 0,
      inputs: 0,
      props: { value: 1 },
    },
    {
      id: 'I1',
      type: 'INPUT',
      position: { x: 0, y: 120 },
      delay: 0,
      inputs: 0,
      props: { value: 1 },
    },
    { id: 'S0', type: 'INPUT', position: { x: 0, y: 0 }, delay: 0, inputs: 0, props: { value: 1 } },
    { id: 'n1', type: 'NOT', position: { x: 140, y: 0 }, delay: 1, inputs: 1 },
    { id: 'a1', type: 'AND', position: { x: 280, y: 80 }, delay: 1, inputs: 2 },
    { id: 'a2', type: 'AND', position: { x: 280, y: 200 }, delay: 1, inputs: 2 },
    { id: 'o1', type: 'OR', position: { x: 420, y: 140 }, delay: 1, inputs: 2 },
    { id: 'F', type: 'OUTPUT', position: { x: 560, y: 140 }, delay: 0, inputs: 1 },
  ],
  wires: [
    { id: 'w1', from: { component: 'S0', port: 'out' }, to: { component: 'n1', port: 'in0' } },
    { id: 'w2', from: { component: 'S0', port: 'out' }, to: { component: 'a1', port: 'in0' } },
    { id: 'w3', from: { component: 'I1', port: 'out' }, to: { component: 'a1', port: 'in1' } },
    { id: 'w4', from: { component: 'n1', port: 'out' }, to: { component: 'a2', port: 'in0' } },
    { id: 'w5', from: { component: 'I0', port: 'out' }, to: { component: 'a2', port: 'in1' } },
    { id: 'w6', from: { component: 'a1', port: 'out' }, to: { component: 'o1', port: 'in0' } },
    { id: 'w7', from: { component: 'a2', port: 'out' }, to: { component: 'o1', port: 'in1' } },
    { id: 'w8', from: { component: 'o1', port: 'out' }, to: { component: 'F', port: 'in' } },
  ],
};
