/**
 * Practice: guess the timing diagram, as in the exams. The switches and clocks
 * are given; the student draws every other chosen signal (click or drag over
 * the cells to set 0 or 1), checks the drawing, and can then see the answer or
 * play the run in the timing diagram.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import { blankGuess, buildQuestion, cannotPractise, DEFAULT_PERIODS, grade } from '../analysis/practice';
import type { Grade, Guess, Question } from '../analysis/practice';
import type { Logic } from '../engine/logic';
import { useCircuitStore } from '../store/circuitStore';
import { frontsOf, structureSignature, useSimStore } from '../store/simStore';
import { allRows, useTimingStore } from '../store/timingStore';
import { SIGNAL_COLORS } from './signalColors';

const ROW_H = 34;
const HIGH = 8;
const LOW = 26;
const AXIS_H = 22;
const PAD = 12;
const MIN_CELL = 14;
const PERIOD_CHOICES = [4, 8, 12];

const fmt = (ticks: number) => String(Math.round(ticks) / 10);

/** The 0 and 1 levels and the edges between them, for a row of cells. */
function cellsPath(cells: readonly Logic[], cellW: number): string {
  let d = '';
  let prev: Logic | null = null;
  cells.forEach((v, k) => {
    const x0 = PAD + k * cellW;
    const x1 = x0 + cellW;
    if (prev !== null && prev !== v && prev !== 'X' && v !== 'X') d += `M${x0} ${HIGH}V${LOW}`;
    if (v === 1) d += `M${x0} ${HIGH}H${x1}`;
    else if (v === 0) d += `M${x0} ${LOW}H${x1}`;
    prev = v;
  });
  return d;
}

/** The last question built: it is the same until the circuit's behaviour changes. */
let cached: { key: string; question: Question } | null = null;
function questionFor(key: string, build: () => Question): Question {
  if (cached?.key !== key) cached = { key, question: build() };
  return cached.question;
}

export function PracticePanel() {
  const circuit = useCircuitStore((s) => s.circuit);
  const probes = useTimingStore((s) => s.probes);
  const [periods, setPeriods] = useState(DEFAULT_PERIODS);
  /** Nets the student moved between "given" and "to draw". */
  const [swapped, setSwapped] = useState<Set<string>>(new Set());
  /** The question whose answer is shown, so a new question starts hidden. */
  const [answerFor, setAnswerFor] = useState<string | null>(null);

  const reason = cannotPractise(circuit);
  const hasClock = circuit.components.some((c) => c.type === 'CLOCK');

  const specs = useMemo(() => {
    void probes;
    const shown = new Set(useTimingStore.getState().shown(circuit));
    return allRows(circuit)
      .map((r, i) => ({ ...r, color: SIGNAL_COLORS[i % SIGNAL_COLORS.length] }))
      .filter((r) => shown.has(r.net))
      .map((r) => ({ net: r.net, label: r.label, color: r.color, given: r.source !== swapped.has(r.net) }));
  }, [circuit, probes, swapped]);

  // a new question when the circuit's behaviour changes, not when a component is moved
  const behaviour = `${structureSignature(circuit)}|${JSON.stringify(
    circuit.components.filter((c) => c.type === 'INPUT').map((c) => c.props?.value ?? 0),
  )}|${periods}|${specs.map((s) => `${s.net}${s.given ? '+' : '-'}`).join()}`;
  const question = reason ? null : questionFor(behaviour, () => buildQuestion(circuit, specs, periods));

  const [drawn, setDrawn] = useState<{ key: string; guesses: Map<string, Guess>; result: Grade | null }>({
    key: '',
    guesses: new Map(),
    result: null,
  });
  const current = drawn.key === behaviour ? drawn : { key: behaviour, guesses: new Map<string, Guess>(), result: null };
  const guessOf = (net: string): Guess => {
    const row = question!.rows.find((r) => r.net === net)!;
    return current.guesses.get(net) ?? blankGuess(row);
  };

  const showAnswer = answerFor === behaviour;

  const scroller = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, [question]);

  const paint = useRef<{ net: string; value: 0 | 1 } | null>(null);

  if (reason || !question) return <p className="hint analysis-empty">{reason}</p>;
  if (!question.rows.some((r) => !r.given)) {
    return (
      <p className="hint analysis-empty">
        אין אותות לשרטט. מוסיפים אותות לדיאגרמת הזמנים מפאנל המאפיינים, או לוחצים על שם של אות כדי
        שיהיה לשרטוט.
      </p>
    );
  }

  const cellW = Math.max(MIN_CELL, (width - 2 * PAD) / question.cells);
  const svgWidth = PAD * 2 + cellW * question.cells;
  const height = AXIS_H + question.rows.length * ROW_H + 6;
  const result = current.result;
  const colorOf = new Map(specs.map((s) => [s.net, s.color]));

  // axis labels about every 50 px, on whole cells
  const every = Math.max(1, Math.ceil(50 / cellW));
  const labels: number[] = [];
  for (let k = 0; k <= question.cells; k += every) labels.push(k);

  const setCell = (net: string, k: number, value: 0 | 1) => {
    const row = question.rows.find((r) => r.net === net)!;
    if (row.given || k < 0 || k >= question.cells || row.truth[k] === 'X') return;
    const g = guessOf(net);
    if (g[k] === value) return;
    const next = [...g];
    next[k] = value;
    setDrawn({ key: behaviour, guesses: new Map(current.guesses).set(net, next), result: null });
  };

  const at = (e: PointerEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    return {
      k: Math.floor((e.clientX - box.left - PAD) / cellW),
      i: Math.floor((e.clientY - box.top - AXIS_H) / ROW_H),
    };
  };

  const check = () => {
    const guesses = new Map(question.rows.filter((r) => !r.given).map((r) => [r.net, guessOf(r.net)]));
    setDrawn({ key: behaviour, guesses, result: grade(question, guesses) });
  };

  const playInDiagram = () => {
    const sim = useSimStore.getState();
    sim.reset(circuit);
    const s = useSimStore.getState().sim!;
    s.runUntil(question.step * question.cells);
    useSimStore.setState((st) => ({ version: st.version + 1, fronts: frontsOf(s), playing: false }));
    useTimingStore.getState().setZoom(null);
    useTimingStore.getState().setTab('timing');
  };

  const wrongCells = (net: string) => result?.wrong.get(net) ?? [];

  return (
    <div className="practice" dir="rtl">
      <div className="practice-bar">
        <span className="practice-status" aria-live="polite">
          {result
            ? result.rightRows === result.rows
              ? 'הכול נכון!'
              : `${result.rightRows} מתוך ${result.rows} אותות נכונים. הקטעים השגויים מסומנים באדום.`
            : 'משרטטים את האותות: לחיצה או גרירה על קטע הופכת אותו ל-0 או ל-1. הערך ב-t = 0 נתון.'}
        </span>
        <span className="practice-tools">
          {hasClock && (
            <label>
              <span>מחזורים</span>
              <select value={periods} onChange={(e) => setPeriods(Number(e.target.value))}>
                {PERIOD_CHOICES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button type="button" className="primary" onClick={check}>
            בדיקה
          </button>
          <button type="button" onClick={() => setAnswerFor(showAnswer ? null : behaviour)} aria-pressed={showAnswer}>
            {showAnswer ? 'הסתרת התשובה' : 'הצגת התשובה'}
          </button>
          <button type="button" onClick={() => setDrawn({ key: behaviour, guesses: new Map(), result: null })}>
            ניקוי
          </button>
          <button type="button" onClick={playInDiagram} title="הרצת המעגל ומעבר לדיאגרמת הזמנים">
            הרצה בדיאגרמה
          </button>
        </span>
      </div>
      <div className="timing-body" dir="ltr">
        <div className="timing-labels" style={{ paddingTop: AXIS_H }}>
          {question.rows.map((r) => {
            const bad = wrongCells(r.net).length;
            return (
              <button
                key={r.net}
                type="button"
                className={`timing-label practice-label${r.given ? ' is-given' : ''}`}
                style={{ height: ROW_H, color: colorOf.get(r.net) }}
                onClick={() =>
                  setSwapped((s) => {
                    const next = new Set(s);
                    if (next.has(r.net)) next.delete(r.net);
                    else next.add(r.net);
                    return next;
                  })
                }
                title={r.given ? 'נתון. לחיצה הופכת אותו לאות לשרטוט' : 'לשרטוט. לחיצה הופכת אותו לנתון'}
              >
                <bdi>{r.label}</bdi>
                <b>{r.given ? 'נתון' : result ? (bad === 0 ? '✓' : '✗') : ''}</b>
              </button>
            );
          })}
        </div>
        <div className="timing-scroll" ref={scroller}>
          <svg
            width={svgWidth}
            height={height}
            className="timing-svg practice-svg"
            role="img"
            aria-label="שרטוט דיאגרמת הזמנים: לחיצה או גרירה על קטע הופכת אותו"
            onPointerDown={(e) => {
              const { k, i } = at(e);
              const row = question.rows[i];
              if (!row || row.given || k < 0 || k >= question.cells) return;
              const value = guessOf(row.net)[k] === 1 ? 0 : 1;
              paint.current = { net: row.net, value };
              e.currentTarget.setPointerCapture(e.pointerId);
              setCell(row.net, k, value);
            }}
            onPointerMove={(e) => {
              if (!paint.current) return;
              setCell(paint.current.net, at(e).k, paint.current.value);
            }}
            onPointerUp={() => (paint.current = null)}
            onPointerCancel={() => (paint.current = null)}
          >
            <g className="timing-axis">
              {labels.map((k) => (
                <g key={k}>
                  <line x1={PAD + k * cellW} x2={PAD + k * cellW} y1={AXIS_H - 5} y2={height} />
                  <text x={PAD + k * cellW} y={AXIS_H - 8}>
                    {fmt(k * question.step)}
                  </text>
                </g>
              ))}
            </g>
            {question.rows.map((r, i) => {
              const color = colorOf.get(r.net);
              const cells: Logic[] = r.given ? r.truth : guessOf(r.net);
              return (
                <g key={r.net} transform={`translate(0 ${AXIS_H + i * ROW_H})`}>
                  {!r.given && (
                    <g className="practice-grid">
                      {r.truth.map((_, k) => (
                        <rect key={k} x={PAD + k * cellW} y={2} width={cellW} height={ROW_H - 4} />
                      ))}
                    </g>
                  )}
                  {r.truth.map((v, k) =>
                    v === 'X' ? (
                      <rect key={`x${k}`} className="wave-x" x={PAD + k * cellW} y={HIGH} width={cellW} height={LOW - HIGH} />
                    ) : null,
                  )}
                  {wrongCells(r.net).map((k) => (
                    <rect key={`w${k}`} className="practice-wrong" x={PAD + k * cellW} y={2} width={cellW} height={ROW_H - 4} />
                  ))}
                  <path className="wave" d={cellsPath(cells, cellW)} stroke={color} />
                  {showAnswer && !r.given && (
                    <path className="practice-answer" d={cellsPath(r.truth, cellW)} />
                  )}
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    </div>
  );
}
