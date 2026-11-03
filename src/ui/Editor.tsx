/**
 * Workspace: palette, React Flow canvas and properties panel.
 *
 * The circuit in the store is the source of truth. React Flow nodes and edges
 * are derived from it on every render; the only things kept locally are what
 * React Flow itself owns (measured size, selection).
 */
import { useEffect, useMemo, useState } from 'react';
import type { DragEvent } from 'react';
import {
  Background,
  ConnectionLineType,
  Controls,
  ReactFlow,
  applyEdgeChanges,
  applyNodeChanges,
  useReactFlow,
} from '@xyflow/react';
import type { Connection, Edge, EdgeChange, NodeChange } from '@xyflow/react';
import { COMPONENT_TYPES, canConnect, createComponent } from '../model';
import type { ComponentType, Position } from '../model';
import { useCircuitStore } from '../store/circuitStore';
import { structureSignature, useSimStore } from '../store/simStore';
import { useTimingStore } from '../store/timingStore';
import { ComponentNode } from './ComponentNode';
import type { ComponentFlowNode } from './ComponentNode';
import { findFreeSpot, routeCircuit, wirePath } from './geometry';
import { DRAG_MIME, Palette } from './Palette';
import { PropertiesPanel } from './PropertiesPanel';
import { SimControls } from './SimControls';
import { TimingDiagram } from './TimingDiagram';
import { usePlaybackClock } from './usePlaybackClock';
import { WireEdge } from './WireEdge';
import type { WireFlowEdge } from './WireEdge';

const nodeTypes = { component: ComponentNode };
const edgeTypes = { wire: WireEdge };

type NodeMeta = Pick<ComponentFlowNode, 'measured' | 'selected'>;

const isComponentType = (t: string): t is ComponentType =>
  (COMPONENT_TYPES as readonly string[]).includes(t);

type Sheet = 'none' | 'palette' | 'props' | 'timing';
const SHEETS: [Exclude<Sheet, 'none'>, string][] = [
  ['palette', 'רכיבים'],
  ['props', 'מאפיינים'],
  ['timing', 'זמנים וניתוח'],
];

export function Editor() {
  const circuit = useCircuitStore((s) => s.circuit);
  const message = useCircuitStore((s) => s.message);
  const { addComponent, moveComponents, removeComponents, connect, removeWires, clearMessage } =
    useCircuitStore.getState();
  const { screenToFlowPosition, fitView, setViewport } = useReactFlow();

  // a loaded circuit (example, import, restore) is shown whole; a new one at 100%
  const loaded = useCircuitStore((s) => s.loaded);
  useEffect(() => {
    if (loaded === 0) return;
    useTimingStore.getState().resetProbes();
    const frame = requestAnimationFrame(() => {
      if (useCircuitStore.getState().circuit.components.length === 0) {
        void setViewport({ x: 40, y: 40, zoom: 1 });
      } else {
        void fitView({ padding: 0.15, duration: 200 });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [loaded, fitView, setViewport]);

  const [nodeMeta, setNodeMeta] = useState<Record<string, NodeMeta>>({});
  // on a phone the palette, properties and timing diagram are sheets over the canvas
  const [sheet, setSheet] = useState<Sheet>('none');
  const toggleSheet = (next: Sheet) => setSheet((cur) => (cur === next ? 'none' : next));
  const [selectedEdges, setSelectedEdges] = useState<Set<string>>(new Set());

  // a structural edit restarts the simulation from the steady state; flipping a switch does not
  const signature = useMemo(() => structureSignature(circuit), [circuit]);
  useEffect(() => {
    useSimStore.getState().reset(useCircuitStore.getState().circuit);
  }, [signature]);
  usePlaybackClock();

  // nodes and wires read their live values themselves (see ComponentNode and
  // WireEdge), so nothing here changes while time runs
  const lampNet = useMemo(
    () =>
      new Map(
        circuit.wires
          .filter((w) => w.to.port === 'in')
          .map((w) => [w.to.component, `${w.from.component}:${w.from.port}`]),
      ),
    [circuit.wires],
  );
  const nodes = useMemo<ComponentFlowNode[]>(
    () =>
      circuit.components.map((c) => ({
        id: c.id,
        type: 'component',
        position: c.position,
        data: { component: c, lampNet: c.type === 'OUTPUT' ? lampNet.get(c.id) : undefined },
        ...nodeMeta[c.id],
      })),
    [circuit.components, nodeMeta, lampNet],
  );

  // routes depend on the layout only, so dragging re-routes and re-checks crossings
  const routes = useMemo(() => new Map(routeCircuit(circuit).map((r) => [r.id, r])), [circuit]);
  const edges = useMemo<WireFlowEdge[]>(
    () =>
      circuit.wires.map((w) => {
        const r = routes.get(w.id);
        return {
          id: w.id,
          type: 'wire',
          source: w.from.component,
          sourceHandle: w.from.port,
          target: w.to.component,
          targetHandle: w.to.port,
          selected: selectedEdges.has(w.id),
          data: {
            d: r ? wirePath(r.points, r.hops) : '',
            net: `${w.from.component}:${w.from.port}`,
          },
        };
      }),
    [circuit.wires, routes, selectedEdges],
  );

  const onNodesChange = (changes: NodeChange<ComponentFlowNode>[]) => {
    const next = applyNodeChanges(changes, nodes);
    const moves: Record<string, Position> = {};
    const removed: string[] = [];
    for (const change of changes) {
      if (change.type === 'position' && change.position) moves[change.id] = change.position;
      if (change.type === 'remove') removed.push(change.id);
    }
    setNodeMeta(
      Object.fromEntries(next.map((n) => [n.id, { measured: n.measured, selected: n.selected }])),
    );
    if (Object.keys(moves).length > 0) moveComponents(moves);
    if (removed.length > 0) removeComponents(removed);
  };

  const onEdgesChange = (changes: EdgeChange<WireFlowEdge>[]) => {
    const next = applyEdgeChanges(changes, edges);
    setSelectedEdges(new Set(next.filter((e) => e.selected).map((e) => e.id)));
    const removed = changes.filter((c) => c.type === 'remove').map((c) => c.id);
    if (removed.length > 0) removeWires(removed);
  };

  const toPorts = (c: Connection | Edge) => ({
    from: { component: c.source, port: c.sourceHandle ?? '' },
    to: { component: c.target, port: c.targetHandle ?? '' },
  });

  const onConnect = (c: Connection) => {
    const { from, to } = toPorts(c);
    connect(from, to);
  };

  const isValidConnection = (c: Connection | Edge) => {
    const { from, to } = toPorts(c);
    return canConnect(circuit, from, to).ok;
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    const type = event.dataTransfer.getData(DRAG_MIME);
    if (!isComponentType(type)) return;
    addComponent(type, screenToFlowPosition({ x: event.clientX, y: event.clientY }));
  };

  const onDragOver = (event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  };

  // a click in the palette puts the component in the first free spot
  const onPaletteAdd = (type: ComponentType) => {
    addComponent(type, findFreeSpot(circuit, createComponent(type, 'new')));
    setSheet('none');
  };

  const selected = nodes.filter((n) => n.selected);
  const selectedComponent = selected.length === 1 ? selected[0].data.component : null;

  return (
    <div className={`editor sheet-${sheet}`}>
      <Palette onAdd={onPaletteAdd} />
      <div className="workspace">
        <div className="canvas" dir="ltr" onDrop={onDrop} onDragOver={onDragOver}>
          <SimControls />
          <div className="flow">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              connectionLineType={ConnectionLineType.Step}
              colorMode="dark"
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onPaneClick={() => setSheet('none')}
              isValidConnection={isValidConnection}
              deleteKeyCode={['Backspace', 'Delete']}
              snapToGrid
              snapGrid={[10, 10]}
              fitView
            >
              <Background gap={20} color="#2a2a30" />
              <Controls showInteractive={false} />
            </ReactFlow>
          </div>
          {message && (
            <div className="status" role="status" dir="rtl">
              <span>{message}</span>
              <button type="button" onClick={clearMessage} aria-label="סגירת ההודעה">
                ×
              </button>
            </div>
          )}
        </div>
        <TimingDiagram />
      </div>
      <PropertiesPanel
        component={selectedComponent}
        onRenamed={(from, to) =>
          setNodeMeta(({ [from]: meta, ...rest }) => (meta ? { ...rest, [to]: meta } : rest))
        }
      />
      <nav className="mobile-tabs" aria-label="חלוניות">
        {SHEETS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-pressed={sheet === id}
            className={id === 'props' && selectedComponent ? 'has-badge' : undefined}
            onClick={() => toggleSheet(id)}
          >
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}
