/**
 * Truth tables of the combinational blocks (TEST_CIRCUITS B1) and the X rules
 * of COMPONENT_SPEC E7. Port order follows catalog.ts; index 0 is the LSB.
 */
import { describe, expect, it } from 'vitest';
import { evalBlock, expand } from './behavior';
import type { Logic } from './logic';

/** All 2^n input rows, row i has bit k = (i >> k) & 1. */
const rows = (n: number) =>
  Array.from({ length: 1 << n }, (_, i) =>
    Array.from({ length: n }, (_, k) => ((i >> k) & 1) as 0 | 1),
  );

/** Minterms (A = MSB) where output `out` is 1, for inputs given LSB first. */
function minterms(type: Parameters<typeof evalBlock>[0], n: number, width: number, out: number) {
  return rows(n)
    .filter((r) => evalBlock(type, r, width)[out] === 1)
    .map((r) => r.reduceRight<number>((m, b) => m * 2 + b, 0))
    .sort((a, b) => a - b);
}

describe('adders', () => {
  it('half adder: S = A ⊕ B, C = AB', () => {
    expect(minterms('HALF_ADDER', 2, 2, 0)).toEqual([1, 2]);
    expect(minterms('HALF_ADDER', 2, 2, 1)).toEqual([3]);
  });

  it('full adder: S = Σ(1,2,4,7), Cout = Σ(3,5,6,7)', () => {
    expect(minterms('FULL_ADDER', 3, 2, 0)).toEqual([1, 2, 4, 7]);
    expect(minterms('FULL_ADDER', 3, 2, 1)).toEqual([3, 5, 6, 7]);
  });
});

describe('multiplexers', () => {
  it('MUX 4:1 selects I(S1S0), so S1S0 = 01 picks I1', () => {
    for (let sel = 0; sel < 4; sel++) {
      const data: Logic[] = [0, 0, 0, 0];
      data[sel] = 1;
      expect(evalBlock('MUX4', [...data, (sel & 1) as 0 | 1, (sel >> 1) as 0 | 1], 1)).toEqual([1]);
    }
  });

  it('MUX 8:1 over every data word and select', () => {
    for (const s of rows(3)) {
      const sel = s[0] + 2 * s[1] + 4 * s[2];
      for (const d of rows(8)) expect(evalBlock('MUX8', [...d, ...s], 1)).toEqual([d[sel]]);
    }
  });

  it('MUX 16:1 with constants gives F = Σ(0,1,3,6,7,8,11,12,14) (WK6B, TEST_CIRCUITS B2.1)', () => {
    const minterms = [0, 1, 3, 6, 7, 8, 11, 12, 14];
    const data = Array.from({ length: 16 }, (_, k) => (minterms.includes(k) ? 1 : 0) as Logic);
    for (let m = 0; m < 16; m++) {
      const s = [0, 1, 2, 3].map((b) => ((m >> b) & 1) as Logic); // S0 = LSB
      expect(evalBlock('MUX16', [...data, ...s], 1)).toEqual([minterms.includes(m) ? 1 : 0]);
    }
  });

  it('select X: the output is defined only when every selectable input agrees (E7)', () => {
    expect(evalBlock('MUX2', [1, 1, 'X'], 1)).toEqual([1]);
    expect(evalBlock('MUX2', [0, 1, 'X'], 1)).toEqual(['X']);
    expect(evalBlock('MUX4', [1, 1, 0, 0, 'X', 0], 1)).toEqual([1]); // S0 = X, S1 = 0
  });

  it('an X on an input that is not selected does not matter', () => {
    expect(evalBlock('MUX2', [1, 'X', 0], 1)).toEqual([1]);
    expect(evalBlock('MUX2', [1, 'X', 1], 1)).toEqual(['X']);
  });
});

describe('decoders', () => {
  it('DEC 3:8: Di = En·mi', () => {
    for (const s of rows(3)) {
      const n = s[0] + 2 * s[1] + 4 * s[2];
      const out = evalBlock('DEC3x8', [...s, 1], 8);
      expect(out).toEqual(out.map((_, i) => (i === n ? 1 : 0)));
      expect(evalBlock('DEC3x8', [...s, 0], 8)).toEqual(Array(8).fill(0));
    }
  });

  it('En = X: only the output that could be 1 is X (E7)', () => {
    expect(evalBlock('DEC2x4', [1, 0, 'X'], 4)).toEqual([0, 'X', 0, 0]);
    expect(evalBlock('DEC2x4', ['X', 0, 1], 4)).toEqual(['X', 'X', 0, 0]);
  });
});

describe('encoders (exam 2026A, 2C)', () => {
  it('a plain encoder is defined only for exactly one 1', () => {
    expect(evalBlock('ENC4x2', [0, 0, 1, 0, 1], 2)).toEqual([1, 0]);
    expect(evalBlock('ENC4x2', [0, 1, 1, 0, 1], 2)).toEqual(['X', 'X']);
    expect(evalBlock('ENC4x2', [0, 0, 0, 0, 1], 2)).toEqual(['X', 'X']);
    expect(evalBlock('ENC4x2', [0, 1, 1, 0, 0], 2)).toEqual([0, 0]); // En = 0
  });

  it('priority encoder: the highest 1 wins, V = 0 when none is on (recitation 7)', () => {
    for (const d of rows(4)) {
      const top = d.lastIndexOf(1);
      const expected = top < 0 ? [0, 0, 0] : [top >> 1, top & 1, 1];
      expect(evalBlock('PRIORITY_ENC4x2', [...d, 1], 3)).toEqual(expected);
      // X1 = D3 + D2, X0 = D3 + D1·D2'
      expect(expected[0]).toBe(d[3] | d[2]);
      expect(expected[1]).toBe(d[3] | (d[1] & (1 - d[2])));
    }
  });
});

describe('expand', () => {
  it('gives up beyond 12 unknowns instead of trying 2^n cases', () => {
    expect(expand(Array<Logic>(13).fill('X'), 2, () => [0, 0])).toEqual(['X', 'X']);
  });
});
