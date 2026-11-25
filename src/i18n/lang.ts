/**
 * The language of the interface: Hebrew (the default, as in the course) or
 * English (supervisor's review, 25.11). Every text is written next to its
 * translation with tr('…', '…'), so the two never drift apart and a missing
 * translation shows up in review rather than as a key on the screen.
 *
 * The choice is kept in this browser; a link with ?lang=en or #/…?lang=en
 * opens in English (and ?lang=he in Hebrew). No React here, so the engine
 * and the model can use tr() too; the hook for components is in useLang.ts.
 */
export type Lang = 'he' | 'en';

const KEY = 'circuitmaker.lang';

function fromAddress(): Lang | null {
  try {
    const m = /[?&]lang=(he|en)\b/.exec(`${window.location.search}${window.location.hash}`);
    return m ? (m[1] as Lang) : null;
  } catch {
    return null;
  }
}

function initial(): Lang {
  if (typeof window === 'undefined') return 'he';
  const asked = fromAddress();
  try {
    if (asked) {
      localStorage.setItem(KEY, asked);
      return asked;
    }
    return localStorage.getItem(KEY) === 'en' ? 'en' : 'he';
  } catch {
    return asked ?? 'he';
  }
}

let current: Lang = initial();
const listeners = new Set<() => void>();

export const getLang = (): Lang => current;

export function setLang(lang: Lang): void {
  if (lang === current) return;
  current = lang;
  try {
    localStorage.setItem(KEY, lang);
  } catch {
    // storage blocked: the choice lasts until the page is closed
  }
  listeners.forEach((f) => f());
}

export function subscribeLang(f: () => void): () => void {
  listeners.add(f);
  return () => listeners.delete(f);
}

export const isEnglish = () => current === 'en';

/** The text in the current language. */
export const tr = (he: string, en: string) => (current === 'en' ? en : he);

/** Text direction of the current language. */
export const textDir = (): 'rtl' | 'ltr' => (current === 'en' ? 'ltr' : 'rtl');
