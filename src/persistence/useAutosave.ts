import { useEffect } from 'react';
import { useCircuitStore } from '../store/circuitStore';
import { browserStorage } from './browserStorage';
import { createDebouncedSaver, restoreCircuit } from './persistence';
import { decodeShare, sharedData } from './shareLink';
import type { KeyValueStore } from './persistence';

/**
 * On start: bring back the circuit saved in this browser, if there is one.
 * After that: save every change, debounced, and once more when the tab is hidden.
 * The subscription starts only after the restore, so the example circuit
 * never overwrites a saved one. A shared link (#/editor?c=…) is opened after
 * the restore, so undo goes back to the circuit that was here before.
 */
/** Open the circuit in a shared link, if the address has one, and tidy the address. */
async function openShared() {
  const data = sharedData(window.location.hash);
  if (!data) return;
  // the address goes back to plain #/editor, so a reload keeps the user's edits
  window.history.replaceState(null, '', `${window.location.pathname}#/editor`);
  const shared = await decodeShare(data);
  const store = useCircuitStore.getState();
  if (!shared.ok) {
    store.showMessage(shared.error);
    return;
  }
  const hadCircuit = store.circuit.components.length > 0;
  store.loadCircuit(
    shared.circuit,
    shared.note ??
      `נפתח מקישור שיתוף.${hadCircuit ? ' המעגל שהיה כאן קודם: Ctrl+Z מחזיר אותו.' : ''}`,
  );
}

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
        // the saved circuit is where this visit starts: nothing to undo yet
        useCircuitStore.getState().clearHistory();
        setSaveStatus('saved');
      }
      unsubscribe = useCircuitStore.subscribe((state, prev) => {
        if (state.circuit !== prev.circuit) saver.schedule(state.circuit);
      });
      void openShared();
      window.addEventListener('hashchange', openShared);
    });

    const onHide = () => void saver.flush();
    window.addEventListener('pagehide', onHide);
    return () => {
      cancelled = true;
      unsubscribe();
      void saver.flush();
      window.removeEventListener('pagehide', onHide);
      window.removeEventListener('hashchange', openShared);
    };
  }, [kv]);
}
