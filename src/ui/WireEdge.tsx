import { BaseEdge } from '@xyflow/react';
import type { Edge, EdgeProps } from '@xyflow/react';
import type { Signal } from '../model';
import { useAnalysisStore } from '../store/analysisStore';
import { useSimStore } from '../store/simStore';

/**
 * A wire reads its own value from the simulation, so during playback only the
 * wires whose value or in-flight changes moved are redrawn.
 *
 * `fronts` are new values on their way through the delay of the component that
 * drives the wire: each is drawn from the source end up to its progress (0 to
 * 1), so a change is seen travelling along the wire during Tp (work plan,
 * animation).
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
      <Fronts d={d} net={net} />
    </>
  );
}

/** Separate from the wire itself, so a moving front redraws only these paths. */
function Fronts({ d, net }: { d: string; net: string }) {
  const fronts = useSimStore((s) => s.fronts.get(net));
  return fronts?.map((f, i) => (
    <path
      key={i}
      d={d}
      pathLength={1}
      strokeDasharray={`${f.progress} 2`}
      className={`cm-wire cm-front ${valueClass(f.value)}`}
    />
  ));
}
