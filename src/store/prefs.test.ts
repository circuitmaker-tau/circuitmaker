import { describe, expect, it } from 'vitest';
import { DEFAULT_PREFS, cleanPrefs, loadPrefs, savePrefs } from './prefs';

describe('view preferences', () => {
  it('keeps valid values and replaces anything else with the default', () => {
    expect(cleanPrefs({ speed: 4, panelOpen: false, panelTab: 'analysis', panelHeight: 400 })).toEqual(
      { speed: 4, panelOpen: false, panelTab: 'analysis', panelHeight: 400 },
    );
    expect(cleanPrefs({ speed: 3, panelOpen: 'yes', panelTab: 'x', panelHeight: 9999 })).toEqual(
      DEFAULT_PREFS,
    );
    expect(cleanPrefs({ panelTab: 'truth' }).panelTab).toBe('truth');
    expect(cleanPrefs({ panelTab: 'practice' }).panelTab).toBe('practice');
    expect(cleanPrefs(null)).toEqual(DEFAULT_PREFS);
    expect(cleanPrefs('garbage')).toEqual(DEFAULT_PREFS);
  });

  it('without storage, loading gives the defaults and saving does nothing', () => {
    expect(loadPrefs()).toEqual(DEFAULT_PREFS);
    expect(() => savePrefs({ speed: 2 })).not.toThrow();
  });

  it('saves a change and reads it back, merged with the rest', () => {
    const items = new Map<string, string>();
    const g = globalThis as { localStorage?: unknown };
    g.localStorage = {
      getItem: (k: string) => items.get(k) ?? null,
      setItem: (k: string, v: string) => void items.set(k, v),
    };
    try {
      savePrefs({ speed: 0.5 });
      savePrefs({ panelTab: 'analysis' });
      expect(loadPrefs()).toEqual({ ...DEFAULT_PREFS, speed: 0.5, panelTab: 'analysis' });
      items.set('circuitmaker.prefs', '{not json');
      expect(loadPrefs()).toEqual(DEFAULT_PREFS);
    } finally {
      delete g.localStorage;
    }
  });
});
