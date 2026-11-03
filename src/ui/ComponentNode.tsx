import { Handle, Position } from '@xyflow/react';
import type { Node, NodeProps } from '@xyflow/react';
import { CATALOG, inputPortsOf, outputPortsOf } from '../model';
import type { Component } from '../model';
import { useCircuitStore } from '../store/circuitStore';

export type ComponentNodeData = { component: Component };
export type ComponentFlowNode = Node<ComponentNodeData, 'component'>;

const ROW = 20;

/** Vertical position of the i-th of n handles, centred on the body. */
const handleTop = (i: number, n: number, height: number) => height / 2 + (i - (n - 1) / 2) * ROW;

export function ComponentNode({ data, selected }: NodeProps<ComponentFlowNode>) {
  const c = data.component;
  const def = CATALOG[c.type];
  const ins = inputPortsOf(c.type, c.inputs);
  const outs = outputPortsOf(c.type);
  const height = Math.max(ins.length, outs.length, 1) * ROW + 16;
  const showPortNames = def.category !== 'gate' && c.type !== 'OUTPUT';
  const toggleInput = useCircuitStore((s) => s.toggleInput);

  return (
    <div
      className={`cm-node cm-${def.category}${selected ? ' is-selected' : ''}`}
      style={{ height }}
    >
      {ins.map((port, i) => (
        <Handle
          key={port}
          id={port}
          type="target"
          position={Position.Left}
          style={{ top: handleTop(i, ins.length, height) }}
        >
          {showPortNames && <span className="cm-port cm-port-in">{port}</span>}
        </Handle>
      ))}

      <div className="cm-body">
        {c.type === 'INPUT' ? (
          <button
            type="button"
            className="cm-switch nodrag"
            aria-label={`מתג ${c.id}, ערך ${c.props?.value ?? 0}`}
            onClick={() => toggleInput(c.id)}
          >
            {c.props?.value ?? 0}
          </button>
        ) : c.type === 'CONST0' || c.type === 'CONST1' ? (
          <span className="cm-const">{c.type === 'CONST1' ? 1 : 0}</span>
        ) : c.type === 'OUTPUT' ? (
          <span className="cm-lamp" aria-label={`נורה ${c.id}`} />
        ) : (
          <span className="cm-label">{def.category === 'gate' ? c.type : def.label}</span>
        )}
        <span className="cm-id">
          {c.id}
          {c.delay > 0 && ` · Tp ${c.delay}`}
        </span>
      </div>

      {outs.map((port, i) => (
        <Handle
          key={port}
          id={port}
          type="source"
          position={Position.Right}
          style={{ top: handleTop(i, outs.length, height) }}
        >
          {showPortNames && outs.length > 1 && <span className="cm-port cm-port-out">{port}</span>}
        </Handle>
      ))}
    </div>
  );
}
