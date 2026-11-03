/**
 * Saving circuits (PROJECT_MASTER §2, "שמירת נתונים"):
 * - the current circuit is saved automatically in the browser (IndexedDB);
 * - a JSON file is the permanent copy, exported and imported by the user.
 *
 * Storage is passed in as a small key-value interface, so the logic is tested
 * without a browser. In the app it is backed by idb-keyval.
 */
import { parseCircuit, serializeCircuit } from '../model';
import type { Circuit, ParseResult } from '../model';

export interface KeyValueStore {
  get: (key: string) => Promise<unknown>;
  set: (key: string, value: unknown) => Promise<void>;
}

export const AUTOSAVE_KEY = 'circuitmaker:current';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

/**
 * The saved circuit, re-checked as if it were an imported file, or null when
 * there is none or it is no longer valid (for example after a format change).
 */
export async function restoreCircuit(kv: KeyValueStore): Promise<Circuit | null> {
  try {
    const saved = await kv.get(AUTOSAVE_KEY);
    if (saved === undefined || saved === null) return null;
    const result = parseCircuit(JSON.stringify(saved));
    return result.ok ? result.circuit : null;
  } catch {
    return null;
  }
}

/**
 * Calls `save` once things go quiet for `delay` ms after the last change, so a
 * drag that moves a gate 60 times a second costs one write, not 60.
 */
export function createDebouncedSaver(
  kv: KeyValueStore,
  onStatus: (status: SaveStatus) => void,
  delay = 400,
) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let latest: Circuit | undefined;

  const flush = async () => {
    timer = undefined;
    if (!latest) return;
    const circuit = latest;
    latest = undefined;
    try {
      await kv.set(AUTOSAVE_KEY, circuit);
      onStatus('saved');
    } catch {
      onStatus('error');
    }
  };

  return {
    schedule(circuit: Circuit) {
      latest = circuit;
      onStatus('saving');
      if (timer !== undefined) clearTimeout(timer);
      timer = setTimeout(() => void flush(), delay);
    },
    flush,
    cancel() {
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
      latest = undefined;
    },
  };
}

/**
 * A file name that every browser keeps: Latin letters, digits, - and _ only.
 * The circuit's own name (Hebrew included) is stored inside the file anyway;
 * when nothing Latin is left, the date is used instead.
 */
export function fileNameFor(name: string, today: Date = new Date()): string {
  const base = name
    .trim()
    .replace(/[^A-Za-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return `${base || `circuit-${today.toISOString().slice(0, 10)}`}.json`;
}

/** Starts a download of the circuit as a JSON file. */
export function downloadCircuit(circuit: Circuit): void {
  const blob = new Blob([serializeCircuit(circuit)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileNameFor(circuit.name);
  document.body.appendChild(a);
  a.click();
  a.remove();
  // revoking right away can cancel the download or drop the file name in some browsers
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Reads a file the user picked and checks it like any other circuit. */
export async function readCircuitFile(file: Blob): Promise<ParseResult> {
  try {
    return parseCircuit(await file.text());
  } catch {
    return { ok: false, errors: ['לא ניתן לקרוא את הקובץ'] };
  }
}
