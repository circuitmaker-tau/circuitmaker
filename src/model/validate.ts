/**
 * Structural checks on a circuit before it is simulated or saved.
 * Errors make the circuit unusable; warnings are shown but allowed
 * (an unconnected input simply reads X, rule E7).
 */
import { CATALOG, inputsOfComponent, isOptionalInput, outputsOfComponent } from './catalog';
import { isValidDelay } from './time';
import { COMPONENT_TYPES } from './types';
import type { Circuit, Component, ComponentType, PortRef } from './types';
import { tr } from '../i18n/lang';

export type IssueCode =
  | 'DUPLICATE_COMPONENT_ID'
  | 'DUPLICATE_WIRE_ID'
  | 'UNKNOWN_TYPE'
  | 'BAD_INPUT_COUNT'
  | 'BAD_DELAY'
  | 'BAD_PROP'
  | 'WIRE_UNKNOWN_COMPONENT'
  | 'WIRE_UNKNOWN_PORT'
  | 'WIRE_FROM_NOT_OUTPUT'
  | 'WIRE_TO_NOT_INPUT'
  | 'INPUT_MULTIPLE_DRIVERS'
  | 'UNCONNECTED_INPUT';

export interface Issue {
  severity: 'error' | 'warning';
  code: IssueCode;
  /** Hebrew message for the UI. */
  message: string;
  componentId?: string;
  wireId?: string;
}

const isType = (t: unknown): t is ComponentType =>
  typeof t === 'string' && (COMPONENT_TYPES as readonly string[]).includes(t);

const isBit = (v: unknown) => v === 0 || v === 1;

function checkComponent(c: Component, issues: Issue[]): void {
  const err = (code: IssueCode, message: string) =>
    issues.push({ severity: 'error', code, message, componentId: c.id });

  if (!isType(c.type)) {
    err('UNKNOWN_TYPE', tr(`סוג רכיב לא מוכר: ${String(c.type)}`, `Unknown component type: ${String(c.type)}`));
    return;
  }
  const def = CATALOG[c.type];
  if (c.type === 'BLOCK') {
    const pins = c.props?.pins;
    const names = (x: unknown) => Array.isArray(x) && x.every((n) => typeof n === 'string');
    if (typeof c.props?.block !== 'string' || !pins || !names(pins.in) || !names(pins.out)) {
      err('BAD_PROP', tr(`לבלוק ${c.id} חסרים השם והכניסות והיציאות שלו`, `The block ${c.id} lacks its name, inputs and outputs`));
    }
  } else if (!Number.isInteger(c.inputs) || c.inputs < def.minInputs || c.inputs > def.maxInputs) {
    err(
      'BAD_INPUT_COUNT',
      def.minInputs === def.maxInputs
        ? tr(`ל-${c.type} יש בדיוק ${def.minInputs} כניסות`, `${c.type} has exactly ${def.minInputs} inputs`)
        : tr(`ל-${c.type} אפשר ${def.minInputs} עד ${def.maxInputs} כניסות`, `${c.type} can have ${def.minInputs} to ${def.maxInputs} inputs`),
    );
  }
  if (!isValidDelay(c.delay)) {
    err('BAD_DELAY', tr('Tp חייב להיות מספר אי-שלילי בקפיצות של 0.1', 'Tp must be a non-negative number in steps of 0.1'));
  }

  const p = c.props ?? {};
  for (const key of ['tpLH', 'tpHL'] as const) {
    if (p[key] !== undefined && !isValidDelay(p[key])) {
      err('BAD_PROP', tr(`${key} חייב להיות מספר אי-שלילי בקפיצות של 0.1`, `${key} must be a non-negative number in steps of 0.1`));
    }
  }
  if (p.init !== undefined) {
    if (!def.stateful) err('BAD_PROP', tr('ערך התחלתי מתאים רק ל-latch ול-flip-flop', 'An initial value is only for a latch or a flip-flop'));
    else if (p.init !== 0 && p.init !== 1 && p.init !== 'X') {
      err('BAD_PROP', tr('ערך התחלתי חייב להיות 0, 1 או X', 'An initial value must be 0, 1 or X'));
    }
  }
  if (c.type === 'INPUT' && p.value !== undefined && !isBit(p.value)) {
    err('BAD_PROP', tr('ערך המתג חייב להיות 0 או 1', 'A switch value must be 0 or 1'));
  }
  if (p.schedule !== undefined) {
    const ok =
      c.type === 'INPUT' &&
      Array.isArray(p.schedule) &&
      p.schedule.every(
        (s: unknown) =>
          typeof s === 'object' &&
          s !== null &&
          isValidDelay((s as { time: unknown }).time) &&
          isBit((s as { value: unknown }).value),
      );
    if (!ok) err('BAD_PROP', tr('רצף השינויים של מתג חייב להיות רשימה של זמן וערך 0 או 1', 'The scheduled changes of a switch must be a list of a time and a value 0 or 1'));
  }
  if (c.type === 'CLOCK') {
    if (!isValidDelay(p.halfPeriod) || p.halfPeriod === 0) {
      err('BAD_PROP', tr('חצי מחזור של השעון חייב להיות חיובי, בקפיצות של 0.1', 'The half period of a clock must be positive, in steps of 0.1'));
    }
    if (p.startLevel !== undefined && !isBit(p.startLevel)) {
      err('BAD_PROP', tr('רמת ההתחלה של השעון חייבת להיות 0 או 1', 'The start level of a clock must be 0 or 1'));
    }
  }
}

export function validateCircuit(circuit: Circuit): Issue[] {
  const issues: Issue[] = [];
  const byId = new Map<string, Component>();

  for (const c of circuit.components) {
    if (byId.has(c.id)) {
      issues.push({
        severity: 'error',
        code: 'DUPLICATE_COMPONENT_ID',
        message: tr(`המזהה ${c.id} מופיע יותר מפעם אחת`, `The id ${c.id} appears more than once`),
        componentId: c.id,
      });
      continue;
    }
    byId.set(c.id, c);
    checkComponent(c, issues);
    if (c.type === 'BLOCK' && !(circuit.blocks ?? []).some((b) => b.name === c.props?.block)) {
      issues.push({
        severity: 'error',
        code: 'BAD_PROP',
        message: tr(`הבלוק ${String(c.props?.block)} של ${c.id} לא נמצא בבלוקים של המעגל`, `The block ${String(c.props?.block)} of ${c.id} is not among the blocks of the circuit`),
        componentId: c.id,
      });
    }
  }

  const wireIds = new Set<string>();
  const drivers = new Map<string, string[]>(); // "comp:port" -> wire ids

  const resolve = (ref: PortRef, wireId: string, side: 'from' | 'to'): boolean => {
    const err = (code: IssueCode, message: string) =>
      issues.push({ severity: 'error', code, message, wireId });
    const c = byId.get(ref.component);
    if (!c || !isType(c.type)) {
      err('WIRE_UNKNOWN_COMPONENT', tr(`חוט ${wireId} מחובר לרכיב שלא קיים: ${ref.component}`, `Wire ${wireId} is connected to a component that does not exist: ${ref.component}`));
      return false;
    }
    const ins = inputsOfComponent(c);
    const outs = outputsOfComponent(c);
    if (!ins.includes(ref.port) && !outs.includes(ref.port)) {
      err('WIRE_UNKNOWN_PORT', tr(`לרכיב ${c.id} אין פורט בשם ${ref.port}`, `The component ${c.id} has no port called ${ref.port}`));
      return false;
    }
    if (side === 'from' && !outs.includes(ref.port)) {
      err('WIRE_FROM_NOT_OUTPUT', tr(`חוט ${wireId} חייב לצאת מיציאה, ו-${ref.port} היא כניסה`, `Wire ${wireId} must start at an output, and ${ref.port} is an input`));
      return false;
    }
    if (side === 'to' && !ins.includes(ref.port)) {
      err('WIRE_TO_NOT_INPUT', tr(`חוט ${wireId} חייב להיכנס לכניסה, ו-${ref.port} היא יציאה`, `Wire ${wireId} must end at an input, and ${ref.port} is an output`));
      return false;
    }
    return true;
  };

  for (const w of circuit.wires) {
    if (wireIds.has(w.id)) {
      issues.push({
        severity: 'error',
        code: 'DUPLICATE_WIRE_ID',
        message: tr(`המזהה ${w.id} מופיע יותר מפעם אחת`, `The id ${w.id} appears more than once`),
        wireId: w.id,
      });
      continue;
    }
    wireIds.add(w.id);
    const okFrom = resolve(w.from, w.id, 'from');
    const okTo = resolve(w.to, w.id, 'to');
    if (okFrom && okTo) {
      const key = `${w.to.component}:${w.to.port}`;
      drivers.set(key, [...(drivers.get(key) ?? []), w.id]);
    }
  }

  for (const [key, wires] of drivers) {
    if (wires.length > 1) {
      const [component, port] = key.split(':');
      issues.push({
        severity: 'error',
        code: 'INPUT_MULTIPLE_DRIVERS',
        message: tr(`לכניסה ${port} של ${component} מחוברים ${wires.length} חוטים; מותר אחד`, `${wires.length} wires go into the input ${port} of ${component}; one is allowed`),
        componentId: component,
      });
    }
  }

  for (const c of byId.values()) {
    if (!isType(c.type)) continue;
    for (const port of inputsOfComponent(c)) {
      // an unconnected CLR' or PRE' is simply inactive
      if (!drivers.has(`${c.id}:${port}`) && !isOptionalInput(port)) {
        issues.push({
          severity: 'warning',
          code: 'UNCONNECTED_INPUT',
          message: tr(`הכניסה ${port} של ${c.id} לא מחוברת, ולכן ערכה X`, `The input ${port} of ${c.id} is not connected, so its value is X`),
          componentId: c.id,
        });
      }
    }
  }

  return issues;
}

export const hasErrors = (issues: Issue[]) => issues.some((i) => i.severity === 'error');
