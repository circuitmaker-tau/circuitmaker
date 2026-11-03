import { Handle, Position } from '@xyflow/react';
import type { Node, NodeProps } from '@xyflow/react';
import { CATALOG, inputPortsOf, outputPortsOf } from '../model';
import type { Component, Signal } from '../model';
import { useSimStore } from '../store/simStore';
import { GateSymbol } from './GateSymbol';
import { GATE_FORMULA } from './gateFormula';
import { nodeLayout, portOffset } from './geometry';
import { BOX_TITLE } from './labels';

/**
 * Live values from the simulation: `lamp` is what an OUTPUT receives, `level`
 * is the current value of a switch or a clock, `state` is what a latch, flip-flop, register or
 * counter stores (Q0 first).
 */
export type ComponentNodeData = {
  component: Component;
  lamp?: Signal;
  level?: Signal;
  state?: Signal[];
};

const sig = (v: Signal | undefined) => (v === 0 || v === 1 ? String(v) : 'x');

function StoredValue({ type, state }: { type: Component['type']; state: Signal[] }) {
  if (state.length === 1) {
    return (
      <span className="cm-state">
        Q = <b className={`v-${sig(state[0])}`}>{state[0]}</b>
      </span>
    );
  }
  const bits = [...state].reverse(); // Q3 … Q0, MSB first as written in the course
  const n = state.every((b) => b !== 'X')
    ? state.reduce<number>((acc, b, i) => acc + (b === 1 ? 1 << i : 0), 0)
    : null;
  return (
    <span className="cm-state" dir="ltr">
      {bits.map((b, i) => (
        <b key={i} className={`v-${sig(b)}`}>
          {b}
        </b>
      ))}
      {type === 'COUNTER4' && n !== null && <span className="cm-dec"> = {n}</span>}
    </span>
  );
}
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
  // a switch shows its value in the simulation, which planned changes can move
  const value = data.level ?? c.props?.value ?? 0;

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
          {showPortNames &&
            (port === 'CLK' ? (
              // edge-triggered clock input: the triangle of the course symbols
              <span className="cm-port cm-port-in cm-clk" aria-label="CLK" />
            ) : (
              <span className="cm-port cm-port-in">{port}</span>
            ))}
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
          ) : c.type === 'CLOCK' ? (
            <span
              className={`cm-clock v-${sig(data.level)}`}
              role="img"
              aria-label={`שעון ${c.id}: ${data.level ?? 'X'}`}
            >
              <svg width="26" height="14" viewBox="0 0 26 14" aria-hidden="true">
                <path d="M1 12 H7 V2 H13 V12 H19 V2 H25" fill="none" stroke="currentColor" />
              </svg>
              {data.level ?? 'X'}
            </span>
          ) : (
            <>
              <span className="cm-label">{BOX_TITLE[c.type] ?? def.label}</span>
              {data.state && <StoredValue type={c.type} state={data.state} />}
            </>
          )}
          <span className="cm-id">
            {c.id}
            {c.type === 'CLOCK' && ` · ½T ${c.props?.halfPeriod ?? 1}`}
            {def.category !== 'io' && c.delay > 0 && ` · Tp ${c.delay}`}
          </span>
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
