import { useEffect } from 'react';
import { useCircuitStore } from '../store/circuitStore';
import { browserStorage } from './browserStorage';
import { createDebouncedSaver, restoreCircuit } from './persistence';
import type { KeyValueStore } from './persistence';

/**
 * On start: bring back the circuit saved in this browser, if there is one.
 * After that: save every change, debounced, and once more when the tab is hidden.
 * The subscription starts only after the restore, so the example circuit
 * never overwrites a saved one.
 */
export function useAutosave(kv: KeyValueStore = browserStorage) {
  useEffect(() => {
    let cancelled = false;
    let unsubscribe = () => {};
    const { setSaveStatus, loadCircuit } = useCircuitStore.getState();
    const saver = createDebouncedSaver(kv, setSaveStatus);

    void restoreCircuit(kv).then((saved) => {
      if (cancelled) return;
      if (saved) {
        loadCircuit(saved);
        setSaveStatus('saved');
      }
      unsubscribe = useCircuitStore.subscribe((state, prev) => {
        if (state.circuit !== prev.circuit) saver.schedule(state.circuit);
      });
    });

    const onHide = () => void saver.flush();
    window.addEventListener('pagehide', onHide);
    return () => {
      cancelled = true;
      unsubscribe();
      void saver.flush();
      window.removeEventListener('pagehide', onHide);
    };
  }, [kv]);
}
