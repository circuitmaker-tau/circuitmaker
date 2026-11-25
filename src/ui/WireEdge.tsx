import { BaseEdge } from '@xyflow/react';
import type { Edge, EdgeProps } from '@xyflow/react';
import type { Signal } from '../model';
import { useAnalysisStore } from '../store/analysisStore';
import { useSimStore } from '../store/simStore';

/**
 * A wire reads its own value from the simulation, so during playback only the
 * wires whose value changed are redrawn.
 *
 * A wire passes its value on at once: the delay happens inside the component
 * that drives it, so a change on its way through Tp is drawn in that component
 * (ComponentNode, `DelayBar`), and the wire changes colour only when the new
 * value comes out (supervisor's review, 25.11).
 */
export type WireEdgeData = { d: string; net: string };
export type WireFlowEdge = Edge<WireEdgeData, 'wire'>;

const valueClass = (v: Signal | undefined) =>
  v === 1 ? 'sig-1' : v === 0 ? 'sig-0' : v === 'X' ? 'sig-x' : 'sig-none';

export function WireEdge({ id, data }: EdgeProps<WireFlowEdge>) {
  const d = data?.d ?? '';
  const net = data?.net ?? '';
  const value = useSimStore((s) => (s.version >= 0 && s.sim ? s.sim.value(net) : undefined));
  const path = useAnalysisStore((s) => s.highlight.get(id));
  return (
    <>
      {path !== undefined && <path d={d} className={`cm-path on-path-${path}`} />}
      <BaseEdge id={id} path={d} className={`cm-wire ${valueClass(value)}`} interactionWidth={14} />
    </>
  );
}
