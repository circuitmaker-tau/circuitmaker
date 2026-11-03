/**
 * Workspace: palette, React Flow canvas and properties panel.
 *
 * The circuit in the store is the source of truth. React Flow nodes and edges
 * are derived from it on every render; the only things kept locally are what
 * React Flow itself owns (measured size, selection).
 */
import { useMemo, useState } from 'react';
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
import { settle } from '../engine/settle';
import { COMPONENT_TYPES, canConnect, createComponent } from '../model';
import type { ComponentType, Position } from '../model';
import { useCircuitStore } from '../store/circuitStore';
import { ComponentNode } from './ComponentNode';
import type { ComponentFlowNode } from './ComponentNode';
import { findFreeSpot, routeCircuit, wirePath } from './geometry';
import { DRAG_MIME, Palette } from './Palette';
import { PropertiesPanel } from './PropertiesPanel';
import { WireEdge } from './WireEdge';
import type { WireFlowEdge } from './WireEdge';

const nodeTypes = { component: ComponentNode };
const edgeTypes = { wire: WireEdge };

type NodeMeta = Pick<ComponentFlowNode, 'measured' | 'selected'>;

const isComponentType = (t: string): t is ComponentType =>
  (COMPONENT_TYPES as readonly string[]).includes(t);

export function Editor() {
  const circuit = useCircuitStore((s) => s.circuit);
  const message = useCircuitStore((s) => s.message);
  const { addComponent, moveComponents, removeComponents, connect, removeWires, clearMessage } =
    useCircuitStore.getState();
  const { screenToFlowPosition } = useReactFlow();

  const [nodeMeta, setNodeMeta] = useState<Record<string, NodeMeta>>({});
  const [selectedEdges, setSelectedEdges] = useState<Set<string>>(new Set());

  // steady-state value of every net: recomputed on every edit and switch flip
  const values = useMemo(() => settle(circuit), [circuit]);

  const nodes = useMemo<ComponentFlowNode[]>(
    () =>
      circuit.components.map((c) => ({
        id: c.id,
        type: 'component',
        position: c.position,
        data: {
          component: c,
          lamp: c.type === 'OUTPUT' ? (values.inputs.get(`${c.id}:in`) ?? 'X') : undefined,
        },
        ...nodeMeta[c.id],
      })),
    [circuit.components, nodeMeta, values],
  );

  // routes are computed from the circuit, so every drag re-routes and re-checks crossings
  const edges = useMemo<WireFlowEdge[]>(() => {
    const routes = new Map(routeCircuit(circuit).map((r) => [r.id, r]));
    return circuit.wires.map((w) => {
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
          value: values.nets.get(`${w.from.component}:${w.from.port}`) ?? 'X',
        },
      };
    });
  }, [circuit, selectedEdges, values]);

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
  };

  const selected = nodes.filter((n) => n.selected);
  const selectedComponent = selected.length === 1 ? selected[0].data.component : null;

  return (
    <div className="editor">
      <Palette onAdd={onPaletteAdd} />
      <div className="canvas" dir="ltr" onDrop={onDrop} onDragOver={onDragOver}>
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
          isValidConnection={isValidConnection}
          deleteKeyCode={['Backspace', 'Delete']}
          snapToGrid
          snapGrid={[10, 10]}
          fitView
        >
          <Background gap={20} color="#2a2a30" />
          <Controls showInteractive={false} />
        </ReactFlow>
        {message && (
          <div className="status" role="status" dir="rtl">
            <span>{message}</span>
            <button type="button" onClick={clearMessage} aria-label="סגירת ההודעה">
              ×
            </button>
          </div>
        )}
      </div>
      <PropertiesPanel component={selectedComponent} />
    </div>
  );
}
