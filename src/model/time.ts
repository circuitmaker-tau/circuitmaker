/**
 * Time handling (rule E1). Tp is entered as a decimal in steps of 0.1 and the
 * engine works only in integer ticks, so exam values such as 1.5 never pick
 * up rounding errors.
 */
export const TICKS_PER_UNIT = 10;

const EPSILON = 1e-9;

/** True when the value is a non-negative number on the 0.1 grid. */
export function isValidDelay(value: unknown): value is number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return false;
  const scaled = value * TICKS_PER_UNIT;
  return Math.abs(scaled - Math.round(scaled)) < EPSILON;
}

export function delayToTicks(delay: number): number {
  return Math.round(delay * TICKS_PER_UNIT);
}

export function ticksToDelay(ticks: number): number {
  return ticks / TICKS_PER_UNIT;
}
