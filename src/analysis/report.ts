/**
 * Everything the analysis panel shows for one output, computed once per
 * circuit version: the circuit is immutable data (every edit makes a new
 * object), so it can key the cache.
 */
import type { Circuit } from '../model';
import { truthTable, unsupportedReason, variablesOf } from './func';
import { analyse, pathsFrom, scanTransitions } from './hazards';

function compute(circuit: Circuit, net: string) {
  const reason = unsupportedReason(circuit);
  if (reason) return { ok: false, reason } as const;
  const vars = variablesOf(circuit).map((v) => v.id);
  const simulated = scanTransitions(circuit, net);
  return {
    ok: true,
    vars,
    table: truthTable(circuit, net),
    analytic: analyse(circuit, net),
    simulated,
    // the fastest and the slowest path from the switch that changes, for each finding
    races: simulated.map((h) => racingPaths(circuit, vars[h.variable], net)),
  } as const;
}

/** The two paths that race, and the component and wire ids along each (for the highlight). */
function racingPaths(circuit: Circuit, switchId: string, net: string) {
  const paths = pathsFrom(circuit, switchId, net);
  if (paths.length < 2) return null;
  const pair = [paths[0], paths[paths.length - 1]];
  const highlight = new Map<string, number>();
  pair.forEach((p, i) => {
    const chain = [switchId, ...p.through];
    chain.forEach((id, j) => {
      if (j > 0 && !highlight.has(id)) highlight.set(id, i);
      const w = circuit.wires.find(
        (x) => x.from.component === id && x.to.component === chain[j + 1],
      );
      if (w) highlight.set(w.id, i);
    });
  });
  return { fast: pair[0], slow: pair[1], highlight };
}

export type AnalysisReport = ReturnType<typeof compute>;

const cache = new WeakMap<Circuit, Map<string, AnalysisReport>>();

export function analysisReport(circuit: Circuit, net: string): AnalysisReport {
  let byNet = cache.get(circuit);
  if (!byNet) {
    byNet = new Map();
    cache.set(circuit, byNet);
  }
  let report = byNet.get(net);
  if (!report) {
    report = compute(circuit, net);
    byNet.set(net, report);
  }
  return report;
}
