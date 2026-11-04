/**
 * Which nets appear in the timing diagram, and how it is viewed.
 *
 * By default a small circuit shows every net but Q' (as the exam timing
 * questions do), and a larger one shows the clocks, switches, flip-flop outputs and
 * lamps. The user can add or remove any net from the properties panel.
 */
import { create } from 'zustand';
import { CATALOG, outputPortsOf } from '../model';
import type { Circuit } from '../model';
import { loadPrefs, savePrefs } from './prefs';

/** Up to this many nets, the diagram shows them all. */
const SHOW_ALL_UP_TO = 10;

export interface Row {
  net: string;
  label: string;
  /** Switches and clocks: driven from outside, so they never glitch. */
  source: boolean;
}

/** Every net in drawing order: clocks, switches, everything else, then nets that feed a lamp. */
export function allRows(circuit: Circuit): Row[] {
  const lampOf = new Map<string, string>();
  for (const w of circuit.wires) {
    const to = circuit.components.find((c) => c.id === w.to.component);
    const key = `${w.from.component}:${w.from.port}`;
    if (to?.type === 'OUTPUT' && !lampOf.has(key)) lampOf.set(key, to.id);
  }
  const rows: Row[] = [];
  for (const c of circuit.components) {
    if (c.type === 'OUTPUT' || c.type === 'CONST0' || c.type === 'CONST1') continue;
    const ports = outputPortsOf(c.type);
    for (const port of ports) {
      const net = `${c.id}:${port}`;
      const own = ports.length === 1 ? c.id : `${c.id}.${port}`;
      const lamp = lampOf.get(net);
      rows.push({
        net,
        label: lamp && lamp !== own ? `${lamp} (${own})` : own,
        source: c.type === 'INPUT' || c.type === 'CLOCK',
      });
    }
  }
  const rank = (r: Row) => {
    const type = circuit.components.find((c) => c.id === r.net.split(':')[0])?.type;
    if (type === 'CLOCK') return 0;
    if (type === 'INPUT') return 1;
    return lampOf.has(r.net) ? 3 : 2;
  };
  return rows
    .map((r, i) => ({ r, i }))
    .sort((a, b) => rank(a.r) - rank(b.r) || a.i - b.i)
    .map(({ r }) => r);
}

export function defaultProbes(circuit: Circuit): string[] {
  // Q' is always the opposite of Q, and the exam diagrams draw only Q, so it is left out
  const all = allRows(circuit);
  const rows = all.filter((r) => !r.net.endsWith(":Q'"));
  if (all.length <= SHOW_ALL_UP_TO) return rows.map((r) => r.net);
  const lampFed = new Set(
    circuit.wires
      .filter((w) => circuit.components.find((c) => c.id === w.to.component)?.type === 'OUTPUT')
      .map((w) => `${w.from.component}:${w.from.port}`),
  );
  return rows
    .filter((r) => {
      const [id, port] = r.net.split(':');
      const type = circuit.components.find((c) => c.id === id)!.type;
      return r.source || lampFed.has(r.net) || (CATALOG[type].stateful && port === 'Q');
    })
    .map((r) => r.net);
}

interface TimingState {
  /** Nets chosen by the user, or null for the default set. */
  probes: string[] | null;
  open: boolean;
  /** What the bottom panel shows. */
  tab: 'timing' | 'analysis';
  /** Panel height in pixels, dragged by its top edge. */
  height: number;
  /** Pixels per time unit, or null to fit the whole run. */
  zoom: number | null;
  /** Ticks; set by clicking the diagram. */
  cursor: number | null;
  /** Second cursor (shift-click), for measuring a time difference. */
  cursorB: number | null;

  shown: (circuit: Circuit) => string[];
  setProbe: (circuit: Circuit, net: string, on: boolean) => void;
  resetProbes: () => void;
  setOpen: (open: boolean) => void;
  setTab: (tab: 'timing' | 'analysis') => void;
  setHeight: (height: number) => void;
  setZoom: (zoom: number | null) => void;
  setCursor: (t: number | null, second?: boolean) => void;
}

const initial = loadPrefs();

export const useTimingStore = create<TimingState>()((set, get) => ({
  probes: null,
  // the panel as it was left on the last visit
  open: initial.panelOpen,
  tab: initial.panelTab,
  height: initial.panelHeight,
  zoom: null,
  cursor: null,
  cursorB: null,

  shown: (circuit) => {
    const nets = new Set(allRows(circuit).map((r) => r.net));
    return (get().probes ?? defaultProbes(circuit)).filter((n) => nets.has(n));
  },
  setProbe: (circuit, net, on) => {
    const current = get().shown(circuit);
    const next = on ? [...current.filter((n) => n !== net), net] : current.filter((n) => n !== net);
    // keep the drawing order of allRows
    const order = allRows(circuit).map((r) => r.net);
    set({ probes: order.filter((n) => next.includes(n)) });
  },
  resetProbes: () => set({ probes: null, cursor: null, cursorB: null, zoom: null }),
  setOpen: (open) => set({ open }),
  setTab: (tab) => set({ tab, open: true }),
  setHeight: (height) => set({ height: Math.min(640, Math.max(120, Math.round(height))) }),
  setZoom: (zoom) => set({ zoom }),
  setCursor: (t, second = false) => set(second ? { cursorB: t } : { cursor: t, cursorB: null }),
}));

// remember the panel for the next visit (savePrefs writes only on a change)
useTimingStore.subscribe((s) =>
  savePrefs({ panelOpen: s.open, panelTab: s.tab, panelHeight: s.height }),
);
