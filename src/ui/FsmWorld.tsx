/**
 * The state machine world (supervisor's review, 25.11): analyse a machine
 * built from flip-flops, first by filling its state table (the course's
 * layout: PS rows, NS and z for every x) and then by drawing its state
 * diagram, with feedback on every cell and every arrow (WK9).
 */
import { useState } from 'react';
import type { KeyboardEvent } from 'react';
import { checkDiagram, code, fsmProblem, fsmTable, transitionsOf } from '../analysis/fsmTable';
import type { FsmTable, Transition } from '../analysis/fsmTable';
import type { Logic } from '../engine/logic';
import { EXAMPLES } from '../examples';
import type { Circuit } from '../model';
import { useCircuitStore } from '../store/circuitStore';
import { WorldNav } from './WorldNav';
import { tr } from '../i18n/lang';

interface Machine {
  id: string;
  label: string;
  circuit: Circuit;
  /** The equations of the circuit, as in the lecture or the exam. */
  equations: string[];
}

const example = (id: string) => EXAMPLES.find((e) => e.id === id)!;

const MACHINES: Machine[] = [
  {
    id: 'bamba',
get label() {
      return tr('מכונת הבמבה (WK9B)', 'The bamba machine (WK9B)');
    },
    circuit: example('bamba').circuit,
    equations: ["T1 = x'y1 + xy2", 'T2 = x + y2', "z = x'y1"],
  },
  {
    id: 'detector',
get label() {
      return tr('מזהה 0101 (WK9A)', 'The 0101 detector (WK9A)');
    },
    circuit: example('detector').circuit,
    equations: ['J1 = xy2', "K1 = x + y2'", "D2 = x'y2' + y1'y2", "z = xy1y2'"],
  },
  {
    id: 'plane',
get label() {
      return tr('מכונת המטוס (2026 מועד א)', 'The airplane machine (2026, A)');
    },
    circuit: example('plane').circuit,
    equations: [
      "S1 = XL'XR' + y2XL' + y2XR'",
      "R1 = XLXR + y2'XR + y2'XL",
      "S2 = y2'XR' + y2'XL'",
      'R2 = y2XR + y2XL',
      "Z = y2'XR' + y2'XL' + XL'XR'",
    ],
  },
];

const show = (v: readonly Logic[]) => v.join('');
const clean = (s: string) => s.replace(/[^01xX]/g, '').toUpperCase();

/** Where the states go on the diagram: around a circle, the first at the top left. */
function layout(count: number, size: number) {
  const c = size / 2;
  const r = count <= 2 ? size * 0.28 : size * 0.34;
  return Array.from({ length: count }, (_, i) => {
    const a = -Math.PI * 0.75 + (2 * Math.PI * i) / count;
    return { x: c + r * Math.cos(a), y: c + r * Math.sin(a) };
  });
}

const R = 24;
const SIZE = 360;

function Diagram({
  t,
  arrows,
  picked,
  onState,
}: {
  t: FsmTable;
  arrows: Transition[];
  picked: number | null;
  onState: (s: number) => void;
}) {
  const k = t.flipFlops.length;
  const m = t.inputs.length;
  const count = 1 << k;
  const at = layout(count, SIZE);
  // one drawn edge per (from, to), with all its labels
  const edges = new Map<string, { from: number; to: number; labels: string[] }>();
  for (const a of arrows) {
    const key = `${a.from}>${a.to}`;
    const e = edges.get(key) ?? { from: a.from, to: a.to, labels: [] };
    e.labels.push(`${code(a.input, m)}/${a.output}`);
    edges.set(key, e);
  }
  return (
    <svg
      className="fsm-diagram"
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      width={SIZE}
      height={SIZE}
      role="group"
      aria-label={tr('דיאגרמת המצבים', 'The state diagram')}
      direction="ltr"
    >
      <defs>
        <marker id="fsm-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" fill="currentColor" />
        </marker>
      </defs>
      {[...edges.values()].map((e) => {
        const p = at[e.from];
        const q = at[e.to];
        const label = e.labels.join(', ');
        if (e.from === e.to) {
          // a loop on the outer side of the state
          const cx = SIZE / 2;
          const dx = p.x - cx;
          const dy = p.y - cx;
          const len = Math.hypot(dx, dy) || 1;
          const [ux, uy] = [dx / len, dy / len];
          const [vx, vy] = [-uy, ux];
          const s = { x: p.x + R * (ux * 0.7 + vx * 0.7), y: p.y + R * (uy * 0.7 + vy * 0.7) };
          const f = { x: p.x + R * (ux * 0.7 - vx * 0.7), y: p.y + R * (uy * 0.7 - vy * 0.7) };
          const c1 = { x: p.x + 70 * ux + 34 * vx, y: p.y + 70 * uy + 34 * vy };
          const c2 = { x: p.x + 70 * ux - 34 * vx, y: p.y + 70 * uy - 34 * vy };
          return (
            <g key={`${e.from}>${e.to}`} className="fsm-edge">
              <path d={`M${s.x} ${s.y} C${c1.x} ${c1.y} ${c2.x} ${c2.y} ${f.x} ${f.y}`} markerEnd="url(#fsm-arrow)" />
              <text x={p.x + 64 * ux} y={p.y + 64 * uy + 4}>
                {label}
              </text>
            </g>
          );
        }
        const dx = q.x - p.x;
        const dy = q.y - p.y;
        const len = Math.hypot(dx, dy);
        const [ux, uy] = [dx / len, dy / len];
        // bend to the left of the direction of travel, so a <-> b are two arcs
        const [nx, ny] = [uy, -ux];
        const bend = 22;
        const s = { x: p.x + ux * R + nx * 6, y: p.y + uy * R + ny * 6 };
        const f = { x: q.x - ux * R + nx * 6, y: q.y - uy * R + ny * 6 };
        const c = { x: (p.x + q.x) / 2 + nx * bend, y: (p.y + q.y) / 2 + ny * bend };
        // the label a little before the middle, so crossing arrows do not share a spot
        const lt = 0.4;
        const l = {
          x: (1 - lt) ** 2 * s.x + 2 * (1 - lt) * lt * c.x + lt ** 2 * f.x,
          y: (1 - lt) ** 2 * s.y + 2 * (1 - lt) * lt * c.y + lt ** 2 * f.y,
        };
        return (
          <g key={`${e.from}>${e.to}`} className="fsm-edge">
            <path d={`M${s.x} ${s.y} Q${c.x} ${c.y} ${f.x} ${f.y}`} markerEnd="url(#fsm-arrow)" />
            <text x={l.x + nx * 10} y={l.y + ny * 10 + 4}>
              {label}
            </text>
          </g>
        );
      })}
      {at.map((p, s) => (
        <g
          key={s}
          className={`fsm-state${picked === s ? ' is-picked' : ''}`}
          role="button"
          tabIndex={0}
          aria-label={`${tr('מצב', 'State')} ${code(s, k)}${picked === s ? tr(', נבחר', ', selected') : ''}`}
          aria-pressed={picked === s}
          onClick={() => onState(s)}
          onKeyDown={(e: KeyboardEvent<SVGGElement>) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onState(s);
            }
          }}
        >
          <circle cx={p.x} cy={p.y} r={R} />
          <text x={p.x} y={p.y + 5}>
            {code(s, k)}
          </text>
        </g>
      ))}
    </svg>
  );
}

export function FsmWorld({ onHome, onHelp }: { onHome: () => void; onHelp: () => void }) {
  const [machine, setMachine] = useState<Machine>(MACHINES[0]);
  const [sourceError, setSourceError] = useState<string | null>(null);
  const [step, setStep] = useState<'table' | 'diagram'>('table');
  const [cells, setCells] = useState<Record<string, string>>({});
  const [checkedTable, setCheckedTable] = useState(false);
  const [arrows, setArrows] = useState<Transition[]>([]);
  const [from, setFrom] = useState<number | null>(null);
  const [to, setTo] = useState<number | null>(null);
  const [input, setInput] = useState(0);
  const [output, setOutput] = useState('0');
  const [checkedDiagram, setCheckedDiagram] = useState(false);

  const t = fsmTable(machine.circuit);
  const k = t.flipFlops.length;
  const m = t.inputs.length;
  const states = 1 << k;
  const inputsCount = 1 << m;
  const outputCodes = Array.from({ length: 1 << t.outputs.length }, (_, i) => code(i, t.outputs.length));

  const start = (next: Machine) => {
    setMachine(next);
    setStep('table');
    setCells({});
    setCheckedTable(false);
    setArrows([]);
    setFrom(null);
    setTo(null);
    setInput(0);
    setOutput(code(0, next.circuit.components.filter((c) => c.type === 'OUTPUT').length));
    setCheckedDiagram(false);
  };

  const fromEditor = () => {
    const circuit = useCircuitStore.getState().circuit;
    const problem = fsmProblem(circuit);
    if (problem) return setSourceError(problem);
    setSourceError(null);
    start({ id: 'editor', label: circuit.name || tr('המעגל שבעורך', 'The circuit in the editor'), circuit, equations: [] });
  };

  const answer = (kind: 'ns' | 'z', s: number, x: number) =>
    kind === 'ns' ? show(t.next[s][x]) : show(t.out[s][x]);
  const keys = [...Array(states).keys()].flatMap((s) =>
    [...Array(inputsCount).keys()].flatMap((x) => [`ns:${s}:${x}`, `z:${s}:${x}`]),
  );
  const wrongCells = checkedTable
    ? new Set(
        keys.filter((key) => {
          const [kind, s, x] = key.split(':');
          const v = cells[key] ?? '';
          return v !== '' && v !== answer(kind as 'ns' | 'z', Number(s), Number(x));
        }),
      )
    : new Set<string>();
  const empty = keys.filter((key) => !(cells[key] ?? '')).length;
  const tableDone = checkedTable && wrongCells.size === 0 && empty === 0;

  const pick = (s: number) => {
    if (from === null || to !== null) {
      setFrom(s);
      setTo(null);
    } else setTo(s);
  };
  const feedback = checkDiagram(t, arrows);
  const inputName = m === 1 ? t.inputs[0] : t.inputs.join('');
  const xLabel = (x: number) => `${inputName}=${code(x, m)}`;

  const cellInput = (kind: 'ns' | 'z', s: number, x: number) => {
    const key = `${kind}:${s}:${x}`;
    const width = kind === 'ns' ? k : t.outputs.length;
    return (
      <td key={key}>
        <input
          className={`fsm-cell${wrongCells.has(key) ? ' is-wrong' : ''}`}
          dir="ltr"
          inputMode="numeric"
          autoComplete="off"
          spellCheck={false}
          maxLength={width}
          size={Math.max(width, 2)}
          value={cells[key] ?? ''}
          aria-label={tr(
            `${kind === 'ns' ? 'המצב הבא' : 'הפלט'} ממצב ${code(s, k)} כש-${xLabel(x)}${wrongCells.has(key) ? ', שגוי' : ''}`,
            `${kind === 'ns' ? 'Next state' : 'Output'} from state ${code(s, k)} when ${xLabel(x)}${wrongCells.has(key) ? ', wrong' : ''}`,
          )}
          aria-invalid={wrongCells.has(key) ? true : undefined}
          onChange={(e) => setCells({ ...cells, [key]: clean(e.target.value).slice(0, width) })}
        />
      </td>
    );
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
      <WorldNav current="fsm" />

      <div className="expr-world">
        <main className="expr-main kmap-world">
          <h2>{tr('מכונת מצבים: מהמעגל לטבלה ולדיאגרמה', 'A state machine: from the circuit to the table and the diagram')}</h2>
          <p className="hint">
            {tr(
              'מנתחים מכונה שבנויה מ-flip-flops, כמו בהרצאה: ממלאים את טבלת המצבים (המצב הבא והפלט לכל מצב ולכל קלט), ואחר כך מציירים את דיאגרמת המצבים. המשוב בודק כל תא וכל חץ מול המעגל עצמו.',
              'Analyse a machine built from flip-flops, as in the lecture: fill in its state table (the next state and the output for every state and input), then draw its state diagram. The feedback checks every cell and every arrow against the circuit itself.',
            )}
          </p>

          <div className="kmap-source">
            <span>{tr('מכונה:', 'Machine:')}</span>
            {MACHINES.map((mc) => (
              <button
                key={mc.id}
                type="button"
                aria-pressed={machine.id === mc.id}
                onClick={() => {
                  setSourceError(null);
                  start(mc);
                }}
              >
                {mc.label}
              </button>
            ))}
            <button type="button" aria-pressed={machine.id === 'editor'} onClick={fromEditor}>
              {tr('המעגל שבעורך', 'The circuit in the editor')}
            </button>
          </div>
          {sourceError && (
            <p className="expr-error" role="alert">
              {sourceError}
            </p>
          )}

          <div className="fsm-given">
            {machine.equations.length > 0 && (
              <p className="analysis-func" dir="ltr">
                {machine.equations.join(',  ')}
              </p>
            )}
            <p className="hint">
              {tr(
                `flip-flops: ${t.flipFlops.join(', ')} (המצב הוא ${t.flipFlops.join('')}), כניסות: ${t.inputs.join(', ') || 'אין'}, יציאות: ${t.outputs.join(', ')}. לתזכורת:`,
                `flip-flops: ${t.flipFlops.join(', ')} (the state is ${t.flipFlops.join('')}), inputs: ${t.inputs.join(', ') || 'none'}, outputs: ${t.outputs.join(', ')}. Reminder:`,
              )}{' '}
              <bdi dir="ltr" className="expr-code">
                D: Y = D, T: Y = T ⊕ y, JK: Y = Jy&apos; + K&apos;y, SR: Y = S + R&apos;y
              </bdi>
              .{' '}
              <button
                type="button"
                className="inline-link"
                onClick={() => {
                  useCircuitStore.getState().loadCircuit(machine.circuit);
                  window.location.hash = '#/editor';
                }}
                hidden={machine.id === 'editor'}
              >
                {tr('פתיחת המעגל בעורך', 'Open the circuit in the editor')}
              </button>
            </p>
          </div>

          <div className="kmap-steps" role="tablist" aria-label={tr('שלבים', 'Steps')}>
            <button type="button" role="tab" aria-selected={step === 'table'} onClick={() => setStep('table')}>
              {tr('1. טבלת מצבים', '1. State table')}
            </button>
            <button type="button" role="tab" aria-selected={step === 'diagram'} onClick={() => setStep('diagram')}>
              {tr('2. דיאגרמת מצבים', '2. State diagram')}
            </button>
          </div>

          {step === 'table' ? (
            <section className="kmap-step" aria-label={tr('טבלת מצבים', 'State table')}>
              <p className="hint">
                {tr(
                  `בכל תא כותבים את המצב הבא (${t.flipFlops.map((f) => f.toUpperCase()).join('')}) או את הפלט (${t.outputs.join('')}), בספרות 0 ו-1.`,
                  `In every cell write the next state (${t.flipFlops.map((f) => f.toUpperCase()).join('')}) or the output (${t.outputs.join('')}), in the digits 0 and 1.`,
                )}
              </p>
              <div className="expr-table-wrap">
                <table className="truth-table fsm-table" dir="ltr">
                  <thead>
                    <tr>
                      <th rowSpan={2} className="truth-m">
                        PS
                        <br />
                        {t.flipFlops.join('')}
                      </th>
                      <th colSpan={inputsCount}>NS ({t.flipFlops.map((f) => f.toUpperCase()).join('')})</th>
                      <th colSpan={inputsCount} className="truth-out">
                        {t.outputs.join('')}
                      </th>
                    </tr>
                    <tr>
                      {[...Array(inputsCount).keys()].map((x) => (
                        <th key={`n${x}`}>{xLabel(x)}</th>
                      ))}
                      {[...Array(inputsCount).keys()].map((x) => (
                        <th key={`z${x}`} className={x === 0 ? 'truth-out' : undefined}>
                          {xLabel(x)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...Array(states).keys()].map((s) => (
                      <tr key={s}>
                        <th className="truth-m">{code(s, k)}</th>
                        {[...Array(inputsCount).keys()].map((x) => cellInput('ns', s, x))}
                        {[...Array(inputsCount).keys()].map((x) => cellInput('z', s, x))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="kmap-actions">
                <button type="button" className="primary" onClick={() => setCheckedTable(true)}>
                  {tr('בדיקה', 'Check')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const all: Record<string, string> = {};
                    for (const key of keys) {
                      const [kind, s, x] = key.split(':');
                      all[key] = answer(kind as 'ns' | 'z', Number(s), Number(x));
                    }
                    setCells(all);
                    setCheckedTable(true);
                  }}
                >
                  {tr('הצגת התשובה', 'Show the answer')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCells({});
                    setCheckedTable(false);
                  }}
                >
                  {tr('ניקוי', 'Clear')}
                </button>
              </div>
              {checkedTable && (
                <div className={`expr-verdict ${tableDone ? 'is-same' : 'is-different'}`} role="status">
                  {tableDone ? (
                    <>
                      <strong>{tr('הטבלה נכונה', 'The table is right')}</strong>
                      {t.mealy
                        ? tr('זו מכונת Mealy: הפלט תלוי גם בקלט.', 'This is a Mealy machine: the output depends on the input too.')
                        : tr('זו מכונת Moore: הפלט תלוי רק במצב.', 'This is a Moore machine: the output depends on the state alone.')}
                      <button type="button" className="kmap-next" onClick={() => setStep('diagram')}>
                        {tr('לדיאגרמת המצבים', 'On to the state diagram')}
                      </button>
                    </>
                  ) : (
                    <>
                      <strong>
                        {wrongCells.size === 0
                          ? tr('מה שמילאתם נכון', 'What you filled in is right')
                          : wrongCells.size === 1
                            ? tr('תא אחד לא נכון', 'One cell is wrong')
                            : tr(`${wrongCells.size} תאים לא נכונים`, `${wrongCells.size} cells are wrong`)}
                        {empty > 0 &&
                          (empty === 1
                            ? tr(', ותא אחד עוד ריק', ', and one cell is still empty')
                            : tr(`, ו-${empty} תאים עוד ריקים`, `, and ${empty} cells are still empty`))}
                      </strong>
                      {wrongCells.size > 0 &&
                        tr(
                          'התאים השגויים מסומנים באדום. מציבים את המצב ואת הקלט במשוואות של כניסות ה-flip-flops, ואז במשוואה האופיינית שלהם.',
                          'The wrong cells are marked in red. Put the state and the input into the equations of the flip-flop inputs, then into their characteristic equation.',
                        )}
                    </>
                  )}
                </div>
              )}
            </section>
          ) : (
            <section className="kmap-step" aria-label={tr('דיאגרמת מצבים', 'State diagram')}>
              <p className="hint">
                {tr(
                  'לוחצים על המצב שממנו יוצא החץ ואז על המצב שאליו הוא הולך (אותו מצב פעמיים: לולאה), בוחרים את הקלט ואת הפלט ומוסיפים. כמו בקורס, כל חץ כתוב',
                  'Click the state the arrow leaves, then the state it goes to (the same state twice: a loop), pick the input and the output, and add it. As in the course, every arrow is written',
                )}{' '}
                <bdi dir="ltr">
                  {inputName}/{t.outputs.join('')}
                </bdi>
                .
              </p>
              <div className="fsm-board">
                <Diagram t={t} arrows={arrows} picked={from} onState={pick} />
                <div className="fsm-form" aria-live="polite">
                  {from === null ? (
                    <p className="hint">{tr('בחרו מצב שממנו יוצא החץ.', 'Pick the state the arrow leaves.')}</p>
                  ) : to === null ? (
                    <p className="hint">
                      {tr('מ-', 'From ')}
                      <bdi dir="ltr">{code(from, k)}</bdi>
                      {tr('. עכשיו בחרו לאן.', '. Now pick where to.')}
                    </p>
                  ) : (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        setArrows([...arrows, { from, to, input, output }]);
                        setFrom(null);
                        setTo(null);
                      }}
                    >
                      <p>
                        {tr('חץ מ-', 'An arrow from ')}
                        <bdi dir="ltr">{code(from, k)}</bdi> {tr('אל', 'to')} <bdi dir="ltr">{code(to, k)}</bdi>
                      </p>
                      <label className="fsm-select">
                        <span>
                          {tr('קלט', 'Input')} {inputName}
                        </span>
                        <select value={input} onChange={(e) => setInput(Number(e.target.value))}>
                          {[...Array(inputsCount).keys()].map((x) => (
                            <option key={x} value={x}>
                              {code(x, m)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="fsm-select">
                        <span>
                          {tr('פלט', 'Output')} {t.outputs.join('')}
                        </span>
                        <select value={output} onChange={(e) => setOutput(e.target.value)}>
                          {outputCodes.map((o) => (
                            <option key={o} value={o}>
                              {o}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="kmap-actions">
                        <button type="submit" className="primary">
                          {tr('הוספת החץ', 'Add the arrow')}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setFrom(null);
                            setTo(null);
                          }}
                        >
                          {tr('ביטול', 'Cancel')}
                        </button>
                      </div>
                    </form>
                  )}

                  {arrows.length > 0 && (
                    <ul className="kmap-groups fsm-arrows" aria-label={tr('החצים', 'The arrows')}>
                      {arrows.map((a, i) => (
                        <li key={i}>
                          <bdi dir="ltr">
                            {code(a.from, k)} → {code(a.to, k)} ({code(a.input, m)}/{a.output})
                          </bdi>
                          <button
                            type="button"
                            className="kmap-remove"
                            aria-label={tr(
                              `הסרת החץ מ-${code(a.from, k)} אל ${code(a.to, k)}`,
                              `Remove the arrow from ${code(a.from, k)} to ${code(a.to, k)}`,
                            )}
                            onClick={() => setArrows(arrows.filter((_, j) => j !== i))}
                          >
                            ×
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
              <div className="kmap-actions">
                <button type="button" className="primary" disabled={arrows.length === 0} onClick={() => setCheckedDiagram(true)}>
                  {tr('בדיקה', 'Check')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setArrows(transitionsOf(t));
                    setCheckedDiagram(true);
                  }}
                >
                  {tr('הצגת הדיאגרמה', 'Show the diagram')}
                </button>
                <button
                  type="button"
                  disabled={arrows.length === 0}
                  onClick={() => {
                    setArrows([]);
                    setCheckedDiagram(false);
                  }}
                >
                  {tr('ניקוי', 'Clear')}
                </button>
              </div>
              {checkedDiagram && arrows.length > 0 && (
                <div className={`expr-verdict ${feedback.done ? 'is-same' : 'is-different'}`} role="status">
                  {feedback.done ? (
                    <>
                      <strong>{tr('הדיאגרמה נכונה', 'The diagram is right')}</strong>
                      {tr(
                        `${transitionsOf(t).length} חצים, אחד לכל מצב ולכל קלט.`,
                        `${transitionsOf(t).length} arrows, one for every state and input.`,
                      )}
                    </>
                  ) : (
                    <>
                      <strong>{tr('עוד לא', 'Not yet')}</strong>
                      <ul className="kmap-feedback">
                        {feedback.wrong.map((w) => {
                          const a = arrows[w.index];
                          const where = a.to !== w.to;
                          const what = a.output !== w.output;
                          return (
                            <li key={`w${w.index}`}>
                              {tr('החץ מ-', 'The arrow from ')}
                              <bdi dir="ltr">{code(a.from, k)}</bdi> {tr('בקלט', 'on input')}{' '}
                              <bdi dir="ltr">{code(a.input, m)}</bdi>:{' '}
                              {where && what
                                ? tr('גם המצב שאליו הוא הולך וגם הפלט לא נכונים.', 'both the state it goes to and the output are wrong.')
                                : where
                                  ? tr('הולך למצב הלא נכון.', 'goes to the wrong state.')
                                  : tr('הפלט לא נכון.', 'the output is wrong.')}
                            </li>
                          );
                        })}
                        {feedback.duplicate.map((i) => (
                          <li key={`d${i}`}>
                            {tr('יש יותר מחץ אחד מ-', 'There is more than one arrow from ')}
                            <bdi dir="ltr">{code(arrows[i].from, k)}</bdi> {tr('בקלט', 'on input')}{' '}
                            <bdi dir="ltr">{code(arrows[i].input, m)}</bdi>
                            {tr('. במכונה דטרמיניסטית יש בדיוק אחד.', '. A deterministic machine has exactly one.')}
                          </li>
                        ))}
                        {feedback.missing.length > 0 && (
                          <li>
                            {feedback.missing.length === 1
                              ? tr('חסר חץ', 'An arrow is missing')
                              : tr(`חסרים ${feedback.missing.length} חצים`, `${feedback.missing.length} arrows are missing`)}
                            :{' '}
                            {feedback.missing.map((x, i) => (
                              <span key={i}>
                                {i > 0 && ', '}
                                {tr('מ-', 'from ')}
                                <bdi dir="ltr">{code(x.from, k)}</bdi> {tr('בקלט', 'on input')}{' '}
                                <bdi dir="ltr">{code(x.input, m)}</bdi>
                              </span>
                            ))}
                            .
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
