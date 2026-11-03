/**
 * State of the hazard analysis panel: which lamp is analysed, and which
 * components and wires are highlighted on the canvas (the two paths that
 * race, or the terms of a hazard).
 */
import { create } from 'zustand';

interface AnalysisState {
  /** Id of the OUTPUT being analysed, or null for the first one. */
  output: string | null;
  /** Highlight colour index (0 = fast path, 1 = slow path) of each component and wire id. */
  highlight: Map<string, number>;
  setOutput: (id: string | null) => void;
  setHighlight: (h: Map<string, number>) => void;
  clearHighlight: () => void;
}

export const useAnalysisStore = create<AnalysisState>()((set) => ({
  output: null,
  highlight: new Map(),
  setOutput: (output) => set({ output }),
  setHighlight: (highlight) => set({ highlight }),
  clearHighlight: () => set({ highlight: new Map() }),
}));
