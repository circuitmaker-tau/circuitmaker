import { get, set } from 'idb-keyval';
import type { KeyValueStore } from './persistence';

/** IndexedDB through idb-keyval. Survives reloads; cleared if the user clears site data. */
export const browserStorage: KeyValueStore = {
  get: (key) => get(key),
  set: (key, value) => set(key, value),
};
