/**
 * Saving and loading circuits as JSON files (File API export/import).
 * Parsing never throws: it returns either the circuit or the reasons it
 * cannot be loaded, in Hebrew, ready for the UI.
 */
import { validateCircuit, hasErrors } from './validate';
import type { Issue } from './validate';
import { CIRCUIT_VERSION } from './types';
import type { Circuit } from './types';
import { tr } from '../i18n/lang';

export type ParseResult =
  | { ok: true; circuit: Circuit; warnings: Issue[] }
  | { ok: false; errors: string[] };

export function serializeCircuit(circuit: Circuit): string {
  return JSON.stringify(circuit, null, 2) + '\n';
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

export function parseCircuit(text: string): ParseResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, errors: [tr('הקובץ אינו JSON תקין', 'The file is not valid JSON')] };
  }

  const shape: string[] = [];
  if (!isObject(data)) return { ok: false, errors: [tr('הקובץ לא מכיל מעגל', 'The file does not hold a circuit')] };
  if (data.version !== CIRCUIT_VERSION) {
    shape.push(tr(`גרסת קובץ לא נתמכת: ${String(data.version)} (נתמכת ${CIRCUIT_VERSION})`, `Unsupported file version: ${String(data.version)} (supported: ${CIRCUIT_VERSION})`));
  }
  if (typeof data.name !== 'string') shape.push(tr('חסר שם למעגל', 'The circuit has no name'));
  if (data.timeUnit !== 'none' && data.timeUnit !== 'ns' && data.timeUnit !== 's') {
    shape.push(tr('יחידת זמן חייבת להיות none, ns או s', 'The time unit must be none, ns or s'));
  }
  if (!Array.isArray(data.components)) shape.push(tr('חסרה רשימת רכיבים', 'The list of components is missing'));
  if (!Array.isArray(data.wires)) shape.push(tr('חסרה רשימת חוטים', 'The list of wires is missing'));
  if (shape.length > 0) return { ok: false, errors: shape };

  const components = data.components as unknown[];
  const wires = data.wires as unknown[];
  components.forEach((c, i) => {
    if (
      !isObject(c) ||
      typeof c.id !== 'string' ||
      typeof c.type !== 'string' ||
      !isObject(c.position) ||
      typeof c.position.x !== 'number' ||
      typeof c.position.y !== 'number' ||
      typeof c.delay !== 'number' ||
      typeof c.inputs !== 'number' ||
      (c.props !== undefined && !isObject(c.props))
    ) {
      shape.push(tr(`רכיב מספר ${i + 1} חסר שדות חובה`, `Component number ${i + 1} lacks required fields`));
    }
  });
  wires.forEach((w, i) => {
    const ref = (r: unknown) =>
      isObject(r) && typeof r.component === 'string' && typeof r.port === 'string';
    if (!isObject(w) || typeof w.id !== 'string' || !ref(w.from) || !ref(w.to)) {
      shape.push(tr(`חוט מספר ${i + 1} חסר שדות חובה`, `Wire number ${i + 1} lacks required fields`));
    }
  });
  if (shape.length > 0) return { ok: false, errors: shape };

  const circuit = data as unknown as Circuit;
  const issues = validateCircuit(circuit);
  if (hasErrors(issues)) {
    return {
      ok: false,
      errors: issues.filter((i) => i.severity === 'error').map((i) => i.message),
    };
  }
  return { ok: true, circuit, warnings: issues };
}
