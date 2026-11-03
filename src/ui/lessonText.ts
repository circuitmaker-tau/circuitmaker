/**
 * A lesson is Hebrew with formulas inside ("מהמפות: T1 = x'y1 + xy2, T2 = x + y2").
 * In a right-to-left paragraph the browser reorders the formula's parts, so
 * each Latin run (letters, digits and the symbols between them) is shown as
 * one left-to-right piece.
 */
const LATIN_RUN = /[A-Za-z0-9(][A-Za-z0-9'·⊕+=→ ,()\-:.]*[A-Za-z0-9')]|[A-Za-z0-9]/g;

export interface Piece {
  text: string;
  ltr: boolean;
}

export function splitLesson(text: string): Piece[] {
  const pieces: Piece[] = [];
  let last = 0;
  for (const m of text.matchAll(LATIN_RUN)) {
    let run = m[0];
    // a closing parenthesis that belongs to the Hebrew around it: "(מכונת Mealy)"
    while (run.length > 1 && run.endsWith(')') && count(run, '(') < count(run, ')')) {
      run = run.slice(0, -1).trimEnd();
    }
    if (m.index > last) pieces.push({ text: text.slice(last, m.index), ltr: false });
    pieces.push({ text: run, ltr: true });
    last = m.index + run.length;
  }
  if (last < text.length) pieces.push({ text: text.slice(last), ltr: false });
  return pieces;
}

const count = (s: string, ch: string) => s.split(ch).length - 1;
