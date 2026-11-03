/** State of the guided tour of the editor (ui/Tour.tsx), and when to show it. */
import { useEffect } from 'react';
import { create } from 'zustand';

const SEEN_KEY = 'circuitmaker.tour-seen';

export const TOUR_STEPS = [
  {
    target: 'select.examples',
    title: 'דוגמאות מהקורס',
    text: '11 מעגלים מההרצאות, מתרגילי הבית ומהמבחנים. כל אחד מגיע עם "מה לומדים כאן".',
  },
  {
    target: '.palette',
    title: 'רכיבים',
    text: 'גוררים רכיב לקנבס, או לוחצים עליו. יש שערים, רכיבים צירופיים ורכיבים עקיבים.',
  },
  {
    target: '.canvas',
    title: 'הקנבס',
    text: 'מחווטים מיציאה (ימין) לכניסה (שמאל). לחיצה על מתג משנה אותו ומתחילה הרצה. 1 ירוק, 0 אדום, X כתום.',
  },
  {
    target: '.sim-controls',
    title: 'הרצה',
    text: 'עצירה, צעד לשינוי הבא, דלג לסוף, מחזור שעון ומהירות. השינוי נע לאורך החוט בזמן ה-Tp.',
  },
  {
    target: '.timing',
    title: 'דיאגרמת זמנים וניתוח',
    text: 'צורת הגל של כל אות, עם סמן ומדידה. בלשונית השנייה: hazards, מפת קרנו והצעת תיקון.',
  },
  {
    target: '.properties',
    title: 'מאפיינים',
    text: 'לוחצים על רכיב כדי לקבוע Tp, ערך התחלתי, חצי מחזור לשעון או שינויים מתוזמנים למתג.',
  },
];

interface TourState {
  step: number | null;
  start: () => void;
  stop: () => void;
  next: () => void;
}

export const useTourStore = create<TourState>()((set, get) => ({
  step: null,
  start: () => set({ step: 0 }),
  stop: () => {
    try {
      localStorage.setItem(SEEN_KEY, '1');
    } catch {
      // private mode: the tour may show again, which is harmless
    }
    set({ step: null });
  },
  next: () => {
    const s = get().step;
    if (s === null) return;
    if (s + 1 >= TOUR_STEPS.length) get().stop();
    else set({ step: s + 1 });
  },
}));

/** Has this browser seen the tour? Without storage (private mode) we say yes, so it never nags. */
function tourSeen(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return true;
  }
}

/** Start the tour on the first visit to the editor. */
export function useFirstVisitTour() {
  useEffect(() => {
    if (!tourSeen()) {
      const t = setTimeout(() => useTourStore.getState().start(), 600);
      return () => clearTimeout(t);
    }
  }, []);
}
