/**
 * The Boolean expressions world (supervisor's review, 25.11): write a function
 * in two ways and see whether they are the same function. When they are not,
 * the rows of the truth table where they differ are the counterexample.
 */
import { useState } from 'react';
import { assignment, compareFunctions } from '../analysis/equivalence';
import type { ComparedRow } from '../analysis/equivalence';
import { parseFunction } from '../analysis/expression';
import type { ParsedFunction } from '../analysis/expression';
import { minterms } from '../analysis/format';
import { circuitFromFunction, describe, formFor } from '../analysis/fromFunction';
import type { Value } from '../analysis/minimize';
import { useCircuitStore } from '../store/circuitStore';
import { WorldNav } from './WorldNav';
import { tr } from '../i18n/lang';

/** Pairs from the Boolean algebra of the course: laws, and one common mistake. */
const PAIRS: { label: [string, string]; a: string; b: string }[] = [
  { label: ['פילוג', 'Distributive'], a: 'A + BC', b: '(A + B)(A + C)' },
  { label: ['דה מורגן', 'De Morgan'], a: "(AB)'", b: "A' + B'" },
  { label: ['טעות נפוצה', 'A common mistake'], a: "(A + B)'", b: "A' + B'" },
  { label: ['קונצנזוס', 'Consensus'], a: "AB + A'C + BC", b: "AB + A'C" },
  { label: ['XOR', 'XOR'], a: 'A ⊕ B', b: "AB' + A'B" },
  { label: ['עם d', "With don't cares"], a: 'F(A,B,C,D) = Σ(2,3,4,5,10,11,15) + d(14)', b: "A'BC' + AC + B'C" },
];

const cell = (v: Value) => (v === 'd' ? 'd' : String(v));
const ones = (fn: ParsedFunction) => fn.table.flatMap((v, m) => (v === 1 ? [m] : []));
const dontCares = (fn: ParsedFunction) => fn.table.flatMap((v, m) => (v === 'd' ? [m] : []));

function Verdict({ vars, rows, differences, dontCares: dc }: {
  vars: string[];
  rows: ComparedRow[];
  differences: ComparedRow[];
  dontCares: number;
}) {
  if (differences.length === 0) {
    return (
      <div className="expr-verdict is-same" role="status">
        <strong>{tr('שקולים: זו אותה פונקציה', 'Equivalent: the same function')}</strong>
        {tr(
          `שני הביטויים נותנים אותו ערך בכל ${rows.length} השורות של טבלת האמת`,
          `Both expressions give the same value in all ${rows.length} rows of the truth table`,
        )}
        {dc > 0 &&
          (dc === 1
            ? tr(', פרט לשורה אחת עם d, שבה כל ערך מתאים', ", except one row with a don't care, where any value fits")
            : tr(`, פרט ל-${dc} שורות עם d, שבהן כל ערך מתאים`, `, except ${dc} rows with don't cares, where any value fits`))}
        .
      </div>
    );
  }
  const first = differences[0];
  return (
    <div className="expr-verdict is-different" role="status">
      <strong>{tr('לא שקולים', 'Not equivalent')}</strong>
      {tr('למשל כש-', 'For example, with ')}
      <bdi dir="ltr">{assignment(vars, first)}</bdi>
      {tr(
        `: הביטוי הראשון נותן ${cell(first.a)}, והשני נותן ${cell(first.b)}.`,
        ` the first expression gives ${cell(first.a)}, and the second ${cell(first.b)}.`,
      )}{' '}
      {differences.length === 1 ? (
        tr('זו השורה היחידה שבה הם שונים.', 'This is the only row where they differ.')
      ) : (
        <>
          {tr(
            `הם שונים ב-${differences.length} מתוך ${rows.length} השורות (`,
            `They differ in ${differences.length} of the ${rows.length} rows (`,
          )}
          <bdi dir="ltr">m = {differences.map((d) => d.m).join(', ')}</bdi>).
        </>
      )}
    </div>
  );
}

function Form({ title, fn, onOpen }: { title: string; fn: ParsedFunction; onOpen: () => void }) {
  const d = dontCares(fn);
  return (
    <section className="expr-form">
      <h3>{title}</h3>
      <p className="analysis-func" dir="ltr">
        {fn.name}({fn.vars.join(', ')}) = {minterms(ones(fn))}
        {d.length > 0 && ` + d(${d.join(', ')})`}
      </p>
      <p className="analysis-func" dir="ltr">
        {fn.name} = {describe(formFor(fn, 'sop'))}
      </p>
      <button type="button" onClick={onOpen}>
        {tr('פתיחה כמעגל', 'Open as a circuit')}
      </button>
    </section>
  );
}

export function ExpressionsWorld({ onHome, onHelp }: { onHome: () => void; onHelp: () => void }) {
  const [a, setA] = useState(PAIRS[0].a);
  const [b, setB] = useState(PAIRS[0].b);
  const filled = a.trim() !== '' && b.trim() !== '';
  const result = filled ? compareFunctions(a, b) : null;
  const errorA = result && !result.ok && result.side !== 'b' ? result.error : null;
  const errorB = result && !result.ok && result.side === 'b' ? result.error : null;
  // with both unreadable, each field gets its own message
  const errorBoth = result && !result.ok && result.side === 'both' ? parseFunction(b) : null;

  const open = (text: string, lifted: ParsedFunction) => {
    // a written expression is built as written, on its own variables; a list on the shared ones
    const own = parseFunction(text);
    const fn = own.ok && own.fn.expr ? own.fn : lifted;
    const circuit = circuitFromFunction(fn, fn.expr ? 'written' : 'sop');
    useCircuitStore
      .getState()
      .loadCircuit(
        circuit,
        tr(
          `נבנה מהביטוי ${text.trim()} בעולם הביטויים הבוליאניים. המתגים הם ${fn.vars.join(', ')}. Ctrl+Z מחזיר את המעגל הקודם.`,
          `Built from the expression ${text.trim()} in the Boolean expressions world. The switches are ${fn.vars.join(', ')}. Ctrl+Z brings the previous circuit back.`,
        ),
      );
    window.location.hash = '#/editor';
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
      <WorldNav current="expressions" />

      <div className="expr-world">
        <main className="expr-main">
          <h2>{tr('אותה פונקציה בשתי כתיבות?', 'The same function, written two ways?')}</h2>
          <p className="hint">
            {tr(
              'כותבים שני ביטויים כמו בקורס: גרש הוא NOT, צמידות היא AND, + הוא OR, ⊕ או ^ הוא XOR, ואפשר סוגריים. אפשר גם רשימת מינטרמים, כמו',
              "Write two expressions as in the course: ' is NOT, writing side by side is AND, + is OR, ⊕ or ^ is XOR, and brackets are fine. A list of minterms works too, like",
            )}{' '}
            <bdi dir="ltr" className="expr-code">
              Σ(1,3) + d(5)
            </bdi>
            {tr(', או מקסטרמים,', ', or of maxterms,')}{' '}
            <bdi dir="ltr" className="expr-code">
              Π(0,2)
            </bdi>
            {tr(
              '. הבדיקה עוברת על כל שורות טבלת האמת של המשתנים של שני הביטויים יחד.',
              '. The check goes over every row of the truth table of the variables of both expressions together.',
            )}
          </p>

          <div className="expr-inputs">
            <label className="expr-field">
              <span>{tr('ביטוי ראשון', 'First expression')}</span>
              <input
                type="text"
                dir="ltr"
                spellCheck={false}
                autoComplete="off"
                value={a}
                onChange={(e) => setA(e.target.value)}
                aria-invalid={errorA ? true : undefined}
                aria-describedby="expr-error-a"
              />
              <p id="expr-error-a" className="expr-error">
                {errorA}
              </p>
            </label>
            <label className="expr-field">
              <span>{tr('ביטוי שני', 'Second expression')}</span>
              <input
                type="text"
                dir="ltr"
                spellCheck={false}
                autoComplete="off"
                value={b}
                onChange={(e) => setB(e.target.value)}
                aria-invalid={errorB || (errorBoth && !errorBoth.ok) ? true : undefined}
                aria-describedby="expr-error-b"
              />
              <p id="expr-error-b" className="expr-error">
                {errorB ?? (errorBoth && !errorBoth.ok ? errorBoth.error : null)}
              </p>
            </label>
          </div>

          <div className="expr-examples">
            <span>{tr('דוגמאות:', 'Examples:')}</span>
            {PAIRS.map((p) => (
              <button
                key={p.label[1]}
                type="button"
                onClick={() => {
                  setA(p.a);
                  setB(p.b);
                }}
              >
                {tr(...p.label)}
              </button>
            ))}
          </div>

          {result?.ok && (
            <>
              <Verdict
                vars={result.vars}
                rows={result.rows}
                differences={result.differences}
                dontCares={result.dontCares}
              />
              <div className="expr-forms">
                <Form title={tr('הביטוי הראשון', 'The first expression')} fn={result.a} onOpen={() => open(a, result.a)} />
                <Form title={tr('הביטוי השני', 'The second expression')} fn={result.b} onOpen={() => open(b, result.b)} />
              </div>
              <div className="expr-table-wrap">
                <table className="truth-table expr-table" dir="ltr" aria-label={tr('טבלת האמת של שני הביטויים', 'The truth table of both expressions')}>
                  <thead>
                    <tr>
                      <th className="truth-m">m</th>
                      {result.vars.map((v) => (
                        <th key={v}>{v}</th>
                      ))}
                      <th className="truth-out">{tr('ראשון', 'First')}</th>
                      <th>{tr('שני', 'Second')}</th>
                      <th aria-hidden />
                    </tr>
                  </thead>
                  <tbody>
                    {result.rows.map((r) => (
                      <tr key={r.m} className={r.differs ? 'is-diff' : undefined}>
                        <td className="truth-m">{r.m}</td>
                        {r.bits.map((bit, k) => (
                          <td key={k}>{bit}</td>
                        ))}
                        <td className={`truth-out v-${cell(r.a)}`}>{cell(r.a)}</td>
                        <td className={`v-${cell(r.b)}`}>{cell(r.b)}</td>
                        <td className="expr-mark">{r.differs ? tr('שונה', 'differs') : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
