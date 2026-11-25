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

/** Pairs from the Boolean algebra of the course: laws, and one common mistake. */
const PAIRS: { label: string; a: string; b: string }[] = [
  { label: 'פילוג', a: 'A + BC', b: '(A + B)(A + C)' },
  { label: 'דה מורגן', a: "(AB)'", b: "A' + B'" },
  { label: 'טעות נפוצה', a: "(A + B)'", b: "A' + B'" },
  { label: 'קונצנזוס', a: "AB + A'C + BC", b: "AB + A'C" },
  { label: 'XOR', a: 'A ⊕ B', b: "AB' + A'B" },
  { label: 'עם d', a: 'F(A,B,C,D) = Σ(2,3,4,5,10,11,15) + d(14)', b: "A'BC' + AC + B'C" },
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
        <strong>שקולים: זו אותה פונקציה</strong>
        שני הביטויים נותנים אותו ערך בכל {rows.length} השורות של טבלת האמת
        {dc > 0 && (dc === 1 ? ', פרט לשורה אחת עם d, שבה כל ערך מתאים' : `, פרט ל-${dc} שורות עם d, שבהן כל ערך מתאים`)}.
      </div>
    );
  }
  const first = differences[0];
  return (
    <div className="expr-verdict is-different" role="status">
      <strong>לא שקולים</strong>
      למשל כש-<bdi dir="ltr">{assignment(vars, first)}</bdi>: הביטוי הראשון נותן {cell(first.a)}, והשני
      נותן {cell(first.b)}.{' '}
      {differences.length === 1 ? (
        'זו השורה היחידה שבה הם שונים.'
      ) : (
        <>
          הם שונים ב-{differences.length} מתוך {rows.length} השורות (
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
        פתיחה כמעגל
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
        `נבנה מהביטוי ${text.trim()} בעולם הביטויים הבוליאניים. המתגים הם ${fn.vars.join(', ')}. Ctrl+Z מחזיר את המעגל הקודם.`,
      );
    window.location.hash = '#/editor';
  };

  return (
    <div className="app">
      <header className="topbar">
        <h1>
          <button type="button" className="home-link" onClick={onHome} aria-label="דף הבית">
            CircuitMaker
          </button>
        </h1>
        <div className="actions">
          <button type="button" onClick={onHelp} title="מדריך למשתמש">
            עזרה
          </button>
        </div>
      </header>
      <WorldNav current="expressions" />

      <div className="expr-world">
        <main className="expr-main">
          <h2>אותה פונקציה בשתי כתיבות?</h2>
          <p className="hint">
            כותבים שני ביטויים כמו בקורס: גרש הוא NOT, צמידות היא AND, + הוא OR, ⊕ או ^ הוא XOR,
            ואפשר סוגריים. אפשר גם רשימת מינטרמים, כמו{' '}
            <bdi dir="ltr" className="expr-code">
              Σ(1,3) + d(5)
            </bdi>
            , או מקסטרמים,{' '}
            <bdi dir="ltr" className="expr-code">
              Π(0,2)
            </bdi>
            . הבדיקה עוברת על כל שורות טבלת האמת של המשתנים של שני הביטויים יחד.
          </p>

          <div className="expr-inputs">
            <label className="expr-field">
              <span>ביטוי ראשון</span>
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
              <span>ביטוי שני</span>
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
            <span>דוגמאות:</span>
            {PAIRS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => {
                  setA(p.a);
                  setB(p.b);
                }}
              >
                {p.label}
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
                <Form title="הביטוי הראשון" fn={result.a} onOpen={() => open(a, result.a)} />
                <Form title="הביטוי השני" fn={result.b} onOpen={() => open(b, result.b)} />
              </div>
              <div className="expr-table-wrap">
                <table className="truth-table expr-table" dir="ltr" aria-label="טבלת האמת של שני הביטויים">
                  <thead>
                    <tr>
                      <th className="truth-m">m</th>
                      {result.vars.map((v) => (
                        <th key={v}>{v}</th>
                      ))}
                      <th className="truth-out">ראשון</th>
                      <th>שני</th>
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
                        <td className="expr-mark">{r.differs ? 'שונה' : ''}</td>
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
