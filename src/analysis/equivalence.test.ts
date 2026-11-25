import { describe, expect, it } from 'vitest';
import { assignment, compareFunctions } from './equivalence';

const ok = (a: string, b: string) => {
  const r = compareFunctions(a, b);
  if (!r.ok) throw new Error(r.error);
  return r;
};

describe('two ways to write a function', () => {
  it('finds the laws of Boolean algebra equivalent', () => {
    // distributive law of + over ·, De Morgan, consensus, XOR as a sum of products
    expect(ok('A + BC', '(A + B)(A + C)').equivalent).toBe(true);
    expect(ok("(AB)'", "A' + B'").equivalent).toBe(true);
    expect(ok("AB + A'C + BC", "AB + A'C").equivalent).toBe(true);
    expect(ok('A ⊕ B', "AB' + A'B").equivalent).toBe(true);
    expect(ok("X0X1 + X1'X2", 'F(X2,X1,X0) = Σ(3,4,5,7)').equivalent).toBe(true);
  });

  it('gives the rows where they differ, on the shared variables', () => {
    // the common mistake: (A + B)' is A'B', not A' + B'
    const r = ok("(A + B)'", "A' + B'");
    expect(r.equivalent).toBe(false);
    expect(r.vars).toEqual(['A', 'B']);
    expect(r.differences.map((d) => d.m)).toEqual([1, 2]);
    expect(assignment(r.vars, r.differences[0])).toBe('A = 0, B = 1');
    expect([r.differences[0].a, r.differences[0].b]).toEqual([0, 1]);
  });

  it('puts both on all the variables used by either', () => {
    // absorption: A + A'B = A + B; and a C on one side only is a real difference
    expect(ok("A + A'B", 'A + B').equivalent).toBe(true);
    const r = ok('A + B', 'A + B + C');
    expect(r.vars).toEqual(['A', 'B', 'C']);
    expect(r.differences.map((d) => d.m)).toEqual([1]);
    // a variable that cancels out: AC + AC' = A
    expect(ok("AC + AC'", 'A').equivalent).toBe(true);
  });

  it('numbers a list without variables on the variables of the other side', () => {
    // Σ(1,2,3) alone would be on A, B; next to a function of A, B, C it is on A, B, C
    expect(ok("A'C + A'B", 'Σ(1,2,3)').equivalent).toBe(true);
    expect(ok('F = Π(0,2,4,6)', 'C').equivalent).toBe(true);
  });

  it("does not count a don't care as a difference", () => {
    const r = ok('F(A,B,C,D) = Σ(2,3,4,5,10,11,15) + d(14)', "A'BC' + AC + B'C");
    expect(r.equivalent).toBe(true);
    expect(r.dontCares).toBe(1);
    expect(ok('F(A,B) = Σ(3) + d(1)', 'B').equivalent).toBe(true);
    expect(ok('F(A,B) = Σ(3) + d(1)', 'A').equivalent).toBe(false);
  });

  it('says which side cannot be read', () => {
    const r = compareFunctions('A + (B', 'A');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.side).toBe('a');
    const s = compareFunctions('A', 'B +');
    if (!s.ok) expect(s.side).toBe('b');
    const t = compareFunctions('ABCD', 'EFG');
    expect(t.ok).toBe(false);
    if (!t.ok) expect(t.error).toContain('7');
  });
});
