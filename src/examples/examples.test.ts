import { describe, expect, it } from 'vitest';
import { Simulator } from '../engine/simulator';
import { hasErrors, validateCircuit } from '../model';
import { counter4 } from './counter4';
import { BAMBA_INPUT, DETECTOR_INPUT, FSM_PERIOD, bambaFsm, detector0101 } from './fsm';
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

describe('state machines of week 9', () => {
  const run = (c: Circuit, until: number) => {
    const sim = new Simulator(c);
    sim.runUntil(until * 10);
    return sim;
  };
  /** z per clock cycle from the course's state table, for the given X bits. */
  const fromTable = (table: Record<string, [string, string, 0 | 1, 0 | 1]>, bits: (0 | 1)[]) => {
    let s = '00';
    return bits.map((x) => {
      const [ns0, ns1, z0, z1] = table[s];
      const z = x ? z1 : z0;
      s = x ? ns1 : ns0;
      return z;
    });
  };
  /** z in each cycle, once X has settled and before the edge (t = 10i + 3). */
  const sampled = (c: Circuit, cycles: number) => {
    const sim = new Simulator(c);
    const out: (0 | 1 | 'X')[] = [];
    for (let i = 0; i < cycles; i++) {
      sim.runUntil((i * FSM_PERIOD + 3) * 10);
      out.push(sim.value('z:out'));
    }
    return out;
  };

  it('the Bamba machine gives z = 1 once after a Bamba of 2 or 3 cycles, as in the WK9B table', () => {
    const table = {
      '00': ['00', '01', 0, 0],
      '01': ['00', '10', 0, 0],
      '10': ['00', '11', 1, 0],
      '11': ['00', '00', 1, 0],
    } as const;
    // homework 9 (TC-F1)
    const want = [0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0];
    expect(fromTable(table as never, BAMBA_INPUT)).toEqual(want);
    expect(sampled(bambaFsm, BAMBA_INPUT.length)).toEqual(want);
    // one clean pulse per normal Bamba, no glitches
    expect(wave(run(bambaFsm, 190), 'z:out')).toBe('0:0 52:1 57:0 112:1 117:0');
  });

  it('the WK9A machine detects 0101 (a → b → d → c), with the equations of the lecture', () => {
    // the next-state table from Y1 = Jy1' + K'y1, Y2 = D
    const table: Record<string, [string, string, 0 | 1, 0 | 1]> = {};
    for (const y1 of [0, 1])
      for (const y2 of [0, 1]) {
        const row = [0, 1].map((x) => {
          const J = x & y2;
          const K = x | (1 - y2);
          const D = ((1 - x) & (1 - y2)) | ((1 - y1) & y2);
          const Y1 = (J & (1 - y1)) | ((1 - K) & y1);
          return [`${Y1}${D}`, (x & y1 & (1 - y2)) as 0 | 1] as const;
        });
        table[`${y1}${y2}`] = [row[0][0], row[1][0], row[0][1], row[1][1]];
      }
    expect(sampled(detector0101, DETECTOR_INPUT.length)).toEqual(
      fromTable(table, DETECTOR_INPUT),
    );
    expect(wave(run(detector0101, 170), 'z:out')).toBe('0:0 41:1 47:0 101:1 107:0');
    // TC-F2, from the lecture
    expect(fromTable(table, [0, 1, 0, 1])).toEqual([0, 0, 0, 1]);
    expect(fromTable(table, [1, 1, 0, 1, 0, 1])).toEqual([0, 0, 0, 0, 0, 1]);
    expect(fromTable(table, [0, 0, 1, 0])).toEqual([0, 0, 0, 0]);
    // 010101: only once, the machine goes back to a after detecting
    expect(fromTable(table, [0, 1, 0, 1, 0, 1]).filter((z) => z === 1)).toHaveLength(1);
  });
});
