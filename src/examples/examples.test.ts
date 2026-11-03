import { describe, expect, it } from 'vitest';
import { Simulator } from '../engine/simulator';
import { hasErrors, validateCircuit } from '../model';
import { counter4 } from './counter4';
import { EXAMPLES } from './index';
import { asymmetric, dffFeedback, mux2Fixed, norLatch, staticZero, tffPulses } from './lessons';
import { rippleAdder } from './rippleAdder';
import type { Circuit } from '../model';

const wave = (sim: Simulator, net: string) =>
  sim
    .trace(net)
    .map((t) => `${t.time / 10}:${t.value}`)
    .join(' ');

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

describe('teaching examples give the waveforms of the course solutions', () => {
  const run = (c: Circuit, until?: number) => {
    const sim = new Simulator(c);
    if (until === undefined) sim.runToEnd();
    else sim.runUntil(until * 10);
    return sim;
  };

  it('every example has a lesson and a unique id', () => {
    expect(new Set(EXAMPLES.map((x) => x.id)).size).toBe(EXAMPLES.length);
    expect(EXAMPLES.every((x) => x.lesson.length > 40)).toBe(true);
    expect(EXAMPLES.length).toBeGreaterThan(9);
  });

  it('the consensus term removes the MUX glitch', () => {
    const sim = new Simulator(mux2Fixed);
    sim.setNet('S0:out', 0, 0);
    sim.runToEnd();
    expect(wave(sim, 'o1:out')).toBe('0:1');
  });

  it('static-0 hazard of homework 5: Z = 0:0 50:1 60:0', () => {
    expect(wave(run(staticZero), 'Z:out')).toBe('0:0 50:1 60:0');
  });

  it('recitation 5: f = 0:1 75:0 85:1', () => {
    expect(wave(run(asymmetric), 'f:out')).toBe('0:1 75:0 85:1');
  });

  it('2026A 2D: Q2 pulses shortened to 1.5', () => {
    expect(wave(run(tffPulses, 12), 'Q2:out')).toBe('0:1 1.5:0 4:1 5.5:0 8:1 9.5:0 12:1');
  });

  it('2026C 2D: D and Q1', () => {
    const sim = run(dffFeedback, 16);
    expect(wave(sim, 'D:out')).toBe('0:0 3:1 7:0 11:1 15:0');
    expect(wave(sim, 'Q1:out')).toBe('0:0 2:1 6:0 10:1 14:0');
  });

  it('NOR latch: unknown at first; dropping S and R together makes it oscillate', () => {
    expect(new Simulator(norLatch).value('q:out')).toBe('X');
    const c = structuredClone(norLatch);
    for (const id of ['S', 'R']) {
      c.components.find((x) => x.id === id)!.props = {
        value: 0,
        schedule: [
          { time: 2, value: 1 },
          { time: 6, value: 0 },
        ],
      };
    }
    const sim = run(c, 200);
    expect(sim.oscillating.size).toBeGreaterThan(0);
  });
});
