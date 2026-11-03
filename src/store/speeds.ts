/** Playback speeds, as multiples of the default (×1: one typical Tp in 600 ms). */
export const SPEEDS = [0.25, 0.5, 1, 2, 4] as const;
export type Speed = (typeof SPEEDS)[number];
