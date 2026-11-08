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
  expandComponent,
  inputsOfComponent,
  isValidDelay,
  nextId,
} from '../model';
import type {
  Circuit,
  Component,
  ComponentProps,
  ComponentType,
  PortRef,
  Position,
} from '../model';
import type { SaveStatus } from '../persistence/persistence';
import { nodeLayout } from '../ui/geometry';
import { useAnalysisStore } from './analysisStore';
import { useTimingStore } from './timingStore';

/**
 * A component name is what the course writes: a letter, then letters, digits
 * or "_" (A, X0, Cin, S_1), up to 12 characters. Returns why a name cannot be
 * used, or null.
 */
export function componentNameProblem(name: string, circuit: Circuit, self?: string): string | null {
  if (!name) return 'צריך לתת לרכיב שם.';
  if (!/^[A-Za-z][A-Za-z0-9_]{0,11}$/.test(name)) {
    return `השם "${name}" לא מתאים: מתחילים באות לועזית, ואחריה אותיות, ספרות או _ (עד 12 תווים), למשל X0 או Cin.`;
  }
  if (circuit.components.some((c) => c.id === name && c.id !== self)) {
    return `כבר יש במעגל רכיב בשם ${name}.`;
  }
  return null;
}

export interface ComponentPatch {
  delay?: number;
  inputs?: number;
  /** Merged into the existing props. */
  props?: Pick<ComponentProps, 'value' | 'init' | 'halfPeriod' | 'startLevel' | 'schedule' | 'async'>;
}

export interface CircuitState {
  circuit: Circuit;
  /** What a loaded example teaches, or null for the user's own circuit. */
  lesson: string | null;
  /** Bumped whenever a whole circuit is loaded, so the canvas can fit it to the view. */
  loaded: number;
  /** Last user-facing message (a refused wire, a bad value, a bad file). */
  message: string | null;
  /** State of the automatic save in the browser. */
  saveStatus: SaveStatus;

  addComponent: (type: ComponentType, position: Position) => string;
  moveComponents: (moves: Record<string, Position>) => void;
  removeComponents: (ids: string[]) => void;
  /** Replace a block with the parts it is built from; returns their ids, or [] when it cannot be taken apart. */
  expand: (id: string) => string[];
  /** Give a component another name (its id); wires, the timing diagram and the analysis follow. */
  renameComponent: (id: string, name: string) => boolean;
  updateComponent: (id: string, patch: ComponentPatch) => boolean;
  toggleInput: (id: string) => void;
  connect: (from: PortRef, to: PortRef) => boolean;
  removeWires: (ids: string[]) => void;
  loadCircuit: (circuit: Circuit, lesson?: string) => void;
  /** Swap in an edited version of the current circuit (keeps the lesson and the view). */
  replaceCircuit: (circuit: Circuit) => void;
  newCircuit: () => void;
  renameCircuit: (name: string) => void;
  showMessage: (text: string) => void;
  clearMessage: () => void;
  setSaveStatus: (status: SaveStatus) => void;

  /** Earlier versions of the circuit, newest last, for undo. */
  past: Circuit[];
  /** Versions undone, newest last, for redo. */
  future: Circuit[];
  undo: () => void;
  redo: () => void;
  /** Components and the wires between them, copied for pasting. */
  clipboard: Circuit | null;
  copy: (ids: string[]) => void;
  /** Paste the clipboard next to where it was copied from; returns the new ids. */
  paste: () => string[];
  /** Forget the history (after restoring the saved circuit at start-up). */
  clearHistory: () => void;
}

/** How many steps undo can go back. */
export const HISTORY_LIMIT = 100;
/** Edits of the same kind this close together are one step (a drag, typing a name). */
const MERGE_MS = 800;
let lastKey: string | null = null;
let lastTime = 0;
/** Pastes since the last copy: each one lands a little further away. */
let pasteCount = 0;

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

export const useCircuitStore = create<CircuitState>()((set, get) => {
  /**
   * Keep the current circuit for undo, just before an edit replaces it. A
   * `key` merges a run of the same edit (every frame of a drag) into one step.
   */
  const remember = (key: string | null = null) => {
    const now = Date.now();
    const merge = key !== null && key === lastKey && now - lastTime < MERGE_MS;
    lastKey = key;
    lastTime = now;
    if (merge) return;
    const { past, circuit } = get();
    set({ past: [...past, circuit].slice(-HISTORY_LIMIT), future: [] });
  };

  return {
    circuit: clone(mux2FromGates),
    lesson: null,
    loaded: 0,
    message: null,
    saveStatus: 'idle',
    past: [],
    future: [],
    clipboard: null,

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
      remember();
      set({ circuit: { ...circuit, components: [...circuit.components, component] } });
      return id;
    },

    moveComponents: (moves) => {
      const { circuit } = get();
      if (!circuit.components.some((c) => moves[c.id])) return;
      remember(`move:${Object.keys(moves).sort().join(',')}`);
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
      if (!circuit.components.some((c) => gone.has(c.id))) return;
      // Delete in the editor removes the wires first and then the components: one step
      remember('delete');
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

    expand: (id) => {
      const { circuit } = get();
      const r = expandComponent(circuit, id, nodeLayout);
      if (!r) return [];
      remember();
      set({
        circuit: r.circuit,
        message: `${id} פורק ל: ${r.summary}. כל חלק אפשר לפרק שוב, ו-Ctrl+Z מחזיר.`,
      });
      return r.parts;
    },

    renameComponent: (id, name) => {
      const { circuit } = get();
      const next = name.trim();
      if (next === id) return true;
      const problem = componentNameProblem(next, circuit, id);
      if (problem) {
        set({ message: problem });
        return false;
      }
      const swap = (c: string) => (c === id ? next : c);
      remember();
      set({
        circuit: {
          ...circuit,
          components: circuit.components.map((c) => (c.id === id ? { ...c, id: next } : c)),
          wires: circuit.wires.map((w) => ({
            ...w,
            from: { ...w.from, component: swap(w.from.component) },
            to: { ...w.to, component: swap(w.to.component) },
          })),
        },
        message: null,
      });
      // the nets chosen for the timing diagram, and the lamp being analysed, keep following it
      const timing = useTimingStore.getState();
      if (timing.probes) {
        useTimingStore.setState({
          probes: timing.probes.map((n) => (n.startsWith(`${id}:`) ? next + n.slice(id.length) : n)),
        });
      }
      if (useAnalysisStore.getState().output === id) useAnalysisStore.getState().setOutput(next);
      return true;
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

      const hp = patch.props?.halfPeriod;
      if (hp !== undefined && (!isValidDelay(hp) || hp === 0)) {
        set({ message: 'חצי מחזור חייב להיות מספר חיובי בקפיצות של 0.1' });
        return false;
      }

      const updated: Component = {
        ...current,
        ...patch,
        props: patch.props ? { ...current.props, ...patch.props } : current.props,
      };
      if (updated.props === undefined) delete updated.props;
      const ports = new Set(inputsOfComponent(updated));
      // flipping a switch is playing with the circuit, not editing it
      const onlyValue =
        patch.delay === undefined &&
        patch.inputs === undefined &&
        Object.keys(patch.props ?? {}).every((k) => k === 'value');
      if (!onlyValue) remember();
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
      remember();
      set({ message: null, circuit: { ...circuit, wires: [...circuit.wires, { id, from, to }] } });
      return true;
    },

    removeWires: (ids) => {
      const gone = new Set(ids);
      const { circuit } = get();
      if (!circuit.wires.some((w) => gone.has(w.id))) return;
      remember('delete');
      set({ circuit: { ...circuit, wires: circuit.wires.filter((w) => !gone.has(w.id)) } });
    },

    // loading over the current circuit can be undone too
    loadCircuit: (circuit, lesson) => {
      remember();
      set((s) => ({
        circuit: clone(circuit),
        lesson: lesson ?? null,
        message: null,
        loaded: s.loaded + 1,
      }));
    },
    replaceCircuit: (circuit) => {
      remember();
      set({ circuit, message: null });
    },
    newCircuit: () => {
      remember();
      set((s) => ({ circuit: createCircuit(), lesson: null, message: null, loaded: s.loaded + 1 }));
    },
    renameCircuit: (name) => {
      remember('circuit-name');
      set({ circuit: { ...get().circuit, name } });
    },
    showMessage: (text) => set({ message: text }),
    clearMessage: () => set({ message: null }),
    setSaveStatus: (status) => set({ saveStatus: status }),

    undo: () => {
      const { past, future, circuit } = get();
      if (past.length === 0) return;
      lastKey = null;
      set({
        circuit: past[past.length - 1],
        past: past.slice(0, -1),
        future: [...future, circuit],
        message: null,
      });
    },
    redo: () => {
      const { past, future, circuit } = get();
      if (future.length === 0) return;
      lastKey = null;
      set({
        circuit: future[future.length - 1],
        future: future.slice(0, -1),
        past: [...past, circuit],
        message: null,
      });
    },
    copy: (ids) => {
      const keep = new Set(ids);
      const { circuit } = get();
      const components = circuit.components.filter((c) => keep.has(c.id));
      if (components.length === 0) return;
      pasteCount = 0;
      set({
        clipboard: clone({
          ...circuit,
          components,
          wires: circuit.wires.filter((w) => keep.has(w.from.component) && keep.has(w.to.component)),
        }),
      });
    },
    paste: () => {
      const { clipboard, circuit } = get();
      if (!clipboard) return [];
      pasteCount++;
      const taken = circuit.components.map((c) => c.id);
      const rename = new Map<string, string>();
      const components = clipboard.components.map((c) => {
        const id = nextId(prefixFor(c.type), taken);
        taken.push(id);
        rename.set(c.id, id);
        const shift = 40 * pasteCount;
        return { ...structuredClone(c), id, position: { x: c.position.x + shift, y: c.position.y + shift } };
      });
      const wireIds = circuit.wires.map((w) => w.id);
      const wires = clipboard.wires.map((w) => {
        const id = nextId('w', wireIds);
        wireIds.push(id);
        return {
          id,
          from: { ...w.from, component: rename.get(w.from.component)! },
          to: { ...w.to, component: rename.get(w.to.component)! },
        };
      });
      remember();
      set({
        message: null,
        circuit: {
          ...circuit,
          components: [...circuit.components, ...components],
          wires: [...circuit.wires, ...wires],
        },
      });
      return components.map((c) => c.id);
    },
    clearHistory: () => {
      lastKey = null;
      set({ past: [], future: [] });
    },
  };
});
