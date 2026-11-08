import { describe, expect, it } from 'vitest';
import { mux2FromGates } from '../examples/mux2FromGates';
import { staticZero, tffPulses } from '../examples/lessons';
import { blankGuess, buildQuestion, cannotPractise, grade } from './practice';
import type { Guess } from './practice';

const t1Rows = [
  { net: 'CLK:out', label: 'CLK', given: true },
  { net: 'ff:Q', label: 'Q0', given: false },
  { net: 'Q1:out', label: 'Q1', given: false },
  { net: 'Q2:out', label: 'Q2', given: false },
];

describe('practice: guess the timing diagram', () => {
  it('cuts exam 2026A 2D into cells of Tp = 0.5, so every edge is on a cell edge', () => {
    const q = buildQuestion(tffPulses, t1Rows);
    expect(q.step).toBe(5); // 0.5 units
    expect(q.cells).toBe(32); // 8 clock periods of 2 units
    const q2 = q.rows.find((r) => r.net === 'Q2:out')!.truth;
    // Q2 falls at 1.5, rises at 4, falls again at 5.5: pulses of 1.5 as in the solution
    expect(q2.slice(0, 12)).toEqual([1, 1, 1, 0, 0, 0, 0, 0, 1, 1, 1, 0]);
    const clk = q.rows.find((r) => r.net === 'CLK:out')!.truth;
    expect(clk.slice(0, 6)).toEqual([0, 0, 1, 1, 0, 0]);
  });

  it('grades cell by cell, and only the rows to draw', () => {
    const q = buildQuestion(tffPulses, t1Rows);
    const blank = new Map(q.rows.map((r) => [r.net, blankGuess(r)]));
    const g0 = grade(q, blank);
    expect(g0.rows).toBe(3);
    expect(g0.rightRows).toBe(0);
    // the first cells match the value at t = 0
    expect(g0.wrong.get('Q2:out')![0]).toBe(3);

    const perfect = new Map(q.rows.map((r) => [r.net, r.truth.map((v) => (v === 1 ? 1 : 0)) as Guess]));
    expect(grade(q, perfect).rightRows).toBe(3);

    const oneOff = new Map(perfect);
    const q1 = [...perfect.get('Q1:out')!];
    q1[5] = q1[5] === 1 ? 0 : 1;
    oneOff.set('Q1:out', q1);
    const g = grade(q, oneOff);
    expect(g.rightRows).toBe(2);
    expect(g.wrong.get('Q1:out')).toEqual([5]);
  });

  it('without a clock, runs until the scheduled change has settled (homework 5, static-0)', () => {
    const rows = ['B:out', 'X:out', 'Y:out', 'Z:out'].map((net) => ({ net, label: net, given: net === 'B:out' }));
    const q = buildQuestion(staticZero, rows);
    expect(q.step).toBe(100); // every gate has delay 10
    const z = q.rows.find((r) => r.net === 'Z:out')!.truth;
    // Z = 0 before and after, with the 1-wide glitch of the solution in between
    expect(z[0]).toBe(0);
    expect(z.filter((v) => v === 1).length).toBe(1);
    expect(z[z.length - 1]).toBe(0);
  });

  it('asks for a clock or a scheduled change', () => {
    expect(cannotPractise(mux2FromGates)).not.toBeNull();
    expect(cannotPractise(tffPulses)).toBeNull();
    expect(cannotPractise(staticZero)).toBeNull();
  });
});
