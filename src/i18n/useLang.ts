/** The interface language as a React hook: a component using it is drawn again when it changes. */
import { useSyncExternalStore } from 'react';
import { getLang, subscribeLang } from './lang';
import type { Lang } from './lang';

export const useLang = (): Lang => useSyncExternalStore(subscribeLang, getLang, () => 'he');
