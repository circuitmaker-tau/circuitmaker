/**
 * Our simulator against Icarus Verilog, change by change. Runs only where
 * Icarus is installed (the CI job installs it): `npm run test:icarus`.
 */
import { describe, expect, it } from 'vitest';
import { COURSE_CASES, RANDOM_CASES } from './cases';
import { compareWithIcarus } from './compare';

describe.each([
  ['course circuits', COURSE_CASES],
  ['random circuits', RANDOM_CASES],
])('%s give the same waveforms as Icarus Verilog', (_, cases) => {
  it.each(cases.map((c) => [c.name, c] as const))('%s', (_name, c) => {
    const result = compareWithIcarus(c.circuit, c.until);
    expect(result.unsupported).toEqual([]);
    expect(result.mismatches).toEqual([]);
  });
});
