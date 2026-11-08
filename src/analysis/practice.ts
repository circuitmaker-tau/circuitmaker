/**
 * "Guess the timing diagram" practice (the question every 2026 exam asks):
 * run the circuit for a while, cut time into equal cells so that every change
 * falls on a cell edge, and give the student the switches and clocks; the
 * other signals are to be drawn, one 0/1 per cell, and graded cell by cell.
 */
import type { Logic } from '../engine/logic';
import { Simulator } from '../engine/simulator';
import type { Transition } from '../engine/simulator';
import type { Circuit } from '../model';
import { delayToTicks } from '../model/time';

export interface PracticeRow {
  net: string;
  label: string;
  /** Given (drawn for the student) or to be drawn. */
  given: boolean;
  /** The right value in every cell. */
  truth: Logic[];
}

export interface Question {
  /** Ticks per cell: every change in the run falls on a multiple of it. */
  step: number;
  /** Number of cells; the run lasts step × cells ticks. */
  cells: number;
  rows: PracticeRow[];
}

export type Guess = (0 | 1)[];

/** Rows of the question: nets in drawing order, with whether each one is given. */
export interface RowSpec {
  net: string;
  label: string;
  given: boolean;
}

export const DEFAULT_PERIODS = 8;
/** More cells than this would be too small to draw on. */
const MAX_CELLS = 200;

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

function valueAt(trace: readonly Transition[], t: number): Logic {
  let v: Logic = trace[0]?.value ?? 'X';
  for (const x of trace) {
    if (x.time > t) break;
    v = x.value;
  }
  return v;
}

/** Why there is nothing to practise, or null. */
export function cannotPractise(circuit: Circuit): string | null {
  const clock = circuit.components.some((c) => c.type === 'CLOCK');
  const scheduled = circuit.components.some((c) => c.type === 'INPUT' && (c.props?.schedule?.length ?? 0) > 0);
  if (!clock && !scheduled) {
    return 'כדי לתרגל צריך שמשהו ישתנה בזמן: שעון, או מתג עם "שינויים מתוזמנים" (בפאנל המאפיינים, למשל 5:1).';
  }
  return null;
}

/**
 * Build the question: run from the steady state for `periods` clock periods
 * (or, without a clock, until the last scheduled change has settled).
 */
export function buildQuestion(circuit: Circuit, specs: RowSpec[], periods = DEFAULT_PERIODS): Question {
  const sim = new Simulator(circuit);
  const clock = circuit.components.find((c) => c.type === 'CLOCK');
  const changes = () => specs.flatMap((s) => sim.trace(s.net).map((t) => t.time)).filter((t) => t > 0);
  let end: number;
  let step: number;
  if (clock) {
    end = periods * 2 * Math.max(1, delayToTicks(clock.props?.halfPeriod ?? 1));
    sim.runUntil(end);
    step = changes().filter((t) => t < end).reduce(gcd, end);
  } else {
    sim.runToEnd();
    const times = changes();
    const last = Math.max(0, ...times);
    step = times.reduce(gcd, 0) || 10;
    // a little calm after the last change, so the student sees where it ends; whole cells
    end = Math.ceil((last + Math.max(2 * step, last / 4)) / step) * step;
  }
  let cells = Math.round(end / step);
  if (cells > MAX_CELLS) {
    step = Math.ceil(end / MAX_CELLS);
    cells = Math.ceil(end / step);
  }
  return {
    step,
    cells,
    rows: specs.map((s) => {
      const trace = sim.trace(s.net);
      return { ...s, truth: Array.from({ length: cells }, (_, k) => valueAt(trace, k * step)) };
    }),
  };
}

/** The starting drawing: every row stays at its value at t = 0, as the exam gives it. */
export function blankGuess(row: PracticeRow): Guess {
  const start = row.truth[0] === 1 ? 1 : 0;
  return row.truth.map(() => start);
}

export interface Grade {
  /** For each row to draw, the cells that are wrong. */
  wrong: Map<string, number[]>;
  rightRows: number;
  rows: number;
}

/** Compare cell by cell; an unknown (X) cell is not graded. */
export function grade(question: Question, guesses: Map<string, Guess>): Grade {
  const wrong = new Map<string, number[]>();
  let rightRows = 0;
  let rows = 0;
  for (const r of question.rows) {
    if (r.given) continue;
    rows++;
    const g = guesses.get(r.net) ?? blankGuess(r);
    const bad = r.truth.flatMap((v, k) => (v !== 'X' && v !== g[k] ? [k] : []));
    wrong.set(r.net, bad);
    if (bad.length === 0) rightRows++;
  }
  return { wrong, rightRows, rows };
}
