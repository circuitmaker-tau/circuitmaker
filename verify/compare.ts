/**
 * Runs a circuit in Icarus Verilog and in our simulator and compares every
 * change of every net (work plan: testing against Icarus Verilog).
 * Needs `iverilog` and `vvp` on the PATH.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Simulator } from '../src/engine/simulator';
import type { Circuit } from '../src/model';
import { toVerilog } from '../src/verilog/toVerilog';

type Wave = [time: number, value: string][];

export interface Comparison {
  /** Nets whose waveforms differ, with both versions. */
  mismatches: { net: string; ours: string; icarus: string }[];
  nets: number;
  transitions: number;
  unsupported: string[];
}

/** Keep the last value at each tick and drop repeats; time 0 is the starting value. */
function normalise(events: Wave): Wave {
  const byTime = new Map<number, string>();
  for (const [t, v] of events) byTime.set(t, v);
  const out: Wave = [];
  for (const [t, v] of [...byTime].sort((a, b) => a[0] - b[0])) {
    if (out.length === 0 || out[out.length - 1][1] !== v) out.push([t, v]);
  }
  return out;
}

const show = (w: Wave) => w.map(([t, v]) => `${t / 10}:${v}`).join(' ');

export function compareWithIcarus(circuit: Circuit, untilTicks: number): Comparison {
  const { source, nets, unsupported } = toVerilog(circuit, untilTicks);
  const dir = mkdtempSync(join(tmpdir(), 'cm-icarus-'));
  writeFileSync(join(dir, 'tb.v'), source);
  execFileSync('iverilog', ['-g2012', '-o', join(dir, 'tb.vvp'), join(dir, 'tb.v')]);
  const output = execFileSync('vvp', ['-n', join(dir, 'tb.vvp')], { encoding: 'utf8' });

  const icarus = nets.map((): Wave => []);
  for (const line of output.split('\n')) {
    const m = /^(\d+) (\d+) ([01xz])$/.exec(line.trim());
    if (!m) continue;
    const t = Number(m[1]);
    if (t < untilTicks) icarus[Number(m[2])].push([t, m[3] === 'x' ? 'X' : m[3]]);
  }

  const sim = new Simulator(circuit);
  sim.runUntil(untilTicks - 1);
  const mismatches: Comparison['mismatches'] = [];
  let transitions = 0;
  nets.forEach((net, k) => {
    const ours = normalise(sim.trace(net).map((x) => [x.time, String(x.value)]));
    const start = sim.trace(net)[0]?.value;
    // Icarus prints only changes; its starting value is the one we gave it
    const theirs = normalise([[0, String(start)], ...icarus[k]]);
    transitions += ours.length - 1;
    if (show(ours) !== show(theirs))
      mismatches.push({ net, ours: show(ours), icarus: show(theirs) });
  });
  return { mismatches, nets: nets.length, transitions, unsupported };
}
