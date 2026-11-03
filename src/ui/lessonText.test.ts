import { describe, expect, it } from 'vitest';
import { EXAMPLES } from '../examples';
import { splitLesson } from './lessonText';

describe('lesson text', () => {
  it('keeps a formula with its commas and primes in one left-to-right piece', () => {
    const ltr = splitLesson("מהמפות: T1 = x'y1 + xy2, T2 = x + y2, z = x'y1 (מכונת Mealy)")
      .filter((p) => p.ltr)
      .map((p) => p.text);
    expect(ltr).toEqual(["T1 = x'y1 + xy2, T2 = x + y2, z = x'y1", 'Mealy']);
  });

  it('a state path stays in order', () => {
    const ltr = splitLesson('בדיאגרמה: a → b → d → c, ו-Z = 1')
      .filter((p) => p.ltr)
      .map((p) => p.text);
    expect(ltr).toEqual(['a → b → d → c', 'Z = 1']);
  });

  it('loses no text in any example', () => {
    for (const ex of EXAMPLES) {
      expect(
        splitLesson(ex.lesson)
          .map((p) => p.text)
          .join(''),
      ).toBe(ex.lesson);
    }
  });
});
