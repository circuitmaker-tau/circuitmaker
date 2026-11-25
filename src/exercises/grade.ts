/**
 * Grading a submitted exercise: does the circuit compute the function, does it
 * keep the limits of the question, and how many parts does it take.
 *
 * Score out of 100: 60 for the function (by the share of correct rows), 25 for
 * the limits (all or nothing per broken limit, scaled by the function), and 15
 * for economy, given only when the function is right and the limits are kept.
 */
import { settle } from '../engine/settle';
import type { Logic } from '../engine/logic';
import { withInputs } from '../analysis/func';
import { CATALOG, flattenBlocks } from '../model';
import type { Circuit, Component, ComponentType } from '../model';
import type { Exercise } from './exercises';
import { labelOf } from '../i18n/components';
import { tr } from '../i18n/lang';

export type Note = { kind: 'good' | 'error' | 'warn'; text: string };

export interface Grade {
  score: number;
  /** Points for the function, the limits and economy. */
  parts: { function: number; rules: number; economy: number };
  correctRows: number;
  totalRows: number;
  /** Components used (constants, switches and lamps not counted). */
  used: number;
  notes: Note[];
}

const GATES = new Set<ComponentType>(['AND', 'OR', 'NAND', 'NOR', 'XOR', 'XNOR']);
const FREE = new Set<ComponentType>(['INPUT', 'OUTPUT', 'CONST0', 'CONST1']);

const label = (t: ComponentType) => (GATES.has(t) || t === 'NOT' ? t : labelOf(t));

function list(ids: string[]) {
  return ids.length <= 4 ? ids.join(', ') : tr(`${ids.slice(0, 4).join(', ')} ועוד ${ids.length - 4}`, `${ids.slice(0, 4).join(', ')} and ${ids.length - 4} more`);
}

function row(ex: Exercise, m: number) {
  const n = ex.inputs.length;
  return ex.inputs.map((v, k) => `${v}=${(m >> (n - 1 - k)) & 1}`).join(' ');
}

export function gradeExercise(circuit: Circuit, ex: Exercise): Grade {
  const notes: Note[] = [];
  // the parts inside the student's own blocks count as parts
  const flat = flattenBlocks(circuit).circuit;
  const parts = flat.components.filter((c) => !FREE.has(c.type));

  // ------------------------------------------------------------ the limits
  const broken: string[] = [];
  const byType = new Map<ComponentType, Component[]>();
  for (const c of parts) byType.set(c.type, [...(byType.get(c.type) ?? []), c]);
  const outer = (id: string) => id.split('/')[0];

  for (const [type, cs] of byType) {
    if (!ex.rules.allowed.includes(type)) {
      broken.push(tr(`${label(type)} אסור בשאלה הזאת (${list([...new Set(cs.map((c) => outer(c.id)))])}).`, `${label(type)} is not allowed in this question (${list([...new Set(cs.map((c) => outer(c.id)))])}).`));
      continue;
    }
    const max = ex.rules.max?.[type];
    if (max !== undefined && cs.length > max) {
      broken.push(tr(`מותר עד ${max} ${label(type)}, והשתמשתם ב-${cs.length}.`, `Up to ${max} ${label(type)} allowed, and you used ${cs.length}.`));
    }
  }
  if (!ex.rules.constants) {
    const consts = flat.components.filter((c) => c.type === 'CONST0' || c.type === 'CONST1');
    if (consts.length) broken.push(tr(`אסור להשתמש בקבועים 0 ו-1 (${list(consts.map((c) => outer(c.id)))}).`, `The constants 0 and 1 are not allowed (${list(consts.map((c) => outer(c.id)))}).`));
  }
  if (ex.rules.maxFanIn !== undefined) {
    const wide = parts.filter((c) => GATES.has(c.type) && c.inputs > ex.rules.maxFanIn!);
    if (wide.length) {
      broken.push(tr(`מותר עד ${ex.rules.maxFanIn} כניסות לשער, ול-${list(wide.map((c) => outer(c.id)))} יש יותר.`, `Up to ${ex.rules.maxFanIn} inputs per gate allowed, and ${list(wide.map((c) => outer(c.id)))} have more.`));
    }
  }
  if (ex.rules.maxParts !== undefined && parts.length > ex.rules.maxParts) {
    broken.push(tr(`מותר עד ${ex.rules.maxParts} רכיבים, והשתמשתם ב-${parts.length}.`, `Up to ${ex.rules.maxParts} components allowed, and you used ${parts.length}.`));
  }
  const switches = circuit.components.filter((c) => c.type === 'INPUT').map((c) => c.id);
  const missing = ex.inputs.filter((v) => !switches.includes(v));
  const extra = switches.filter((v) => !ex.inputs.includes(v));
  if (missing.length) broken.push(tr(`המתג ${list(missing)} חסר. כדאי להתחיל מחדש את השאלה.`, `The switch ${list(missing)} is missing. Better start the question again.`));
  if (extra.length) broken.push(tr(`אסור להוסיף מתגים (${list(extra)}): יש רק ${ex.inputs.join(', ')}.`, `Adding switches is not allowed (${list(extra)}): there are only ${ex.inputs.join(', ')}.`));
  if (flat.components.some((c) => CATALOG[c.type].category === 'sequential' || c.type === 'CLOCK')) {
    broken.push(tr('זו שאלה על מעגל צירופי: בלי שעון, latch או flip-flop.', 'This question is about a combinational circuit: no clock, latch or flip-flop.'));
  }

  // ------------------------------------------------------------ the function
  const n = ex.inputs.length;
  const rows = 1 << n;
  let correct = 0;
  const vars = ex.inputs.map((id) => circuit.components.find((c) => c.id === id && c.type === 'INPUT'));
  const lamps = ex.outputs.map((o) => ({ o, w: circuit.wires.find((w) => w.to.component === o.id) }));
  for (const { o, w } of lamps) {
    if (!circuit.components.some((c) => c.id === o.id && c.type === 'OUTPUT')) {
      notes.push({ kind: 'error', text: tr(`הנורה ${o.id} חסרה. כדאי להתחיל מחדש את השאלה.`, `The lamp ${o.id} is missing. Better start the question again.`) });
      continue;
    }
    if (!w) {
      notes.push({ kind: 'error', text: tr(`שום דבר לא מחובר לנורה ${o.id}.`, `Nothing is connected to the lamp ${o.id}.`) });
      continue;
    }
  }
  const wrong: { out: string; m: number; got: Logic; want: 0 | 1 }[] = [];
  if (missing.length === 0) {
    for (let m = 0; m < rows; m++) {
      const nets = settle(withInputs(circuit, vars as Component[], m)).nets;
      for (const { o, w } of lamps) {
        const got: Logic = w ? (nets.get(`${w.from.component}:${w.from.port}`) ?? 'X') : 'X';
        if (got === o.table[m]) correct++;
        else wrong.push({ out: o.id, m, got, want: o.table[m] });
      }
    }
  }
  const total = rows * ex.outputs.length;
  const frac = correct / total;

  if (wrong.length === 0 && missing.length === 0) {
    notes.unshift({ kind: 'good', text: tr(`המעגל נכון בכל ${rows} השורות של טבלת האמת.`, `The circuit is right in all ${rows} rows of the truth table.`) });
  } else if (missing.length === 0) {
    notes.unshift({ kind: 'error', text: tr(`${wrong.length} מתוך ${total} השורות לא נכונות.`, `${wrong.length} of the ${total} rows are wrong.`) });
    const unknown = wrong.filter((x) => x.got === 'X');
    if (unknown.length) {
      notes.push({
        kind: 'warn',
        text: tr(`ב-${unknown.length} שורות היציאה לא מוגדרת (X): כנראה יש כניסה של רכיב שלא מחוברת.`, `In ${unknown.length} rows the output is undefined (X): a component input is probably not connected.`),
      });
    }
    for (const x of wrong.filter((y) => y.got !== 'X').slice(0, 3)) {
      const out = ex.outputs.length > 1 ? `${x.out}: ` : '';
      notes.push({ kind: 'error', text: tr(`${out}כש-${row(ex, x.m)} המעגל מוציא ${x.got}, וצריך ${x.want}.`, `${out}when ${row(ex, x.m)} the circuit gives ${x.got}, and it should be ${x.want}.`) });
    }
  }
  for (const b of broken) notes.push({ kind: 'error', text: b });
  if (broken.length === 0 && parts.length > 0) notes.push({ kind: 'good', text: tr('כל המגבלות של השאלה נשמרו.', 'Every rule of the question was kept.') });

  // ------------------------------------------------------------ the score
  const fn = 60 * frac;
  const rules = parts.length === 0 ? 0 : Math.max(0, 25 - 12.5 * broken.length) * frac;
  let economy = 0;
  if (frac === 1 && broken.length === 0) {
    const used = parts.length;
    economy = used <= ex.best ? 15 : used === ex.best + 1 ? 10 : 5;
    notes.push(
      used < ex.best
        ? { kind: 'good', text: tr(`${used} רכיבים: פחות מבפתרון שלנו (${ex.best}). יפה!`, `${used} components: fewer than in our solution (${ex.best}). Nice!`) }
        : used === ex.best
          ? { kind: 'good', text: tr(`${used} רכיבים, כמו בפתרון שלנו.`, `${used} components, as in our solution.`) }
          : { kind: 'warn', text: tr(`${used} רכיבים. בפתרון שלנו יש ${ex.best}: אפשר לחסוך.`, `${used} components. Our solution has ${ex.best}: you can save some.`) },
    );
  }
  return {
    score: Math.round(fn + rules + economy),
    parts: { function: Math.round(fn), rules: Math.round(rules), economy },
    correctRows: correct,
    totalRows: total,
    used: parts.length,
    notes,
  };
}
