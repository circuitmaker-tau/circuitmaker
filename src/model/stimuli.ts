/**
 * Text form of a switch's planned changes, as typed in the properties panel:
 * "5:0 10:1" means "goes to 0 at t = 5, back to 1 at t = 10".
 */
import { isValidDelay } from './time';
import type { Stimulus } from './types';

export type ParsedSchedule = { ok: true; schedule: Stimulus[] } | { ok: false; error: string };

export function parseSchedule(text: string): ParsedSchedule {
  const parts = text
    .split(/[\s,;]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  const schedule: Stimulus[] = [];
  for (const part of parts) {
    const m = /^(\d+(?:\.\d+)?)\s*[:=]\s*([01])$/.exec(part);
    const time = m ? Number(m[1]) : NaN;
    if (!m || !isValidDelay(time)) {
      return { ok: false, error: `"${part}" אינו בצורה זמן:ערך, למשל 5:0 (זמן בקפיצות של 0.1)` };
    }
    schedule.push({ time, value: m[2] === '1' ? 1 : 0 });
  }
  schedule.sort((a, b) => a.time - b.time);
  for (let i = 1; i < schedule.length; i++) {
    if (schedule[i].time === schedule[i - 1].time) {
      return { ok: false, error: `שני שינויים באותו זמן (t = ${schedule[i].time})` };
    }
  }
  return { ok: true, schedule };
}

export const formatSchedule = (schedule: readonly Stimulus[] | undefined) =>
  (schedule ?? []).map((s) => `${s.time}:${s.value}`).join(' ');
