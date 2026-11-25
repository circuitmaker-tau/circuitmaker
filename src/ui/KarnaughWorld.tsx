/**
 * The Karnaugh map world (supervisor's review, 25.11): fill the map of a
 * function and get told which cells are wrong, then circle groups and get
 * feedback on each one and on the cover as a whole (WK4).
 */
import { useState } from 'react';
import type { KeyboardEvent } from 'react';
import { parseFunction } from '../analysis/expression';
import type { Cube } from '../analysis/func';
import {
  cellsOf,
  checkCover,
  describeQuestion,
  expressionOf,
  groupProblem,
  cubeOf,
  mapLayout,
  minimalGroups,
  randomQuestion,
  termOf,
  wrongCells,
} from '../analysis/kmapPractice';
import type { KQuestion, Target } from '../analysis/kmapPractice';
import type { Value } from '../analysis/minimize';
import { WorldNav } from './WorldNav';
import { tr } from '../i18n/lang';

const CELL = 48;
const HEAD = 44;
const COLORS = ['#4ea1ff', '#f2c94c', '#d4506e', '#a77bff', '#3fd0d0', '#ff9f43'];

const problemText = (problem: 'shape' | 'wrong-value' | 'only-dc', target: Target): string =>
  problem === 'shape'
    ? tr(
        'קבוצה היא מלבן של 1, 2, 4 או 8 תאים. אפשר לעבור את הקצה של המפה (העמודה הימנית והשמאלית צמודות, וכך גם השורה העליונה והתחתונה).',
        'A group is a rectangle of 1, 2, 4 or 8 cells. It may go across the edge of the map (the leftmost and rightmost columns are neighbours, and so are the top and bottom rows).',
      )
    : problem === 'wrong-value'
      ? target === 'sop'
        ? tr('בקבוצה יש תא עם 0. בסכום מכפלות מקבצים רק 1 ו-d.', 'The group has a cell with 0. For a sum of products, group only 1s and d.')
        : tr('בקבוצה יש תא עם 1. במכפלת סכומים מקבצים רק 0 ו-d.', 'The group has a cell with 1. For a product of sums, group only 0s and d.')
      : tr('קבוצה שיש בה רק d לא מכסה אף תא, ולכן אין בה צורך.', 'A group of only d covers no cell, so it is not needed.');

const newSeed = () => Math.floor(Math.random() * 1_000_000);

/** Columns or rows a cube covers, as runs that do not wrap around the edge. */
function runs(axis: number[], cube: Cube, order: readonly number[]): [number, number][] {
  const covered = order.map((code) =>
    axis.every((k, i) => {
      const fixed = cube.get(k);
      return fixed === undefined || fixed === ((code >> (axis.length - 1 - i)) & 1);
    }),
  );
  const out: [number, number][] = [];
  let start = -1;
  covered.forEach((c, i) => {
    if (c && start < 0) start = i;
    if (!c && start >= 0) {
      out.push([start, i - 1]);
      start = -1;
    }
  });
  if (start >= 0) out.push([start, covered.length - 1]);
  return out;
}

interface GridProps {
  q: KQuestion;
  shown: (Value | null)[];
  wrong: Set<number>;
  selected: Set<number>;
  groups: Cube[];
  indices: boolean;
  onCell: (m: number) => void;
  onKey?: (m: number, key: string) => void;
  /** Cells are picked for a group (they are toggle buttons). */
  selecting?: boolean;
}

function KGrid({ q, shown, wrong, selected, groups, indices, onCell, onKey, selecting = false }: GridProps) {
  const n = q.vars.length;
  const r = Math.floor(n / 2);
  const { rows, cols, at } = mapLayout(n);
  const rowAxis = Array.from({ length: r }, (_, i) => i);
  const colAxis = Array.from({ length: n - r }, (_, i) => r + i);
  const label = (code: number, width: number) => (width ? code.toString(2).padStart(width, '0') : '');
  return (
    <div
      className="kgrid"
      dir="ltr"
      style={{ width: HEAD + cols.length * CELL, height: HEAD + rows.length * CELL }}
    >
      <div className="kgrid-corner" style={{ width: HEAD, height: HEAD }} aria-hidden>
        <span className="kgrid-cols">{colAxis.map((k) => q.vars[k]).join('')}</span>
        <span className="kgrid-rows">{rowAxis.map((k) => q.vars[k]).join('')}</span>
      </div>
      {cols.map((code, ci) => (
        <div
          key={`c${ci}`}
          className="kgrid-head"
          style={{ left: HEAD + ci * CELL, top: 0, width: CELL, height: HEAD }}
          aria-hidden
        >
          {label(code, n - r)}
        </div>
      ))}
      {rows.map((code, ri) => (
        <div
          key={`r${ri}`}
          className="kgrid-head"
          style={{ left: 0, top: HEAD + ri * CELL, width: HEAD, height: CELL }}
          aria-hidden
        >
          {label(code, r)}
        </div>
      ))}
      {rows.map((_, ri) =>
        cols.map((__, ci) => {
          const m = at(ri, ci);
          const v = shown[m];
          const cls = [
            'kgrid-cell',
            v === null ? 'is-empty' : `v-${v}`,
            wrong.has(m) ? 'is-wrong' : '',
            selected.has(m) ? 'is-selected' : '',
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <button
              key={m}
              type="button"
              className={cls}
              style={{ left: HEAD + ci * CELL, top: HEAD + ri * CELL, width: CELL, height: CELL }}
              aria-label={`${tr('תא', 'Cell')} ${m}: ${v === null ? tr('ריק', 'empty') : v}${wrong.has(m) ? tr(', שגוי', ', wrong') : ''}${selected.has(m) ? tr(', נבחר', ', selected') : ''}`}
              aria-pressed={selecting ? selected.has(m) : undefined}
              onClick={() => onCell(m)}
              onKeyDown={(e: KeyboardEvent<HTMLButtonElement>) => onKey?.(m, e.key)}
            >
              {indices && <small>{m}</small>}
              {v ?? ''}
            </button>
          );
        }),
      )}
      {groups.map((g, gi) => {
        const inset = 4 + 3 * (gi % 4);
        return runs(rowAxis, g, rows).flatMap(([r0, r1]) =>
          runs(colAxis, g, cols).map(([c0, c1]) => (
            <div
              key={`${gi}-${r0}-${c0}`}
              className="kgrid-group"
              style={{
                left: HEAD + c0 * CELL + inset,
                top: HEAD + r0 * CELL + inset,
                width: (c1 - c0 + 1) * CELL - 2 * inset,
                height: (r1 - r0 + 1) * CELL - 2 * inset,
                borderColor: COLORS[gi % COLORS.length],
              }}
              aria-hidden
            />
          )),
        );
      })}
    </div>
  );
}

export function KarnaughWorld({ onHome, onHelp }: { onHome: () => void; onHelp: () => void }) {
  const [q, setQ] = useState<KQuestion>(() => randomQuestion(newSeed(), 4, 0));
  const [step, setStep] = useState<'fill' | 'group'>('fill');
  const [guess, setGuess] = useState<(Value | null)[]>(() => Array(16).fill(null));
  const [checkedFill, setCheckedFill] = useState(false);
  const [indices, setIndices] = useState(false);
  const [own, setOwn] = useState('');
  const [ownError, setOwnError] = useState<string | null>(null);
  const [target, setTarget] = useState<Target>('sop');
  const [groups, setGroups] = useState<Cube[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [groupMessage, setGroupMessage] = useState<string | null>(null);
  const [checkedCover, setCheckedCover] = useState(false);

  const n = q.vars.length;
  const hasDc = q.table.includes('d');
  const cycle: Value[] = hasDc ? [1, 0, 'd'] : [1, 0];

  const start = (next: KQuestion) => {
    setQ(next);
    setStep('fill');
    setGuess(Array(next.table.length).fill(null));
    setCheckedFill(false);
    setGroups([]);
    setSelected(new Set());
    setGroupMessage(null);
    setCheckedCover(false);
  };

  const loadOwn = () => {
    const parsed = parseFunction(own);
    if (!parsed.ok) return setOwnError(parsed.error);
    const { vars, table } = parsed.fn;
    if (vars.length < 2 || vars.length > 4) {
      return setOwnError(
        tr(
          `במפת קרנו כאן יש 2 עד 4 משתנים, ובפונקציה יש ${vars.length}.`,
          `A Karnaugh map here has 2 to 4 variables, and the function has ${vars.length}.`,
        ),
      );
    }
    setOwnError(null);
    start({ vars, table });
  };

  // a cell left empty is not marked as a mistake, only counted
  const wrong = checkedFill
    ? new Set(wrongCells(q.table, guess).filter((m) => guess[m] !== null))
    : new Set<number>();
  const empty = guess.filter((v) => v === null).length;
  const fillDone = checkedFill && wrong.size === 0 && empty === 0;

  const setCell = (m: number, v: Value | null) =>
    setGuess((g) => g.map((x, i) => (i === m ? v : x)));

  const cover = checkCover(q, groups, target);
  const goalName = target === 'sop' ? '1' : '0';

  const addGroup = () => {
    const cells = [...selected];
    const problem = groupProblem(q.table, n, cells, target);
    if (problem) {
      setGroupMessage(problemText(problem, target));
      return;
    }
    const cube = cubeOf(cells, n)!;
    const key = (c: Cube) => cellsOf(c, n).join(',');
    if (groups.some((g) => key(g) === key(cube))) {
      setGroupMessage(tr('הקבוצה הזו כבר קיימת.', 'This group is already there.'));
      return;
    }
    setGroups([...groups, cube]);
    setSelected(new Set());
    setGroupMessage(null);
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
      <WorldNav current="karnaugh" />

      <div className="expr-world">
        <main className="expr-main kmap-world">
          <h2>{tr('מפת קרנו: מילוי וקבוצות', 'Karnaugh map: fill it, then group')}</h2>
          <p className="hint">
            {tr(
              'ממלאים את המפה לפי הפונקציה ובודקים, ואחר כך מסמנים קבוצות. המשוב אומר איזה תא במקום הלא נכון, איזו קבוצה לא חוקית, מה עוד לא מכוסה, ואם אפשר עם פחות.',
              'Fill in the map of the function and check it, then mark groups. The feedback says which cell is in the wrong place, which group is not allowed, what is not covered yet, and whether fewer would do.',
            )}
          </p>

          <div className="kmap-source">
            <span>{tr('שאלה חדשה:', 'New question:')}</span>
            <button type="button" onClick={() => start(randomQuestion(newSeed(), 3, 0))}>
              {tr('3 משתנים', '3 variables')}
            </button>
            <button type="button" onClick={() => start(randomQuestion(newSeed(), 4, 0))}>
              {tr('4 משתנים', '4 variables')}
            </button>
            <button type="button" onClick={() => start(randomQuestion(newSeed(), 4, 2))}>
              {tr('4 משתנים עם d', "4 variables with don't cares")}
            </button>
          </div>
          <form
            className="kmap-own"
            onSubmit={(e) => {
              e.preventDefault();
              loadOwn();
            }}
          >
            <label className="expr-field">
              <span>{tr('או פונקציה משלך (2 עד 4 משתנים)', 'Or a function of your own (2 to 4 variables)')}</span>
              <input
                type="text"
                dir="ltr"
                spellCheck={false}
                autoComplete="off"
                placeholder="F(A,B,C,D) = Σ(0,2,5,7,8,10,13,15)"
                value={own}
                onChange={(e) => setOwn(e.target.value)}
                aria-invalid={ownError ? true : undefined}
                aria-describedby="kmap-own-error"
              />
            </label>
            <button type="submit" disabled={!own.trim()}>
              {tr('טעינה', 'Load')}
            </button>
            <p id="kmap-own-error" className="expr-error">
              {ownError}
            </p>
          </form>

          <p className="kmap-question" dir="ltr">
            {describeQuestion(q)}
          </p>

          <div className="kmap-steps" role="tablist" aria-label={tr('שלבים', 'Steps')}>
            <button
              type="button"
              role="tab"
              aria-selected={step === 'fill'}
              onClick={() => setStep('fill')}
            >
              {tr('1. מילוי המפה', '1. Fill the map')}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={step === 'group'}
              onClick={() => setStep('group')}
            >
              {tr('2. קבוצות', '2. Groups')}
            </button>
          </div>

          {step === 'fill' ? (
            <section className="kmap-step" aria-label={tr('מילוי המפה', 'Filling the map')}>
              <p className="hint">
                {tr(
                  `לחיצה על תא מחליפה ${hasDc ? '1, 0, d' : '1, 0'}. אפשר גם להקליד 1, 0${hasDc ? ' או d' : ''} כשתא מסומן. שימו לב לסדר העמודות והשורות: 00, 01, 11, 10.`,
                  `Clicking a cell goes through ${hasDc ? '1, 0, d' : '1, 0'}. You can also type 1, 0${hasDc ? ' or d' : ''} in a focused cell. Mind the order of the columns and rows: 00, 01, 11, 10.`,
                )}
              </p>
              <div className="kmap-board">
                <KGrid
                  q={q}
                  shown={guess}
                  wrong={wrong}
                  selected={new Set()}
                  groups={[]}
                  indices={indices}
                  onCell={(m) => {
                    const cur = guess[m];
                    setCell(m, cur === null ? cycle[0] : cycle[(cycle.indexOf(cur) + 1) % cycle.length]);
                  }}
                  onKey={(m, key) => {
                    if (key === '1' || key === '0') setCell(m, Number(key) as 0 | 1);
                    else if ((key === 'd' || key === 'D') && hasDc) setCell(m, 'd');
                    else if (key === 'Backspace' || key === 'Delete') setCell(m, null);
                  }}
                />
              </div>
              <div className="kmap-actions">
                <button type="button" className="primary" onClick={() => setCheckedFill(true)}>
                  {tr('בדיקה', 'Check')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setGuess([...q.table]);
                    setCheckedFill(true);
                  }}
                >
                  {tr('הצגת התשובה', 'Show the answer')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setGuess(Array(q.table.length).fill(null));
                    setCheckedFill(false);
                  }}
                >
                  {tr('ניקוי', 'Clear')}
                </button>
                <label className="check">
                  <input type="checkbox" checked={indices} onChange={(e) => setIndices(e.target.checked)} />
                  <span>{tr('מספרי התאים', 'Cell numbers')}</span>
                </label>
              </div>
              {checkedFill && (
                <div className={`expr-verdict ${fillDone ? 'is-same' : 'is-different'}`} role="status">
                  {fillDone ? (
                    <>
                      <strong>{tr('המפה נכונה', 'The map is right')}</strong>
                      <button type="button" className="kmap-next" onClick={() => setStep('group')}>
                        {tr('לשלב הקבוצות', 'On to the groups')}
                      </button>
                    </>
                  ) : (
                    <>
                      <strong>
                        {wrong.size === 0
                          ? tr('מה שמילאתם נכון', 'What you filled in is right')
                          : wrong.size === 1
                            ? tr('תא אחד לא נכון', 'One cell is wrong')
                            : tr(`${wrong.size} תאים לא נכונים`, `${wrong.size} cells are wrong`)}
                        {empty > 0 &&
                          (empty === 1
                            ? tr(', ותא אחד עוד ריק', ', and one cell is still empty')
                            : tr(`, ו-${empty} תאים עוד ריקים`, `, and ${empty} cells are still empty`))}
                      </strong>
                      {wrong.size > 0 &&
                        tr(
                          `${wrong.size === 1 ? 'הוא מסומן' : 'הם מסומנים'} באדום. מספר התא הוא הצירוף של ${q.vars.join('')} בבינארי, ו״מספרי התאים״ מראה אותו.`,
                          `${wrong.size === 1 ? 'It is' : 'They are'} marked in red. The number of a cell is ${q.vars.join('')} in binary, and "Cell numbers" shows it.`,
                        )}
                    </>
                  )}
                </div>
              )}
            </section>
          ) : (
            <section className="kmap-step" aria-label={tr('קבוצות', 'Groups')}>
              <fieldset className="kmap-target">
                <legend className="visually-hidden">{tr('מה מקבצים', 'What to group')}</legend>
                <label className="check">
                  <input
                    type="radio"
                    name="target"
                    checked={target === 'sop'}
                    onChange={() => {
                      setTarget('sop');
                      setGroups([]);
                      setSelected(new Set());
                    }}
                  />
                  <span>{tr('קבוצות של 1 (סכום מכפלות)', 'Groups of 1 (sum of products)')}</span>
                </label>
                <label className="check">
                  <input
                    type="radio"
                    name="target"
                    checked={target === 'pos'}
                    onChange={() => {
                      setTarget('pos');
                      setGroups([]);
                      setSelected(new Set());
                    }}
                  />
                  <span>{tr('קבוצות של 0 (מכפלת סכומים)', 'Groups of 0 (product of sums)')}</span>
                </label>
              </fieldset>
              <p className="hint">
                {tr(
                  `מסמנים תאים בלחיצה ולוחצים ״הוספת קבוצה״. כל קבוצה צריכה להיות מלבן של 1, 2, 4 או 8 תאים של ${goalName} או d, וכדאי שתהיה גדולה ככל האפשר.`,
                  `Click cells to select them and click "Add group". Every group must be a rectangle of 1, 2, 4 or 8 cells of ${goalName} or d, and as big as possible.`,
                )}
              </p>
              <div className="kmap-board">
                <KGrid
                  q={q}
                  shown={[...q.table]}
                  wrong={new Set()}
                  selected={selected}
                  groups={groups}
                  indices={indices}
                  selecting
                  onCell={(m) => {
                    const next = new Set(selected);
                    if (next.has(m)) next.delete(m);
                    else next.add(m);
                    setSelected(next);
                    setGroupMessage(null);
                  }}
                />
              </div>
              <div className="kmap-actions">
                <button type="button" className="primary" disabled={selected.size === 0} onClick={addGroup}>
                  {tr('הוספת קבוצה', 'Add group')}
                </button>
                <button type="button" disabled={selected.size === 0} onClick={() => setSelected(new Set())}>
                  {tr('ביטול הסימון', 'Clear selection')}
                </button>
                <button type="button" onClick={() => setCheckedCover(true)} disabled={groups.length === 0}>
                  {tr('בדיקה', 'Check')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setGroups(minimalGroups(q, target));
                    setSelected(new Set());
                    setCheckedCover(true);
                  }}
                >
                  {tr('הצגת פתרון', 'Show a solution')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setGroups([]);
                    setCheckedCover(false);
                  }}
                  disabled={groups.length === 0}
                >
                  {tr('ניקוי', 'Clear')}
                </button>
              </div>
              {groupMessage && (
                <p className="expr-error kmap-group-error" role="alert">
                  {groupMessage}
                </p>
              )}

              {groups.length > 0 && (
                <ul className="kmap-groups" aria-label={tr('הקבוצות', 'The groups')}>
                  {groups.map((g, i) => (
                    <li key={cellsOf(g, n).join(',')}>
                      <span className="kmap-swatch" style={{ borderColor: COLORS[i % COLORS.length] }} />
                      <bdi dir="ltr">{termOf(q.vars, g, target)}</bdi>
                      <button
                        type="button"
                        className="kmap-remove"
                        aria-label={tr(`הסרת הקבוצה ${termOf(q.vars, g, target)}`, `Remove the group ${termOf(q.vars, g, target)}`)}
                        onClick={() => setGroups(groups.filter((_, j) => j !== i))}
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <p className="analysis-func kmap-expression" dir="ltr">
                F = {expressionOf(q.vars, groups, target)}
              </p>

              {checkedCover && groups.length > 0 && (
                <div
                  className={`expr-verdict ${cover.done ? 'is-same' : 'is-different'}`}
                  role="status"
                >
                  {cover.done ? (
                    <>
                      <strong>{tr('כיסוי מינימלי', 'A minimal cover')}</strong>
                      {tr(
                        `${cover.mine.terms === 1 ? 'מונח אחד' : `${cover.mine.terms} מונחים`} ו-${cover.mine.literals} ליטרלים, כמו התשובה הקצרה ביותר.`,
                        `${cover.mine.terms === 1 ? 'One term' : `${cover.mine.terms} terms`} and ${cover.mine.literals} literals, as in the shortest answer.`,
                      )}
                    </>
                  ) : (
                    <>
                      <strong>{tr('עוד לא', 'Not yet')}</strong>
                      <ul className="kmap-feedback">
                        {cover.uncovered.length > 0 && (
                          <li>
                            {cover.uncovered.length === 1 ? tr('התא', 'The cell') : tr('התאים', 'The cells')}{' '}
                            <bdi dir="ltr">{cover.uncovered.join(', ')}</bdi> ({tr('של', 'of')} {goalName}){' '}
                            {tr('עוד לא בשום קבוצה.', cover.uncovered.length === 1 ? 'is not in any group yet.' : 'are not in any group yet.')}
                          </li>
                        )}
                        {cover.notPrime.map((p) => (
                          <li key={`p${p.index}`}>
                            {tr('את הקבוצה', 'The group')}{' '}
                            <bdi dir="ltr">{termOf(q.vars, groups[p.index], target)}</bdi>{' '}
                            {tr('אפשר להגדיל ל-', 'can grow into')}
                            <bdi dir="ltr">{p.better}</bdi>
                            {tr(
                              ': קבוצה גדולה יותר נותנת מונח עם פחות ליטרלים.',
                              ': a bigger group gives a term with fewer literals.',
                            )}
                          </li>
                        ))}
                        {cover.redundant.map((i) => (
                          <li key={`r${i}`}>
                            {tr('הקבוצה', 'The group')}{' '}
                            <bdi dir="ltr">{termOf(q.vars, groups[i], target)}</bdi>{' '}
                            {tr('מיותרת: כל התאים שלה כבר בקבוצות אחרות.', 'is not needed: all its cells are in other groups already.')}
                          </li>
                        ))}
                        {cover.uncovered.length === 0 &&
                          cover.redundant.length === 0 &&
                          cover.notPrime.length === 0 && (
                            <li>
                              {tr(
                                `הכיסוי נכון, אבל לא הקצר ביותר: אפשר ב-${cover.minimal.terms} מונחים ו-${cover.minimal.literals} ליטרלים (לכם ${cover.mine.terms} ו-${cover.mine.literals}). נסו קבוצות אחרות.`,
                                `The cover is right, but not the shortest: ${cover.minimal.terms} terms and ${cover.minimal.literals} literals will do (you have ${cover.mine.terms} and ${cover.mine.literals}). Try other groups.`,
                              )}
                            </li>
                          )}
                      </ul>
                    </>
                  )}
                </div>
              )}
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
