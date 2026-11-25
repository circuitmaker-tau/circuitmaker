/**
 * Rules for drawing a single wire in the editor. The same checks run while
 * the user drags (to show which handles accept the wire) and on drop.
 */
import { inputsOfComponent, outputsOfComponent } from './catalog';
import type { Circuit, PortRef } from './types';
import { tr } from '../i18n/lang';

export type ConnectCheck = { ok: true } | { ok: false; reason: string };

export function canConnect(circuit: Circuit, from: PortRef, to: PortRef): ConnectCheck {
  const src = circuit.components.find((c) => c.id === from.component);
  const dst = circuit.components.find((c) => c.id === to.component);
  if (!src || !dst) return { ok: false, reason: tr('אחד הרכיבים לא קיים', 'One of the components does not exist') };
  if (!outputsOfComponent(src).includes(from.port)) {
    return { ok: false, reason: tr('חוט חייב לצאת מיציאה של רכיב', 'A wire must start at an output of a component') };
  }
  if (!inputsOfComponent(dst).includes(to.port)) {
    return { ok: false, reason: tr('חוט חייב להיכנס לכניסה של רכיב', 'A wire must end at an input of a component') };
  }
  const taken = circuit.wires.some((w) => w.to.component === to.component && w.to.port === to.port);
  if (taken) {
    return {
      ok: false,
      reason: tr(
        `הכניסה ${to.port} של ${dst.id} כבר מחוברת. מחק קודם את החוט הקיים`,
        `The input ${to.port} of ${dst.id} is already connected. Delete the existing wire first`,
      ),
    };
  }
  return { ok: true };
}
