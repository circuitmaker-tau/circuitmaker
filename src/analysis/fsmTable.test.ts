import { describe, expect, it } from 'vitest';
import { bambaFsm, detector0101 } from '../examples/fsm';
import { planeFsm, wk5Levels } from '../examples/exams';
import { checkDiagram, code, fsmProblem, fsmTable, transitionsOf } from './fsmTable';

const ns = (t: ReturnType<typeof fsmTable>) =>
  t.next.map((row) => row.map((s) => s.join('')));
const z = (t: ReturnType<typeof fsmTable>) => t.out.map((row) => row.map((o) => o.join('')));

describe('the state table of a machine', () => {
  it('the bamba machine (WK9B, slide 34): NS and z for x = 0 and x = 1', () => {
    const t = fsmTable(bambaFsm);
    expect(t.flipFlops).toEqual(['y1', 'y2']);
    expect(t.inputs).toEqual(['X']);
    expect(ns(t)).toEqual([
      ['00', '01'],
      ['00', '10'],
      ['00', '11'],
      ['00', '00'],
    ]);
    expect(z(t)).toEqual([
      ['0', '0'],
      ['0', '0'],
      ['1', '0'],
      ['1', '0'],
    ]);
    expect(t.mealy).toBe(true);
  });

  it('the 0101 detector (WK9A): the table follows the equations of the analysis', () => {
    const t = fsmTable(detector0101);
    for (let s = 0; s < 4; s++) {
      const [y1, y2] = [s >> 1, s & 1];
      for (let x = 0; x < 2; x++) {
        // J = xy2, K = x + y2', D = x'y2' + y1'y2, z = xy1y2'
        const j = x & y2;
        const k = x | (1 - y2);
        const Y1 = (j & (1 - y1)) | ((1 - k) & y1);
        const Y2 = ((1 - x) & (1 - y2)) | ((1 - y1) & y2);
        expect(ns(t)[s][x]).toBe(`${Y1}${Y2}`);
        expect(z(t)[s][x]).toBe(String(x & y1 & (1 - y2)));
      }
    }
  });

  it('the airplane machine (2026A Q3): two inputs, and Z as in the solution', () => {
    const t = fsmTable(planeFsm);
    expect(t.inputs).toEqual(['XL', 'XR']);
    expect(t.next[0]).toHaveLength(4);
    for (let s = 0; s < 4; s++) {
      const y2 = s & 1;
      for (let x = 0; x < 4; x++) {
        const [xl, xr] = [x >> 1, x & 1];
        // Z = y2'XR' + y2'XL' + XL'XR'
        const want = ((1 - y2) & (1 - xr)) | ((1 - y2) & (1 - xl)) | ((1 - xl) & (1 - xr));
        expect(z(t)[s][x]).toBe(String(want));
        // S and R are never both 1, so the next state is always known
        expect(ns(t)[s][x]).not.toContain('X');
      }
    }
  });

  it('says when a circuit is not a machine', () => {
    expect(fsmProblem(bambaFsm)).toBeNull();
    expect(fsmProblem(wk5Levels)).toContain('flip-flop');
  });

  it('checks a drawn diagram arrow by arrow', () => {
    const t = fsmTable(bambaFsm);
    const all = transitionsOf(t);
    expect(all).toHaveLength(8);
    expect(checkDiagram(t, all).done).toBe(true);

    const drawn = all.filter((a) => !(a.from === 0 && a.input === 1)).map((a) => ({ ...a }));
    // 10 on x = 1 goes to 11, not 00
    const i = drawn.findIndex((a) => a.from === 2 && a.input === 1);
    drawn[i] = { ...drawn[i], to: 0 };
    drawn.push({ ...drawn[0] });
    const f = checkDiagram(t, drawn);
    expect(f.missing).toEqual([{ from: 0, input: 1 }]);
    expect(f.wrong).toEqual([{ index: i, to: 3, output: '0' }]);
    expect(f.duplicate).toEqual([drawn.length - 1]);
    expect(f.done).toBe(false);
    expect(code(2, 2)).toBe('10');
  });
});
