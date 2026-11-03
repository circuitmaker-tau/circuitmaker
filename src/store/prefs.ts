/**
 * View preferences kept in this browser: playback speed and the bottom panel
 * (open or closed, which tab, its height). The circuit itself is saved
 * elsewhere (persistence/). Without storage (private mode, blocked site data)
 * the defaults are used and nothing breaks.
 */
import { SPEEDS } from './speeds';
import type { Speed } from './speeds';

const KEY = 'circuitmaker.prefs';

export interface Prefs {
  speed: Speed;
  panelOpen: boolean;
  panelTab: 'timing' | 'analysis';
  panelHeight: number;
}

export const DEFAULT_PREFS: Prefs = {
  speed: 1,
  panelOpen: true,
  panelTab: 'timing',
  panelHeight: 280,
};

/** Keep only values that make sense, so an old or edited entry cannot break the editor. */
export function cleanPrefs(raw: unknown): Prefs {
  const p = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const d = DEFAULT_PREFS;
  return {
    speed: SPEEDS.includes(p.speed as Speed) ? (p.speed as Speed) : d.speed,
    panelOpen: typeof p.panelOpen === 'boolean' ? p.panelOpen : d.panelOpen,
    panelTab: p.panelTab === 'analysis' || p.panelTab === 'timing' ? p.panelTab : d.panelTab,
    panelHeight:
      typeof p.panelHeight === 'number' && p.panelHeight >= 120 && p.panelHeight <= 640
        ? Math.round(p.panelHeight)
        : d.panelHeight,
  };
}

export function loadPrefs(): Prefs {
  try {
    const text = localStorage.getItem(KEY);
    return cleanPrefs(text ? JSON.parse(text) : null);
  } catch {
    return DEFAULT_PREFS;
  }
}

let saved = '';

/** Merge a change into the stored preferences; writes only when something changed. */
export function savePrefs(change: Partial<Prefs>): void {
  try {
    const next = JSON.stringify({ ...loadPrefs(), ...change });
    if (next === saved) return;
    localStorage.setItem(KEY, next);
    saved = next;
  } catch {
    // no storage: the preferences last until the page is closed
  }
}
