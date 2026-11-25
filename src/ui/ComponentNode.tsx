import { Handle, Position } from '@xyflow/react';
import type { Node, NodeProps } from '@xyflow/react';
import { CATALOG, enableActiveLow, inputsOfComponent, outputsOfComponent } from '../model';
import type { Component, Signal } from '../model';
import { useAnalysisStore } from '../store/analysisStore';
import { useSimStore } from '../store/simStore';
import { GateSymbol } from './GateSymbol';
import { GATE_FORMULA } from './gateFormula';
import { isMux, muxInset, nodeLayout, portLocal } from './geometry';
import { BOX_TITLE } from './labels';

/** `lampNet` is the net that feeds an OUTPUT. */
export type ComponentNodeData = { component: Component; lampNet?: string };

/**
 * The live values a node shows, read straight from the simulation as a short
 * string so the node re-renders only when one of them changes: what a lamp
 * receives, the level of a switch or clock, or the stored bits (Q0 first).
 */
function useLive(c: Component, lampNet: string | undefined): Signal[] | null {
  const key = useSimStore((s) => {
    if (s.version < 0 || !s.sim) return null;
    const sim = s.sim;
    if (c.type === 'OUTPUT') return String(sim.value(lampNet ?? ''));
    if (c.type === 'INPUT' || c.type === 'CLOCK') return String(sim.value(`${c.id}:out`));
    if (!CATALOG[c.type].stateful) return null;
    return outputsOfComponent(c)
      .filter((p) => p.startsWith('Q') && !p.endsWith("'"))
      .map((p) => sim.value(`${c.id}:${p}`))
      .join('');
  });
  return key === null ? null : [...key].map((ch) => (ch === 'X' ? 'X' : ch === '1' ? 1 : 0));
}

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
/** The component that owns a net: "g1:out" → g1, and a part inside a block "B1/g1:out" → B1. */
const ownerOf = (net: string) => net.slice(0, net.lastIndexOf(':')).split('/')[0];

/**
 * New values on their way through this component's delay, as "progress|value"
 * pairs, so the node re-renders only while one of them moves.
 */
function useDelays(id: string): { progress: number; value: Signal }[] {
  const key = useSimStore((s) => {
    const parts: string[] = [];
    for (const [net, list] of s.fronts) {
      if (ownerOf(net) !== id) continue;
      for (const f of list) parts.push(`${f.progress.toFixed(3)}|${f.value}`);
    }
    return parts.join(',');
  });
  if (!key) return [];
  return key.split(',').map((p) => {
    const [progress, value] = p.split('|');
    return { progress: Number(progress), value: value === 'X' ? 'X' : value === '1' ? 1 : 0 };
  });
}

/**
 * The delay happens in the component, not on the wire: while a new value is
 * inside its Tp, a bar fills across the component in the colour of that value,
 * and only when it is full does the output (and the wire after it) change.
 */
function DelayBar({ id, width, bottom }: { id: string; width: number; bottom: number }) {
  const delays = useDelays(id);
  if (delays.length === 0) return null;
  return (
    <span className="cm-delay" style={{ top: bottom - 9, width: width - 16 }} dir="ltr">
      {delays.slice(0, 2).map((d, i) => (
        <span
          key={i}
          className={`cm-delay-fill v-${sig(d.value)}`}
          style={{ width: `${Math.round(d.progress * 100)}%` }}
          role="img"
          aria-label={`${id}: ${d.value} בדרך דרך ה-Tp (${Math.round(d.progress * 100)}%)`}
        />
      ))}
    </span>
  );
}

export type ComponentFlowNode = Node<ComponentNodeData, 'component'>;

export function ComponentNode({ data, selected }: NodeProps<ComponentFlowNode>) {
  const c = data.component;
  const def = CATALOG[c.type];
  const { width, bodyHeight, height } = nodeLayout(c);
  const ins = inputsOfComponent(c);
  const outs = outputsOfComponent(c);
  const isGate = def.category === 'gate';
  const showPortNames = !isGate && def.category !== 'io';
  const flip = useSimStore((s) => s.flip);
  const path = useAnalysisStore((s) => s.highlight.get(c.id));
  // a switch shows its value in the simulation, which planned changes can move
  const live = useLive(c, data.lampNet);
  const lamp = c.type === 'OUTPUT' ? live?.[0] : undefined;
  const level = c.type === 'INPUT' || c.type === 'CLOCK' ? live?.[0] : undefined;
  const state = def.stateful ? live : null;
  const value = level ?? c.props?.value ?? 0;
  const mux = isMux(c);
  const inset = muxInset(bodyHeight);

  return (
    <div
      className={`cm-node cm-${def.category}${selected ? ' is-selected' : ''}${path !== undefined ? ` on-path-${path}` : ''}`}
      style={{ width, height }}
    >
      {mux && (
        // the course's multiplexer: a trapezoid, long side to the data inputs
        <svg className="cm-mux-svg" width={width} height={bodyHeight} aria-hidden="true">
          <polygon
            className="cm-outline cm-body-fill"
            points={`1,1 ${width - 1},${inset} ${width - 1},${bodyHeight - inset} 1,${bodyHeight - 1}`}
          />
        </svg>
      )}

      {ins.map((port) => {
        const at = portLocal(c, port)!;
        const below = at.side === 'bottom';
        return (
          <Handle
            key={port}
            id={port}
            type="target"
            position={below ? Position.Bottom : Position.Left}
            style={
              below
                ? { left: at.x, top: at.y, bottom: 'auto', transform: 'translate(-50%, -50%)' }
                : { top: at.y }
            }
          >
            {showPortNames &&
              (port === 'CLK' ? (
                // edge-triggered clock input: the triangle of the course symbols
                // a bubble before it: the falling edge is the active one
                <span
                  className={`cm-port cm-port-in cm-clk${c.props?.fallingEdge ? ' is-falling' : ''}`}
                  aria-label={c.props?.fallingEdge ? 'CLK, ירידת שעון' : 'CLK'}
                />
              ) : (
                <span
                  className={`cm-port ${below ? 'cm-port-below' : 'cm-port-in'}${port === 'En' && enableActiveLow(c) ? ' is-low' : ''}`}
                  aria-label={port === 'En' && enableActiveLow(c) ? 'En, פעיל ב-0' : undefined}
                >
                  {port}
                </span>
              ))}
          </Handle>
        );
      })}

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
        <div
          className={`cm-box${mux ? ' cm-mux' : ''}`}
          style={mux ? { height: bodyHeight, paddingBottom: inset } : { height: bodyHeight }}
        >
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
              className={`cm-lamp lamp-${lamp === 'X' || lamp === undefined ? 'x' : lamp}`}
              role="img"
              aria-label={`נורה ${c.id}: ${lamp ?? 'X'}`}
            >
              {lamp ?? 'X'}
            </span>
          ) : c.type === 'CLOCK' ? (
            <span
              className={`cm-clock v-${sig(level)}`}
              role="img"
              aria-label={`שעון ${c.id}: ${level ?? 'X'}`}
            >
              <svg width="26" height="14" viewBox="0 0 26 14" aria-hidden="true">
                <path d="M1 12 H7 V2 H13 V12 H19 V2 H25" fill="none" stroke="currentColor" />
              </svg>
              {level ?? 'X'}
            </span>
          ) : (
            <>
              <span className="cm-label">
                {c.type === 'BLOCK' ? (c.props?.block ?? 'בלוק') : (BOX_TITLE[c.type] ?? def.label)}
              </span>
              {state && <StoredValue type={c.type} state={state} />}
            </>
          )}
          <span className="cm-id">
            {c.id}
            {c.type === 'CLOCK' && ` · ½T ${c.props?.halfPeriod ?? 1}`}
            {def.category !== 'io' && c.delay > 0 && ` · Tp ${c.delay}`}
          </span>
        </div>
      )}

      {def.category !== 'io' && <DelayBar id={c.id} width={width} bottom={bodyHeight} />}

      {outs.map((port) => (
        <Handle
          key={port}
          id={port}
          type="source"
          position={Position.Right}
          style={{ top: portLocal(c, port)!.y }}
        >
          {showPortNames && <span className="cm-port cm-port-out">{port}</span>}
        </Handle>
      ))}
    </div>
  );
}
