/**
 * Self-practice tab: the system gives a question at one of three levels
 * ("build XOR from NAND gates only"), loads switches and lamps for it, and
 * when the student submits, grades the circuit: the function row by row, the
 * limits of the question, and how many parts it took (exercises/grade.ts).
 */
import { useState } from 'react';
import { LEVEL_NAMES, newExercise } from '../exercises/exercises';
import type { Exercise, Level } from '../exercises/exercises';
import { gradeExercise } from '../exercises/grade';
import type { Circuit } from '../model';
import { CATALOG } from '../model';
import { useCircuitStore } from '../store/circuitStore';
import { useExerciseStore } from '../store/exerciseStore';

const GATE_NAMES = new Set(['AND', 'OR', 'NAND', 'NOR', 'XOR', 'XNOR', 'NOT']);

function rulesText(ex: Exercise): string[] {
  const r = ex.rules;
  const name = (t: (typeof r.allowed)[number]) => (GATE_NAMES.has(t) ? t : CATALOG[t].label);
  const allowed = r.allowed.map((t) => (r.max?.[t] !== undefined ? `${name(t)} (עד ${r.max[t]})` : name(t)));
  return [
    `מותר: ${allowed.join(', ')}`,
    ...(r.maxFanIn !== undefined ? [`עד ${r.maxFanIn} כניסות לשער`] : []),
    ...(r.maxParts !== undefined ? [`עד ${r.maxParts} רכיבים`] : []),
    r.constants ? 'מותר לחבר קבועים 0 ו-1' : 'בלי קבועים 0 ו-1',
    `הכניסות: ${ex.inputs.join(', ')} בלבד (בלי משלימים)`,
  ];
}

const lessonFor = (ex: Exercise) =>
  `${ex.task} בונים בין המתגים לנורה, ובלשונית ״תרגול עצמי״ לוחצים ״הגשה״.`;

const ICON = { good: '✓', error: '✗', warn: '!' } as const;

export function ExercisePanel() {
  const circuit = useCircuitStore((s) => s.circuit);
  const { level, exercise, grade, revealed, hint, setLevel, start, setGrade, reveal, showHint, stop } =
    useExerciseStore();
  const [graded, setGraded] = useState<Circuit | null>(null);

  const load = (c: Circuit, lesson: string) => useCircuitStore.getState().loadCircuit(c, lesson);
  const ask = (l: Level = level) => {
    const ex = newExercise(l, exercise?.key);
    start(ex);
    load(ex.starter(), lessonFor(ex));
  };
  const submit = () => {
    if (!exercise) return;
    setGrade(gradeExercise(circuit, exercise));
    setGraded(circuit);
  };

  return (
    <div className="exercise" dir="rtl">
      <div className="exercise-bar">
        <div className="exercise-levels" role="group" aria-label="רמת קושי">
          {([1, 2, 3] as Level[]).map((l) => (
            <button key={l} type="button" aria-pressed={level === l} onClick={() => setLevel(l)}>
              {LEVEL_NAMES[l]}
            </button>
          ))}
        </div>
        <button type="button" className="primary" onClick={() => ask()}>
          שאלה חדשה
        </button>
        {exercise && (
          <span className="exercise-tools">
            <button type="button" className="primary" onClick={submit}>
              הגשה
            </button>
            <button type="button" onClick={showHint} disabled={hint}>
              רמז
            </button>
            <button
              type="button"
              onClick={() => {
                reveal();
                setGraded(null);
                load(exercise.solution(), `פתרון אפשרי: ${exercise.task} (Ctrl+Z מחזיר את המעגל שלכם.)`);
              }}
            >
              הצגת פתרון
            </button>
            <button type="button" onClick={() => load(exercise.starter(), lessonFor(exercise))}>
              התחלה מחדש
            </button>
            <button type="button" onClick={stop}>
              סיום
            </button>
          </span>
        )}
      </div>

      {!exercise ? (
        <p className="hint analysis-empty">
          בוחרים רמה ולוחצים ״שאלה חדשה״. המערכת טוענת מתגים ונורה, ואתם בונים ביניהם מעגל לפי המגבלות של
          השאלה, כמו במבחן. ב״הגשה״ מקבלים ציון והערות: האם המעגל נכון בכל שורה, האם נשמרו המגבלות, וכמה
          רכיבים הוא צריך.
        </p>
      ) : (
        <div className="exercise-body">
          <section className="exercise-question">
            <h3>
              {exercise.title} <span className="exercise-level">{LEVEL_NAMES[exercise.level]}</span>
            </h3>
            <p>{exercise.task}</p>
            <ul className="exercise-rules">
              {rulesText(exercise).map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
            <p className="exercise-source">מקור: {exercise.source}</p>
            {hint && <p className="exercise-hint">רמז: {exercise.hint}</p>}
          </section>
          {grade && (
            <section className="exercise-grade" aria-live="polite">
              <p className="exercise-score">
                <b dir="ltr">{grade.score}/100</b>
                <span>
                  נכונות {grade.parts.function}/60 · מגבלות {grade.parts.rules}/25 · חיסכון {grade.parts.economy}/15
                </span>
              </p>
              {revealed && <p className="exercise-note">זה הפתרון שהוצג. כדי לתרגל, לוחצים ״שאלה חדשה״.</p>}
              {graded !== circuit && <p className="exercise-note">המעגל השתנה מאז ההגשה. לוחצים ״הגשה״ שוב.</p>}
              <ul className="exercise-notes">
                {grade.notes.map((n, i) => (
                  <li key={i} className={`is-${n.kind}`}>
                    <span aria-hidden="true">{ICON[n.kind]}</span> {n.text}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
