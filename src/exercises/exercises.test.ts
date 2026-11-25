import { describe, expect, it } from 'vitest';
import { createComponent, createWire } from '../model/factory';
import { validateCircuit } from '../model/validate';
import { FAMILIES, exerciseFromKey, newExercise, rng } from './exercises';
import type { Level } from './exercises';
import { gradeExercise } from './grade';

const SEEDS = Array.from({ length: 40 }, (_, i) => i * 7919 + 13);

describe('self-practice exercises', () => {
  it('every family, at every seed tried, has a solution that keeps its own limits and scores 100', () => {
    for (const f of FAMILIES) {
      for (const seed of SEEDS) {
        const ex = exerciseFromKey(`${f.id}:${seed}`)!;
        const sol = ex.solution();
        expect(validateCircuit(sol).filter((i) => i.severity === 'error'), ex.key).toEqual([]);
        const g = gradeExercise(sol, ex);
        expect(g.score, `${ex.key}: ${g.notes.map((n) => n.text).join(' | ')}`).toBe(100);
        expect(g.used).toBe(ex.best);
      }
    }
  });

  it('the starter (switches and lamps only) scores low and says why', () => {
    for (const f of FAMILIES) {
      const ex = exerciseFromKey(`${f.id}:5`)!;
      const g = gradeExercise(ex.starter(), ex);
      expect(g.score).toBeLessThan(60);
      expect(g.parts.rules).toBe(0);
      expect(g.notes.some((n) => n.text.includes('לא מחובר'))).toBe(true);
    }
  });

  it('a key always gives the same exercise, and every level has several families', () => {
    expect(exerciseFromKey('mux8-not:42')!.outputs).toEqual(exerciseFromKey('mux8-not:42')!.outputs);
    expect(exerciseFromKey('nope:1')).toBeNull();
    expect(exerciseFromKey('nand3:-1')).toBeNull();
    for (const level of [1, 2, 3] as Level[]) {
      expect(FAMILIES.filter((f) => f.level === level).length >= 3).toBe(true);
      const r = rng(level);
      let prev: string | undefined;
      for (let i = 0; i < 20; i++) {
        const ex = newExercise(level, prev, r);
        expect(ex.level).toBe(level);
        if (prev) expect(ex.family).not.toBe(prev.split(':')[0]);
        prev = ex.key;
      }
    }
  });

  it('XOR from NAND: a correct circuit with a forbidden gate loses the limits and the economy points', () => {
    const ex = exerciseFromKey('xor-nand:0')!;
    const c = ex.starter();
    c.components.push(createComponent('XOR', 'x1', { x: 200, y: 40 }));
    c.wires.push(createWire('a', ['A', 'out'], ['x1', 'in0']), createWire('b', ['B', 'out'], ['x1', 'in1']), createWire('f', ['x1', 'out'], ['F', 'in']));
    const g = gradeExercise(c, ex);
    expect(g.parts).toEqual({ function: 60, rules: 13, economy: 0 });
    expect(g.notes.some((n) => n.kind === 'error' && n.text.includes('XOR אסור'))).toBe(true);
  });

  it('a wrong row is named with the inputs, what came out and what was wanted', () => {
    const ex = exerciseFromKey('nand-basic:1')!; // AND from NAND
    const c = ex.starter();
    c.components.push(createComponent('NAND', 'g1', { x: 200, y: 40 }, { inputs: 2 }));
    c.wires.push(createWire('a', ['A', 'out'], ['g1', 'in0']), createWire('b', ['B', 'out'], ['g1', 'in1']), createWire('f', ['g1', 'out'], ['F', 'in']));
    const g = gradeExercise(c, ex);
    expect(g.correctRows).toBe(0); // NAND is the opposite of AND in every row
    expect(g.score).toBe(0);
    expect(g.notes.some((n) => n.text === 'כש-A=0 B=0 המעגל מוציא 1, וצריך 0.')).toBe(true);
  });

  it('fan-in, the number of parts, constants and extra switches are limits too', () => {
    const ex = exerciseFromKey('nand3:3')!;
    const c = ex.solution();
    // a NAND with 4 inputs, a constant and an extra switch
    c.components.push(createComponent('NAND', 'big', { x: 900, y: 400 }, { inputs: 4 }), createComponent('CONST1', 'k', { x: 900, y: 500 }), createComponent('INPUT', 'E', { x: 0, y: 600 }));
    const g = gradeExercise(c, ex);
    const errors = g.notes.filter((n) => n.kind === 'error').map((n) => n.text).join(' | ');
    expect(errors).toContain('עד 3 כניסות');
    expect(errors).toContain(`עד ${ex.rules.maxParts} רכיבים`);
    expect(errors).toContain('קבועים');
    expect(errors).toContain('אסור להוסיף מתגים');
    expect(g.parts.rules).toBe(0);
  });

  it('a solution as short as ours says so', () => {
    const ex = exerciseFromKey('nor-basic:2')!; // OR from NOR: ours takes 2
    const g = gradeExercise(ex.solution(), ex);
    expect(g.notes.some((n) => n.text.includes('כמו בפתרון שלנו'))).toBe(true);
    expect(ex.best).toBe(2);
  });
});

describe('the targets agree with the built-in components', () => {
  it('the full adder and the MUX 4:1 questions want exactly what those components do', () => {
    for (const [key, type, ports] of [
      ['fa-mux4:0', 'FULL_ADDER', ['A', 'B', 'Cin']],
      ['mux4-mux2:0', 'MUX4', ['S1', 'S0', 'I3', 'I2', 'I1', 'I0']],
    ] as const) {
      const ex = exerciseFromKey(key)!;
      const c = ex.starter();
      c.components.push(createComponent(type, 'ref', { x: 300, y: 0 }));
      ports.forEach((p, i) => c.wires.push(createWire(`r${i}`, [p, 'out'], ['ref', p])));
      if (type === 'FULL_ADDER') {
        c.wires.push(createWire('s', ['ref', 'S'], ['S', 'in']), createWire('co', ['ref', 'Cout'], ['Cout', 'in']));
      } else c.wires.push(createWire('f', ['ref', 'f'], ['F', 'in']));
      expect(gradeExercise(c, ex).correctRows).toBe(ex.outputs.length << ex.inputs.length);
    }
  });
});
