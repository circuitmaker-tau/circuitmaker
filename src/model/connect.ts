/**
 * Rules for drawing a single wire in the editor. The same checks run while
 * the user drags (to show which handles accept the wire) and on drop.
 */
import { inputsOfComponent, outputPortsOf } from './catalog';
import type { Circuit, PortRef } from './types';

export type ConnectCheck = { ok: true } | { ok: false; reason: string };

export function canConnect(circuit: Circuit, from: PortRef, to: PortRef): ConnectCheck {
  const src = circuit.components.find((c) => c.id === from.component);
  const dst = circuit.components.find((c) => c.id === to.component);
  if (!src || !dst) return { ok: false, reason: 'אחד הרכיבים לא קיים' };
  if (!outputPortsOf(src.type).includes(from.port)) {
    return { ok: false, reason: 'חוט חייב לצאת מיציאה של רכיב' };
  }
  if (!inputsOfComponent(dst).includes(to.port)) {
    return { ok: false, reason: 'חוט חייב להיכנס לכניסה של רכיב' };
  }
  const taken = circuit.wires.some((w) => w.to.component === to.component && w.to.port === to.port);
  if (taken) {
    return {
      ok: false,
      reason: `הכניסה ${to.port} של ${dst.id} כבר מחוברת. מחק קודם את החוט הקיים`,
    };
  }
  return { ok: true };
}
