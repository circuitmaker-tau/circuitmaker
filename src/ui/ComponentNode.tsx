import { Handle, Position } from '@xyflow/react';
import type { Node, NodeProps } from '@xyflow/react';
import { CATALOG, inputPortsOf, outputPortsOf } from '../model';
import type { Component, Signal } from '../model';
import { useSimStore } from '../store/simStore';
import { GateSymbol } from './GateSymbol';
import { GATE_FORMULA } from './gateFormula';
import { nodeLayout, portOffset } from './geometry';

/** `lamp` is the value an OUTPUT receives, from the steady-state evaluation. */
export type ComponentNodeData = { component: Component; lamp?: Signal };
export type ComponentFlowNode = Node<ComponentNodeData, 'component'>;

export function ComponentNode({ data, selected }: NodeProps<ComponentFlowNode>) {
  const c = data.component;
  const def = CATALOG[c.type];
  const { width, bodyHeight, height } = nodeLayout(c);
  const ins = inputPortsOf(c.type, c.inputs);
  const outs = outputPortsOf(c.type);
  const isGate = def.category === 'gate';
  const showPortNames = !isGate && def.category !== 'io';
  const flip = useSimStore((s) => s.flip);
  const value = c.props?.value ?? 0;

  return (
    <div
      className={`cm-node cm-${def.category}${selected ? ' is-selected' : ''}`}
      style={{ width, height }}
    >
      {ins.map((port, i) => (
        <Handle
          key={port}
          id={port}
          type="target"
          position={Position.Left}
          style={{ top: portOffset(i, ins.length, bodyHeight) }}
        >
          {showPortNames && <span className="cm-port cm-port-in">{port}</span>}
        </Handle>
      ))}

      {isGate ? (
        <>
          <GateSymbol type={c.type} inputs={c.inputs} width={width} height={bodyHeight} />
          <div className="cm-caption">
            <span className="cm-formula">{GATE_FORMULA[c.type]}</span>
            <span className="cm-id">
              {c.id}
              {c.delay > 0 && ` · Tp ${c.delay}`}
            </span>
          </div>
        </>
      ) : (
        <div className="cm-box" style={{ height: bodyHeight }}>
          {c.type === 'INPUT' ? (
            <button
              type="button"
              className={`cm-switch nodrag ${value === 1 ? 'is-on' : 'is-off'}`}
              aria-label={`מתג ${c.id}, ערך ${value}`}
              onClick={() => flip(c.id)}
            >
              {value}
            </button>
          ) : c.type === 'CONST0' || c.type === 'CONST1' ? (
            <span className={`cm-const ${c.type === 'CONST1' ? 'is-on' : 'is-off'}`}>
              {c.type === 'CONST1' ? 1 : 0}
            </span>
          ) : c.type === 'OUTPUT' ? (
            <span
              className={`cm-lamp lamp-${data.lamp === 'X' || data.lamp === undefined ? 'x' : data.lamp}`}
              role="img"
              aria-label={`נורה ${c.id}: ${data.lamp ?? 'X'}`}
            >
              {data.lamp ?? 'X'}
            </span>
          ) : (
            <span className="cm-label">{def.label}</span>
          )}
          <span className="cm-id">{c.id}</span>
        </div>
      )}

      {outs.map((port, i) => (
        <Handle
          key={port}
          id={port}
          type="source"
          position={Position.Right}
          style={{ top: portOffset(i, outs.length, bodyHeight) }}
        >
          {showPortNames && <span className="cm-port cm-port-out">{port}</span>}
        </Handle>
      ))}
    </div>
  );
}
