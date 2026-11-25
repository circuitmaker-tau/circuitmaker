/**
 * The ROM and PLA world (supervisor's review, 25.11; WK11A): the same
 * functions put in a ROM, by burning the OR array row by row (the truth
 * table), or in a PLA, by programming products in the AND plane and
 * connecting them to the outputs in the OR plane, with as few products as
 * possible. Every answer is checked, and a PLA is compared with the smallest p.
 */
import { useState } from 'react';
import type { Cube } from '../analysis/func';
import { checkPla, minimalPlaTerms, productText, readFunctions, romSize, rowBits, wrongRomCells } from '../analysis/romPla';
import type { FunctionSet, PlaTerm } from '../analysis/romPla';
import { WorldNav } from './WorldNav';
import { tr } from '../i18n/lang';

/** A 2-bit adder, A1A0 + B1B0 = S2S1S0 (exam 2020): its three outputs as lists of minterms. */
const ADDER = (() => {
  const lists = [[], [], []] as number[][];
  for (let m = 0; m < 16; m++) {
    const s = (m >> 2) + (m & 3);
    for (let b = 0; b < 3; b++) if ((s >> (2 - b)) & 1) lists[b].push(m);
  }
  return lists.map((l, b) => `S${2 - b}(A1,A0,B1,B0) = Σ(${l.join(',')})`).join('\n');
})();

const PROBLEMS: { id: string; label: [string, string]; text: string; mode: 'rom' | 'pla' }[] = [
  {
    id: 'fg',
    label: ['f ו-g מההרצאה (ROM 8×2)', 'f and g from the lecture (ROM 8×2)'],
    text: 'f(a,b,c) = Σ(0,2,4,6,7)\ng(a,b,c) = Σ(0,1,2,3,4,5)',
    mode: 'rom',
  },
  { id: 'adder', label: ['מחבר 2 ביט (2020)', 'A 2-bit adder (2020)'], text: ADDER, mode: 'rom' },
  { id: 'fa', label: ['מסכם מלא', 'A full adder'], text: 'S = A ⊕ B ⊕ C\nCout = AB + AC + BC', mode: 'pla' },
  { id: 'lecture', label: ['ההרצאה (2023א)', 'The lecture (2023, A)'], text: "f(a,b,c,d) = cb' + ab\ng(a,b,c,d) = a'b'cd", mode: 'pla' },
  { id: 'e24', label: ['2024 מועד ב', '2024, B'], text: "f2 = C'\nh = A' + C'", mode: 'pla' },
  {
    id: 'e22',
    label: ['2022 מועד ב: 4 מספרים ב-2sc', '2022, B: 4 numbers in 2sc'],
    text: "Out3(S1,S0) = S1'\nOut2(S1,S0) = S0\nOut1(S1,S0) = S0\nOut0(S1,S0) = 1",
    mode: 'pla',
  },
  {
    id: 's25',
    label: ['WK11A שקף 25', 'WK11A slide 25'],
    text: "O1(I1,I2,I3,I4) = I1I2 + I1'I2'I3'I4'\nO2(I1,I2,I3,I4) = I1I3' + I1'I3I4 + I2\nO3(I1,I2,I3,I4) = I1I2 + I1I1'I2'I4'",
    mode: 'pla',
  },
];

const read = (text: string): FunctionSet => {
  const r = readFunctions(text);
  if (!r.ok) throw new Error(r.error);
  return r.set;
};

/** "a = 1, b = 0" for row m */
const rowText = (set: FunctionSet, m: number) =>
  set.vars.map((v, k) => `${v} = ${rowBits(m, set.vars.length)[k]}`).join(', ');

function RomStep({ set }: { set: FunctionSet }) {
  const n = set.vars.length;
  const rows = 1 << n;
  const [burnt, setBurnt] = useState<boolean[][]>(() => Array.from({ length: rows }, () => set.fns.map(() => false)));
  const [words, setWords] = useState('');
  const [bits, setBits] = useState('');
  const [checked, setChecked] = useState(false);
  const size = romSize(set);
  const wrong = checked ? new Set(wrongRomCells(set, burnt)) : new Set<string>();
  const sizeOk = Number(words) === size.words && Number(bits) === size.bits;
  const done = checked && wrong.size === 0 && sizeOk;

  return (
    <section className="kmap-step" aria-label="ROM">
      <p className="hint">
        {tr(
          `ב-ROM המפענח קבוע: שורה לכל צירוף של ${set.vars.join(', ')}. מתכנתים את מערך ה-OR: בכל שורה "שורפים" חיבור (●) לכל יציאה שערכה 1. כך ה-ROM הוא בדיוק טבלת האמת.`,
          `In a ROM the decoder is fixed: a row for every combination of ${set.vars.join(', ')}. You program the OR array: in every row, "burn" a connection (●) for each output that is 1. So the ROM is exactly the truth table.`,
        )}
      </p>
      <div className="rom-size">
        <span>{tr('גודל ה-ROM:', 'ROM size:')}</span>
        <input
          inputMode="numeric"
          dir="ltr"
          size={3}
          value={words}
          aria-label={tr('מספר המילים', 'Number of words')}
          onChange={(e) => setWords(e.target.value.replace(/\D/g, ''))}
        />
        <span>×</span>
        <input
          inputMode="numeric"
          dir="ltr"
          size={2}
          value={bits}
          aria-label={tr('ביטים בכל מילה', 'Bits in each word')}
          onChange={(e) => setBits(e.target.value.replace(/\D/g, ''))}
        />
        <span className="hint">{tr('(מילים × ביטים)', '(words × bits)')}</span>
      </div>
      <div className="expr-table-wrap">
        <table className="truth-table rom-table" dir="ltr" aria-label={tr('מערך ה-OR של ה-ROM', 'The OR array of the ROM')}>
          <thead>
            <tr>
              <th className="truth-m">m</th>
              {set.vars.map((v) => (
                <th key={v}>{v}</th>
              ))}
              {set.fns.map((f, j) => (
                <th key={f.name} className={j === 0 ? 'truth-out' : undefined}>
                  {f.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }, (_, m) => (
              <tr key={m}>
                <td className="truth-m">{m}</td>
                {rowBits(m, n).map((b, k) => (
                  <td key={k}>{b}</td>
                ))}
                {set.fns.map((f, j) => {
                  const on = burnt[m][j];
                  const bad = wrong.has(`${m}:${j}`);
                  return (
                    <td key={f.name} className={j === 0 ? 'truth-out' : undefined}>
                      <button
                        type="button"
                        className={`rom-dot${on ? ' is-on' : ''}${bad ? ' is-wrong' : ''}`}
                        aria-pressed={on}
                        aria-label={tr(`${f.name} בשורה ${m}${bad ? ', שגוי' : ''}`, `${f.name} in row ${m}${bad ? ', wrong' : ''}`)}
                        onClick={() =>
                          setBurnt(burnt.map((r, i) => (i === m ? r.map((x, jj) => (jj === j ? !x : x)) : r)))
                        }
                      >
                        {on ? '●' : ''}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="kmap-actions">
        <button type="button" className="primary" onClick={() => setChecked(true)}>
          {tr('בדיקה', 'Check')}
        </button>
        <button
          type="button"
          onClick={() => {
            setBurnt(Array.from({ length: rows }, (_, m) => set.fns.map((f) => f.table[m] === 1)));
            setWords(String(size.words));
            setBits(String(size.bits));
            setChecked(true);
          }}
        >
          {tr('הצגת התשובה', 'Show the answer')}
        </button>
      </div>
      {checked && (
        <div className={`expr-verdict ${done ? 'is-same' : 'is-different'}`} role="status">
          {done ? (
            <>
              <strong>{tr('ה-ROM נכון', 'The ROM is right')}</strong>
              <bdi dir="ltr">
                {size.words}×{size.bits}
              </bdi>
              : {tr(`${n} כניסות כתובת נותנות`, `${n} address inputs give`)} 2<sup>{n}</sup> = {size.words}{' '}
              {tr('מילים, ובכל מילה ביט לכל פונקציה.', 'words, and every word has a bit for each function.')}
            </>
          ) : (
            <>
              <strong>{tr('עוד לא', 'Not yet')}</strong>
              <ul className="kmap-feedback">
                {wrong.size > 0 && (
                  <li>
                    {wrong.size === 1
                      ? tr('חיבור אחד לא נכון', 'One connection is wrong')
                      : tr(`${wrong.size} חיבורים לא נכונים`, `${wrong.size} connections are wrong`)}
                    {tr(
                      ', מסומנים באדום: חיבור שרוף הוא 1 ביציאה, וחסר חיבור הוא 0.',
                      ', marked in red: a burnt connection is a 1 at the output, and no connection is a 0.',
                    )}
                  </li>
                )}
                {!sizeOk && (
                  <li>
                    {tr(
                      'הגודל לא נכון. מספר המילים הוא מספר הכתובות (2 בחזקת מספר הכניסות), ורוחב המילה הוא מספר היציאות.',
                      'The size is wrong. The number of words is the number of addresses (2 to the number of inputs), and the width of a word is the number of outputs.',
                    )}
                  </li>
                )}
              </ul>
            </>
          )}
        </div>
      )}
    </section>
  );
}

const emptyTerm = (set: FunctionSet): PlaTerm => ({ cube: new Map(), outs: set.fns.map(() => false) });

function PlaStep({ set }: { set: FunctionSet }) {
  const n = set.vars.length;
  const [terms, setTerms] = useState<PlaTerm[]>(() => [emptyTerm(set)]);
  const [checked, setChecked] = useState(false);
  const feedback = checkPla(set, terms);

  const cycle = (i: number, k: number) =>
    setTerms(
      terms.map((t, ti) => {
        if (ti !== i) return t;
        const cube: Cube = new Map(t.cube);
        const v = cube.get(k);
        if (v === undefined) cube.set(k, 1);
        else if (v === 1) cube.set(k, 0);
        else cube.delete(k);
        return { ...t, cube };
      }),
    );
  const toggle = (i: number, j: number) =>
    setTerms(terms.map((t, ti) => (ti === i ? { ...t, outs: t.outs.map((o, jj) => (jj === j ? !o : o)) } : t)));

  const allRight = feedback.outputs.every((o) => o === null);

  return (
    <section className="kmap-step" aria-label="PLA">
      <p className="hint">
        {tr(
          'כל שורה היא מכפלה P במישור ה-AND: לחיצה על משתנה מחליפה בין לא מחובר, המשתנה, והמשלים שלו (שורה בלי משתנים היא הקבוע 1). במישור ה-OR מחברים (●) כל מכפלה ליציאות שהיא משתתפת בהן. המטרה: כמה שפחות מכפלות (p), גם אם זה אומר לשתף מכפלה שלא נראית בביטוי המינימלי של פונקציה.',
          'Every row is a product P in the AND plane: clicking a variable goes through not connected, the variable, and its complement (a row with no variables is the constant 1). In the OR plane, connect (●) each product to the outputs it takes part in. The aim: as few products (p) as possible, even if that means sharing a product that is not in the minimal expression of a function.',
        )}
      </p>
      <div className="expr-table-wrap">
        <table className="truth-table pla-table" dir="ltr" aria-label={tr('מישורי ה-AND וה-OR', 'The AND and OR planes')}>
          <thead>
            <tr>
              <th className="truth-m" />
              <th colSpan={n}>AND</th>
              <th colSpan={set.fns.length} className="truth-out">
                OR
              </th>
              <th aria-hidden />
            </tr>
            <tr>
              <th className="truth-m">P</th>
              {set.vars.map((v) => (
                <th key={v}>{v}</th>
              ))}
              {set.fns.map((f, j) => (
                <th key={f.name} className={j === 0 ? 'truth-out' : undefined}>
                  {f.name}
                </th>
              ))}
              <th aria-hidden />
            </tr>
          </thead>
          <tbody>
            {terms.map((t, i) => (
              <tr key={i} className={feedback.unused.includes(i) || feedback.duplicate.includes(i) ? 'is-diff' : undefined}>
                <th className="truth-m" title={productText(set, t.cube)}>
                  P{i + 1}
                </th>
                {set.vars.map((v, k) => {
                  const bit = t.cube.get(k);
                  return (
                    <td key={v}>
                      <button
                        type="button"
                        className={`pla-lit${bit === undefined ? '' : ' is-on'}`}
                        aria-label={`P${i + 1}, ${v}: ${bit === undefined ? tr('לא מחובר', 'not connected') : bit === 1 ? v : `${v}'`}`}
                        onClick={() => cycle(i, k)}
                      >
                        {bit === undefined ? '' : bit === 1 ? v : `${v}'`}
                      </button>
                    </td>
                  );
                })}
                {set.fns.map((f, j) => (
                  <td key={f.name} className={j === 0 ? 'truth-out' : undefined}>
                    <button
                      type="button"
                      className={`rom-dot${t.outs[j] ? ' is-on' : ''}`}
                      aria-pressed={t.outs[j]}
                      aria-label={tr(`P${i + 1} אל ${f.name}`, `P${i + 1} to ${f.name}`)}
                      onClick={() => toggle(i, j)}
                    >
                      {t.outs[j] ? '●' : ''}
                    </button>
                  </td>
                ))}
                <td>
                  <button
                    type="button"
                    className="kmap-remove"
                    aria-label={tr(`הסרת P${i + 1}`, `Remove P${i + 1}`)}
                    onClick={() => setTerms(terms.filter((_, ti) => ti !== i))}
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="pla-formulas" dir="ltr">
        {set.fns.map((f, j) => {
          const used = terms.flatMap((t, i) => (t.outs[j] ? [i] : []));
          return (
            <p key={f.name} className="analysis-func">
              {f.name} = {used.length ? used.map((i) => productText(set, terms[i].cube)).join(' + ') : '0'}
            </p>
          );
        })}
      </div>
      <div className="kmap-actions">
        <button type="button" onClick={() => setTerms([...terms, emptyTerm(set)])}>
          {tr('הוספת מכפלה', 'Add a product')}
        </button>
        <button type="button" className="primary" onClick={() => setChecked(true)}>
          {tr('בדיקה', 'Check')}
        </button>
        <button
          type="button"
          onClick={() => {
            setTerms(minimalPlaTerms(set));
            setChecked(true);
          }}
        >
          {tr('הצגת פתרון', 'Show a solution')}
        </button>
        <button
          type="button"
          onClick={() => {
            setTerms([emptyTerm(set)]);
            setChecked(false);
          }}
        >
          {tr('ניקוי', 'Clear')}
        </button>
      </div>
      {checked && (
        <div className={`expr-verdict ${feedback.done ? 'is-same' : 'is-different'}`} role="status">
          {feedback.done ? (
            <>
              <strong>{tr('PLA מינימלי', 'A minimal PLA')}</strong>
              <bdi dir="ltr">
                n×m×p = {n}×{set.fns.length}×{feedback.p}
              </bdi>
              :{' '}
              {tr(
                `${n} כניסות, ${set.fns.length} יציאות ו-${feedback.p} מכפלות, הכי מעט שאפשר.`,
                `${n} inputs, ${set.fns.length} outputs and ${feedback.p} products, the fewest possible.`,
              )}
            </>
          ) : (
            <>
              <strong>{allRight ? tr('הפונקציות נכונות', 'The functions are right') : tr('עוד לא', 'Not yet')}</strong>
              <ul className="kmap-feedback">
                {feedback.outputs.map((o, j) =>
                  o ? (
                    <li key={`o${j}`}>
                      {set.fns[j].name} {tr('לא נכונה: כש-', 'is wrong: with ')}
                      <bdi dir="ltr">{rowText(set, o.m)}</bdi>
                      {tr(` יוצא ${o.got}, וצריך ${o.want}.`, ` it gives ${o.got}, and should give ${o.want}.`)}
                    </li>
                  ) : null,
                )}
                {feedback.unused.map((i) => (
                  <li key={`u${i}`}>
                    {tr(`P${i + 1} לא מחוברת לאף יציאה, ולכן אין בה צורך.`, `P${i + 1} feeds no output, so it is not needed.`)}
                  </li>
                ))}
                {feedback.duplicate.map((i) => (
                  <li key={`d${i}`}>
                    {tr(
                      `P${i + 1} זהה למכפלה קודמת. מכפלה אחת יכולה להזין כמה יציאות.`,
                      `P${i + 1} is the same as an earlier product. One product can feed several outputs.`,
                    )}
                  </li>
                ))}
                {allRight && feedback.p > feedback.minimalP && (
                  <li>
                    {tr(
                      `יש לכם p = ${feedback.p}, ואפשר ב-p = ${feedback.minimalP}. חפשו מכפלה שאפשר לשתף בין הפונקציות.`,
                      `You have p = ${feedback.p}, and p = ${feedback.minimalP} will do. Look for a product the functions can share.`,
                    )}
                  </li>
                )}
              </ul>
            </>
          )}
        </div>
      )}
    </section>
  );
}

export function RomWorld({ onHome, onHelp }: { onHome: () => void; onHelp: () => void }) {
  const [problem, setProblem] = useState(PROBLEMS[0].id);
  const [text, setText] = useState(PROBLEMS[0].text);
  const [set, setSet] = useState<FunctionSet>(() => read(PROBLEMS[0].text));
  const [mode, setMode] = useState<'rom' | 'pla'>('rom');
  const [error, setError] = useState<string | null>(null);
  // a new problem starts the steps afresh
  const [version, setVersion] = useState(0);

  const load = (next: string, id: string, nextMode?: 'rom' | 'pla') => {
    const r = readFunctions(next);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setError(null);
    setText(next);
    setProblem(id);
    setSet(r.set);
    if (nextMode) setMode(nextMode);
    setVersion((v) => v + 1);
  };

  return (
    <div className="app">
      <header className="topbar">
        <h1>
          <button type="button" className="home-link" onClick={onHome} aria-label={tr('דף הבית', 'Home page')}>
            CircuitMaker
          </button>
        </h1>
        <div className="actions">
          <button type="button" onClick={onHelp} title={tr('מדריך למשתמש', 'User guide')}>
            {tr('עזרה', 'Help')}
          </button>
        </div>
      </header>
      <WorldNav current="rom" />

      <div className="expr-world">
        <main className="expr-main kmap-world">
          <h2>{tr('ROM ו-PLA', 'ROM and PLA')}</h2>
          <p className="hint">
            {tr(
              'אותן פונקציות בשתי דרכים: ב-ROM (מפענח קבוע של כל המינטרמים ומערך OR מתוכנת) וב-PLA (מישור AND ומישור OR מתוכנתים, עם כמה שפחות מכפלות).',
              'The same functions in two ways: in a ROM (a fixed decoder of every minterm and a programmed OR array) and in a PLA (programmed AND and OR planes, with as few products as possible).',
            )}
          </p>

          <div className="kmap-source">
            <span>{tr('שאלה:', 'Question:')}</span>
            {PROBLEMS.map((p) => (
              <button key={p.id} type="button" aria-pressed={problem === p.id} onClick={() => load(p.text, p.id, p.mode)}>
                {tr(...p.label)}
              </button>
            ))}
          </div>
          <form
            className="rom-own"
            onSubmit={(e) => {
              e.preventDefault();
              load(text, 'own');
            }}
          >
            <label className="expr-field">
              <span>
                {tr('הפונקציות (אחת בכל שורה, עד 4 משתנים ו-4 פונקציות)', 'The functions (one per line, up to 4 variables and 4 functions)')}
              </span>
              <textarea
                dir="ltr"
                rows={Math.min(4, Math.max(2, text.split('\n').length))}
                spellCheck={false}
                value={text}
                onChange={(e) => setText(e.target.value)}
                aria-invalid={error ? true : undefined}
                aria-describedby="rom-error"
              />
            </label>
            <button type="submit">{tr('טעינה', 'Load')}</button>
            <p id="rom-error" className="expr-error">
              {error}
            </p>
          </form>

          <div className="kmap-steps" role="tablist" aria-label={tr('מימוש', 'Implementation')}>
            <button type="button" role="tab" aria-selected={mode === 'rom'} onClick={() => setMode('rom')}>
              ROM
            </button>
            <button type="button" role="tab" aria-selected={mode === 'pla'} onClick={() => setMode('pla')}>
              PLA
            </button>
          </div>
          {mode === 'rom' ? <RomStep key={`r${version}`} set={set} /> : <PlaStep key={`p${version}`} set={set} />}
        </main>
      </div>
    </div>
  );
}
