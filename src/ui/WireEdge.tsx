import { BaseEdge } from '@xyflow/react';
import type { Edge, EdgeProps } from '@xyflow/react';
import type { Signal } from '../model';

/** `value` is filled in by the engine (milestone 4); until then wires are neutral. */
export type WireEdgeData = { d: string; value?: Signal };
export type WireFlowEdge = Edge<WireEdgeData, 'wire'>;

const valueClass = (v: Signal | undefined) =>
  v === 1 ? 'sig-1' : v === 0 ? 'sig-0' : v === 'X' ? 'sig-x' : 'sig-none';

export function WireEdge({ id, data }: EdgeProps<WireFlowEdge>) {
  return (
    <BaseEdge
      id={id}
      path={data?.d ?? ''}
      className={`cm-wire ${valueClass(data?.value)}`}
      interactionWidth={14}
    />
  );
}
