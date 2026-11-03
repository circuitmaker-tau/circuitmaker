import { describe, expect, it } from 'vitest';
import { mux2FromGates } from '../examples/mux2FromGates';
import { serializeCircuit } from '../model';
import {
  AUTOSAVE_KEY,
  createDebouncedSaver,
  fileNameFor,
  readCircuitFile,
  restoreCircuit,
} from './persistence';
import type { KeyValueStore, SaveStatus } from './persistence';

const memory = (initial: Record<string, unknown> = {}) => {
  const data = new Map(Object.entries(initial));
  let writes = 0;
  const kv: KeyValueStore = {
    get: async (k) => data.get(k),
    set: async (k, v) => {
      writes++;
      data.set(k, structuredClone(v));
    },
  };
  return { kv, data, writes: () => writes };
};

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('restore', () => {
  it('returns null when nothing was saved', async () => {
    expect(await restoreCircuit(memory().kv)).toBeNull();
  });

  it('returns the saved circuit', async () => {
    const { kv } = memory({ [AUTOSAVE_KEY]: mux2FromGates });
    expect(await restoreCircuit(kv)).toEqual(mux2FromGates);
  });

  it('ignores a saved circuit that is no longer valid', async () => {
    const { kv } = memory({ [AUTOSAVE_KEY]: { ...mux2FromGates, version: 99 } });
    expect(await restoreCircuit(kv)).toBeNull();
  });

  it('survives a storage failure', async () => {
    const kv: KeyValueStore = {
      get: async () => {
        throw new Error('blocked');
      },
      set: async () => {},
    };
    expect(await restoreCircuit(kv)).toBeNull();
  });
});

describe('autosave', () => {
  it('writes once after a burst of changes, with the last version', async () => {
    const mem = memory();
    const statuses: SaveStatus[] = [];
    const saver = createDebouncedSaver(mem.kv, (s) => statuses.push(s), 20);
    for (let x = 0; x < 10; x++) {
      saver.schedule({ ...mux2FromGates, name: `v${x}` });
    }
    await wait(60);
    expect(mem.writes()).toBe(1);
    expect((mem.data.get(AUTOSAVE_KEY) as { name: string }).name).toBe('v9');
    expect(statuses.at(-1)).toBe('saved');
  });

  it('reports an error when the write fails', async () => {
    const statuses: SaveStatus[] = [];
    const kv: KeyValueStore = {
      get: async () => undefined,
      set: async () => {
        throw new Error('quota');
      },
    };
    const saver = createDebouncedSaver(kv, (s) => statuses.push(s), 0);
    saver.schedule(mux2FromGates);
    await saver.flush();
    expect(statuses.at(-1)).toBe('error');
  });

  it('can be cancelled', async () => {
    const mem = memory();
    const saver = createDebouncedSaver(mem.kv, () => {}, 10);
    saver.schedule(mux2FromGates);
    saver.cancel();
    await wait(30);
    expect(mem.writes()).toBe(0);
  });
});

describe('files', () => {
  it('makes a file name every browser keeps', () => {
    const day = new Date('2026-11-03T12:00:00Z');
    expect(fileNameFor('MUX 2:1 משערים', day)).toBe('MUX-2-1.json');
    expect(fileNameFor('המעגל שלי', day)).toBe('circuit-2026-11-03.json');
    expect(fileNameFor('  ', day)).toBe('circuit-2026-11-03.json');
    expect(fileNameFor('a/b\\c?', day)).toBe('a-b-c.json');
  });

  it('reads a circuit file and reports a bad one', async () => {
    const good = await readCircuitFile(new Blob([serializeCircuit(mux2FromGates)]));
    expect(good.ok).toBe(true);
    const bad = await readCircuitFile(new Blob(['{"version":1}']));
    expect(bad.ok).toBe(false);
  });
});
