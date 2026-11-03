import type { Circuit } from '../model/types';
import { counter4 } from './counter4';
import { downCounter } from './downCounter';
import { jkFromClock } from './jkFromClock';
import { asymmetric, dffFeedback, mux2Fixed, norLatch, staticZero, tffPulses } from './lessons';
import { mux2FromGates } from './mux2FromGates';
import { rippleAdder } from './rippleAdder';

export interface Example {
  id: string;
  /** Menu label, grouped by topic. */
  label: string;
  group: string;
  circuit: Circuit;
  /** What to try and what to see, shown in the properties panel after loading. */
  lesson: string;
}

/** Teaching circuits from the course, in the order of the course. */
export const EXAMPLES: Example[] = [
  {
    id: 'mux2',
    group: 'השהיות ו-hazards',
    label: 'MUX 2:1 משערים: ריצוד (WK5)',
    circuit: mux2FromGates,
    lesson:
      "ההדגמה מ-WK5: f = S0'·I0 + S0·I1 משערים, כל Tp = 1. לוחצים על S0 (מ-1 ל-0): המהפך מאחר ב-Tp אחד, ובזמן הזה שני שערי ה-AND מוציאים 0, אז F נופל ל-0 לרגע למרות שהפונקציה צריכה להישאר 1. בדיאגרמת הזמנים הריצוד מסומן ונמדד.",
  },
  {
    id: 'mux2fix',
    group: 'השהיות ו-hazards',
    label: 'MUX 2:1 עם מונח קונצנזוס',
    circuit: mux2Fixed,
    lesson:
      'אותו MUX עם מונח הקונצנזוס I0·I1 (שער AND שלישי, a3). לוחצים על S0: F נשאר 1 כל הזמן, כי a3 מחזיק את ה-OR בזמן שהמהפך מתעדכן. כך מתקנים static-1 hazard.',
  },
  {
    id: 'static0',
    group: 'השהיות ו-hazards',
    label: 'static-0 hazard (תרגיל בית 5)',
    circuit: staticZero,
    lesson:
      'Z = (A\' + B)(B\' + C), כל ההשהיות 10. B עולה מעצמו ב-t = 30 (שינוי מתוזמן, אפשר לערוך אותו במאפיינים של B). לוחצים "הפעלה" או "דלג לסוף": Z קופץ ל-1 בין t = 50 ל-60 וחוזר ל-0. זה static-0 hazard ברוחב 10, כמו בפתרון.',
  },
  {
    id: 'asym',
    group: 'השהיות ו-hazards',
    label: 'השהיות עלייה וירידה שונות (תרגול 5)',
    circuit: asymmetric,
    lesson:
      'f = AB ⊕ CD. ל-AND השהיית עלייה 10 וירידה 20, ל-XOR השהיה 5. ב-t = 60 הכניסות ABCD עוברות מ-1100 ל-1011. I2 עולה (10) לפני ש-I1 יורד (20), ולכן f נופל ל-0 בין t = 75 ל-85. נסו לקבוע ל-AND השהיה אחידה: הריצוד נעלם.',
  },
  {
    id: 'ripple',
    group: 'רכיבים צירופיים',
    label: 'מסכם ripple-carry של 4 ביט',
    circuit: rippleAdder,
    lesson:
      'ארבעה מסכמים מלאים בשרשרת: 0011 + 1011 = 1110. משנים את A0 ורואים בדיאגרמת הזמנים שכל מסכם מתעדכן רק אחרי שהנשא מהמסכם הקודם הגיע, Tp אחד לכל שלב. זה הנתיב הקריטי של המסכם.',
  },
  {
    id: 'latch',
    group: 'רכיבים עקיבים',
    label: 'SR latch משני שערי NOR (WK7)',
    circuit: norLatch,
    lesson:
      "בהתחלה Q לא ידוע (X), כי אף אחד לא קבע אותו. S = 1 קובע 1, R = 1 מאפס, S = R = 0 זוכר את הערך. S = R = 1 נותן Q = Q' = 0. כדי לראות מה קורה כשמורידים את שניהם יחד, כותבים בשינויים המתוזמנים של S ושל R את אותו דבר, למשל 2:1 6:0, ומריצים: השערים מתחילים להתנודד.",
  },
  {
    id: 'counter',
    group: 'רכיבים עקיבים',
    label: 'מונה 4 ביט עם שעון',
    circuit: counter4,
    lesson:
      'המונה סופר מ-0 עד 15 בכל עליית שעון ואז חוזר ל-0. "מחזור" מתקדם מחזור שעון אחד. RESET = 1 מאפס מיד, בלי לחכות לשעון (אסינכרוני), וכל עוד הוא 1 המונה לא סופר.',
  },
  {
    id: 'tff',
    group: 'דיאגרמות זמנים ממבחנים',
    label: 'T-FF עם Tp = 0.5 (2026 מועד א, 2D)',
    circuit: tffPulses,
    lesson:
      "בלי השהיות Q2 = Q1·Q0' היה זהה ל-Q0'. עם Tp = 0.5 לשערים, Q1 מאחר אחרי Q0, ולכן Q2 יורד מוקדם ועולה מאוחר: כל פולס מתקצר ל-1.5 שניות. סעיף 2: קובעים גם ל-T-FF השהיה 0.5 ומקבלים את אותו גרף, מוזז ב-0.5.",
  },
  {
    id: 'jk',
    group: 'דיאגרמות זמנים ממבחנים',
    label: 'JK עם J = K = CLK׳ (2026 מועד ב, 2D)',
    circuit: jkFromClock,
    lesson:
      'J ו-K הם השעון דרך מהפך (Tp 0.5), ול-JK יש Tp 1. ה-FF דוגם את J ו-K רגע לפני עליית השעון, ולכן Q מתהפך ב-t = 2, 4, 6. סעיף 3: קובעים לכל הרכיבים Tp = 1, ואחרי המחזור הראשון ה-FF תמיד דוגם J = K = 0 ו-Q נשאר 1.',
  },
  {
    id: 'dff',
    group: 'דיאגרמות זמנים ממבחנים',
    label: 'D-FF עם משוב (2026 מועד ג, 2D)',
    circuit: dffFeedback,
    lesson:
      "D = Q' דרך שני מהפכים עם Tp = 1, ול-FF אין השהיה. ב-t = 3 וב-t = 7, D משתנה בדיוק בעליית השעון, וה-FF דוגם את הערך הישן (רגע לפני הקצה). סעיף 1: קובעים למהפכים Tp = 0 ומקבלים מחלק תדר ב-2.",
  },
  {
    id: 'down',
    group: 'דיאגרמות זמנים ממבחנים',
    label: 'מונה מטה מ-4 JK (2025 מועד א, 2D)',
    circuit: downCounter,
    lesson:
      'מונה מטה סינכרוני: J0 = K0 = 1, ו-J ו-K של כל שלב הם AND של ה-Q\' של השלבים שלפניו. מ-0000 הוא סופר 1111, 1110, 1101 וכן הלאה. "מחזור" מתקדם עלייה אחת, ובדיאגרמה רואים את כל ה-Q.',
  },
];
