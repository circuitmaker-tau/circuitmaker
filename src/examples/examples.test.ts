import { describe, expect, it } from 'vitest';
import { Simulator } from '../engine/simulator';
import { hasErrors, validateCircuit } from '../model';
import { counter4 } from './counter4';
import { EXAMPLES } from './index';
import { rippleAdder } from './rippleAdder';

const word = (sim: Simulator, nets: string[]) => nets.map((n) => sim.value(n)).join('');

describe('example circuits', () => {
  it('every example is a valid circuit with every input connected', () => {
    for (const ex of EXAMPLES) {
      const issues = validateCircuit(ex.circuit);
      expect(hasErrors(issues)).toBe(false);
      expect(issues.filter((i) => i.code === 'UNCONNECTED_INPUT')).toEqual([]);
    }
  });

  it('the ripple-carry adder adds 0011 + 1011 = 1110, carry 0', () => {
    const sim = new Simulator(rippleAdder);
    expect(word(sim, ['FA3:S', 'FA2:S', 'FA1:S', 'FA0:S'])).toBe('1110');
    expect(sim.value('FA3:Cout')).toBe(0);
  });

  it('the carry ripples: A0 1 → 0 settles the sum one adder per Tp', () => {
    const sim = new Simulator(rippleAdder);
    sim.setNet('A0:out', 0, 0); // 0010 + 1011 = 1101
    sim.runToEnd();
    expect(word(sim, ['FA3:S', 'FA2:S', 'FA1:S', 'FA0:S'])).toBe('1101');
    const last = (net: string) => sim.trace(net).at(-1)!.time / 10;
    // FA0 sees A0 at once; FA1 only after FA0's carry changes one Tp later
    expect([last('FA0:S'), last('FA0:Cout'), last('FA1:S')]).toEqual([1, 1, 2]);
  });

  it('the counter counts the rising edges and RESET clears it', () => {
    const sim = new Simulator(counter4);
    sim.runUntil(10 * 10); // edges at 1, 3, 5, 7, 9
    expect(word(sim, ['cnt:Q3', 'cnt:Q2', 'cnt:Q1', 'cnt:Q0'])).toBe('0101');
    sim.setNet('RESET:out', 1, 105);
    sim.runUntil(10 * 12);
    expect(word(sim, ['cnt:Q3', 'cnt:Q2', 'cnt:Q1', 'cnt:Q0'])).toBe('0000');
  });
});
