/**
 * App state (Zustand). The circuit here is the single source of truth: the
 * editor draws from it and every edit goes through one of these actions.
 * Nothing here depends on React Flow, so the actions are unit-tested directly.
 */
import { create } from 'zustand';
import { mux2FromGates } from '../examples/mux2FromGates';
import {
  CATALOG,
  canConnect,
  createCircuit,
  createComponent,
  inputPortsOf,
  isValidDelay,
  nextId,
} from '../model';
import type { Circuit, Component, ComponentType, PortRef, Position } from '../model';

export interface ComponentPatch {
  delay?: number;
  inputs?: number;
}

export interface CircuitState {
  circuit: Circuit;
  /** Last user-facing message (a refused wire, a bad value). */
  message: string | null;

  addComponent: (type: ComponentType, position: Position) => string;
  moveComponents: (moves: Record<string, Position>) => void;
  removeComponents: (ids: string[]) => void;
  updateComponent: (id: string, patch: ComponentPatch) => boolean;
  toggleInput: (id: string) => void;
  connect: (from: PortRef, to: PortRef) => boolean;
  removeWires: (ids: string[]) => void;
  loadCircuit: (circuit: Circuit) => void;
  newCircuit: () => void;
  clearMessage: () => void;
}

const ID_PREFIX: Partial<Record<ComponentType, string>> = {
  INPUT: 'sw',
  OUTPUT: 'led',
  CLOCK: 'clk',
  CONST0: 'k',
  CONST1: 'k',
};

const prefixFor = (type: ComponentType) =>
  ID_PREFIX[type] ?? (CATALOG[type].category === 'gate' ? 'g' : 'u');

const clone = (c: Circuit): Circuit => structuredClone(c);

export const useCircuitStore = create<CircuitState>()((set, get) => ({
  circuit: clone(mux2FromGates),
  message: null,

  addComponent: (type, position) => {
    const { circuit } = get();
    const id = nextId(
      prefixFor(type),
      circuit.components.map((c) => c.id),
    );
    const component = createComponent(type, id, {
      x: Math.round(position.x),
      y: Math.round(position.y),
    });
    set({ circuit: { ...circuit, components: [...circuit.components, component] } });
    return id;
  },

  moveComponents: (moves) => {
    const { circuit } = get();
    if (!circuit.components.some((c) => moves[c.id])) return;
    set({
      circuit: {
        ...circuit,
        components: circuit.components.map((c) =>
          moves[c.id] ? { ...c, position: moves[c.id] } : c,
        ),
      },
    });
  },

  removeComponents: (ids) => {
    const gone = new Set(ids);
    const { circuit } = get();
    set({
      circuit: {
        ...circuit,
        components: circuit.components.filter((c) => !gone.has(c.id)),
        wires: circuit.wires.filter(
          (w) => !gone.has(w.from.component) && !gone.has(w.to.component),
        ),
      },
    });
  },

  updateComponent: (id, patch) => {
    const { circuit } = get();
    const current = circuit.components.find((c) => c.id === id);
    if (!current) return false;
    const def = CATALOG[current.type];

    if (patch.delay !== undefined && !isValidDelay(patch.delay)) {
      set({ message: 'Tp חייב להיות מספר אי-שלילי בקפיצות של 0.1' });
      return false;
    }
    if (
      patch.inputs !== undefined &&
      (!Number.isInteger(patch.inputs) ||
        patch.inputs < def.minInputs ||
        patch.inputs > def.maxInputs)
    ) {
      set({ message: `ל-${current.type} אפשר ${def.minInputs} עד ${def.maxInputs} כניסות` });
      return false;
    }

    const updated: Component = { ...current, ...patch };
    const ports = new Set(inputPortsOf(updated.type, updated.inputs));
    set({
      message: null,
      circuit: {
        ...circuit,
        components: circuit.components.map((c) => (c.id === id ? updated : c)),
        // fewer inputs: wires into ports that no longer exist are dropped
        wires: circuit.wires.filter((w) => w.to.component !== id || ports.has(w.to.port)),
      },
    });
    return true;
  },

  toggleInput: (id) => {
    const { circuit } = get();
    set({
      circuit: {
        ...circuit,
        components: circuit.components.map((c) =>
          c.id === id && c.type === 'INPUT'
            ? { ...c, props: { ...c.props, value: c.props?.value === 1 ? 0 : 1 } }
            : c,
        ),
      },
    });
  },

  connect: (from, to) => {
    const { circuit } = get();
    const check = canConnect(circuit, from, to);
    if (!check.ok) {
      set({ message: check.reason });
      return false;
    }
    const id = nextId(
      'w',
      circuit.wires.map((w) => w.id),
    );
    set({ message: null, circuit: { ...circuit, wires: [...circuit.wires, { id, from, to }] } });
    return true;
  },

  removeWires: (ids) => {
    const gone = new Set(ids);
    const { circuit } = get();
    set({ circuit: { ...circuit, wires: circuit.wires.filter((w) => !gone.has(w.id)) } });
  },

  loadCircuit: (circuit) => set({ circuit: clone(circuit), message: null }),
  newCircuit: () => set({ circuit: createCircuit(), message: null }),
  clearMessage: () => set({ message: null }),
}));
