/** State of the guided tour of the editor (ui/Tour.tsx), and when to show it. */
import { useEffect } from 'react';
import { create } from 'zustand';
import { tr } from '../i18n/lang';

const SEEN_KEY = 'circuitmaker.tour-seen';

export const TOUR_STEPS = [
  {
    target: 'select.examples',
    get title() {
      return tr('דוגמאות מהקורס', 'Examples from the course');
    },
    get text() {
      return tr(
        'מעגלים מההרצאות, מתרגילי הבית ומהמבחנים. כל אחד מגיע עם "מה לומדים כאן".',
        'Circuits from the lectures, the homework and the exams. Each comes with "What to learn here".',
      );
    },
  },
  {
    target: '.palette',
    get title() {
      return tr('רכיבים', 'Components');
    },
    get text() {
      return tr(
        'גוררים רכיב לקנבס, או לוחצים עליו. יש שערים, רכיבים צירופיים ורכיבים עקיבים.',
        'Drag a component onto the canvas, or click it. There are gates, combinational and sequential components.',
      );
    },
  },
  {
    target: '.canvas',
    get title() {
      return tr('הקנבס', 'The canvas');
    },
    get text() {
      return tr(
        'מחווטים מיציאה (ימין) לכניסה (שמאל). לחיצה על מתג משנה אותו ומתחילה הרצה. 1 ירוק, 0 אדום, X כתום.',
        'Wire from an output (right) to an input (left). Clicking a switch flips it and starts a run. 1 is green, 0 red, X orange.',
      );
    },
  },
  {
    target: '.sim-controls',
    get title() {
      return tr('הרצה', 'Running');
    },
    get text() {
      return tr(
        'עצירה, צעד לשינוי הבא, דלג לסוף, מחזור שעון ומהירות. בזמן ה-Tp מתמלא פס בתוך הרכיב, ורק אז היציאה מתחלפת.',
        'Pause, step to the next change, skip to the end, one clock cycle, and speed. During the Tp a bar fills inside the component, and only then does the output change.',
      );
    },
  },
  {
    target: '.timing',
    get title() {
      return tr('דיאגרמת זמנים וניתוח', 'Timing diagram and analysis');
    },
    get text() {
      return tr(
        'צורת הגל של כל אות, עם סמן ומדידה. בלשונית השנייה: hazards, מפת קרנו והצעת תיקון.',
        'The waveform of every signal, with a cursor and measurement. In the next tab: hazards, a Karnaugh map and a suggested fix.',
      );
    },
  },
  {
    target: '.properties',
    get title() {
      return tr('מאפיינים', 'Properties');
    },
    get text() {
      return tr(
        'לוחצים על רכיב כדי לקבוע Tp, ערך התחלתי, חצי מחזור לשעון או שינויים מתוזמנים למתג.',
        'Click a component to set its Tp, its initial value, the half period of a clock or the scheduled changes of a switch.',
      );
    },
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
