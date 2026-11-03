import { describe, expect, it } from 'vitest';
import { evalGate, type GateType, type Logic } from './logic';

const bits: Logic[] = [0, 1];

describe('two-valued truth tables', () => {
  const expected: Record<Exclude<GateType, 'NOT' | 'BUF'>, (a: 0 | 1, b: 0 | 1) => 0 | 1> = {
    AND: (a, b) => (a & b) as 0 | 1,
    OR: (a, b) => (a | b) as 0 | 1,
    NAND: (a, b) => (1 - (a & b)) as 0 | 1,
    NOR: (a, b) => (1 - (a | b)) as 0 | 1,
    XOR: (a, b) => (a ^ b) as 0 | 1,
    XNOR: (a, b) => (1 - (a ^ b)) as 0 | 1,
  };

  for (const [type, f] of Object.entries(expected)) {
    for (const a of bits as (0 | 1)[]) {
      for (const b of bits as (0 | 1)[]) {
        it(`${type}(${a},${b}) = ${f(a, b)}`, () => {
          expect(evalGate(type as GateType, [a, b])).toBe(f(a, b));
        });
      }
    }
  }

  it('NOT and BUF', () => {
    expect(evalGate('NOT', [0])).toBe(1);
    expect(evalGate('NOT', [1])).toBe(0);
    expect(evalGate('BUF', [1])).toBe(1);
  });

  it('three-input XOR is odd parity', () => {
    expect(evalGate('XOR', [1, 1, 1])).toBe(1);
    expect(evalGate('XOR', [1, 1, 0])).toBe(0);
  });
});

describe('X handling (rule E7)', () => {
  it('controlling values win over X', () => {
    expect(evalGate('AND', [0, 'X'])).toBe(0);
    expect(evalGate('NAND', [0, 'X'])).toBe(1);
    expect(evalGate('OR', [1, 'X'])).toBe(1);
    expect(evalGate('NOR', [1, 'X'])).toBe(0);
  });

  it('non-controlling values propagate X', () => {
    expect(evalGate('AND', [1, 'X'])).toBe('X');
    expect(evalGate('OR', [0, 'X'])).toBe('X');
    expect(evalGate('NOT', ['X'])).toBe('X');
  });

  it('XOR family has no controlling value', () => {
    expect(evalGate('XOR', [0, 'X'])).toBe('X');
    expect(evalGate('XNOR', [1, 'X'])).toBe('X');
  });

  it('rejects a wrong number of inputs', () => {
    expect(() => evalGate('AND', [1])).toThrow();
    expect(() => evalGate('NOT', [0, 1])).toThrow();
  });
});
