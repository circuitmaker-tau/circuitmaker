/**
 * Glitches (rule E8): a pulse whose start and end both follow from the same
 * single outside change (one switch flip, one clock edge). It exists only
 * because different paths have different delays, as in a static or dynamic
 * hazard. A pulse that just copies a pulse at the input is not a glitch: its
 * two edges have two different causes. The timing diagram marks each glitch
 * with its width, which is how a student "measures the duration of the glitch".
 */
import type { Transition } from './simulator';

export interface Glitch {
  /** Ticks. */
  start: number;
  end: number;
  /** Value during the pulse. */
  value: 0 | 1;
}

export function findGlitches(trace: readonly Transition[]): Glitch[] {
  const glitches: Glitch[] = [];
  for (let i = 1; i + 1 < trace.length; i++) {
    const pulse = trace[i];
    const after = trace[i + 1];
    if (pulse.value === 'X' || pulse.cause < 0 || pulse.cause !== after.cause) continue;
    glitches.push({ start: pulse.time, end: after.time, value: pulse.value });
  }
  return glitches;
}
