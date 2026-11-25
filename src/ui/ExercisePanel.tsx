/**
 * Self-practice tab: the system gives a question at one of three levels
 * ("build XOR from NAND gates only"), loads switches and lamps for it, and
 * when the student submits, grades the circuit: the function row by row, the
 * limits of the question, and how many parts it took (exercises/grade.ts).
 */
import { useState } from 'react';
import { newExercise } from '../exercises/exercises';
import type { Exercise, Level } from '../exercises/exercises';
import { gradeExercise } from '../exercises/grade';
import type { Circuit } from '../model';
import { useCircuitStore } from '../store/circuitStore';
import { useExerciseStore } from '../store/exerciseStore';
import { labelOf } from '../i18n/components';
import { textDir, tr } from '../i18n/lang';

const GATE_NAMES = new Set(['AND', 'OR', 'NAND', 'NOR', 'XOR', 'XNOR', 'NOT']);

function rulesText(ex: Exercise): string[] {
  const r = ex.rules;
  const name = (t: (typeof r.allowed)[number]) => (GATE_NAMES.has(t) ? t : labelOf(t));
  const allowed = r.allowed.map((t) =>
    r.max?.[t] !== undefined ? `${name(t)} (${tr('עד', 'at most')} ${r.max[t]})` : name(t),
  );
  return [
    tr(`מותר: ${allowed.join(', ')}`, `Allowed: ${allowed.join(', ')}`),
    ...(r.maxFanIn !== undefined ? [tr(`עד ${r.maxFanIn} כניסות לשער`, `At most ${r.maxFanIn} inputs per gate`)] : []),
    ...(r.maxParts !== undefined ? [tr(`עד ${r.maxParts} רכיבים`, `At most ${r.maxParts} components`)] : []),
    r.constants ? tr('מותר לחבר קבועים 0 ו-1', 'The constants 0 and 1 may be used') : tr('בלי קבועים 0 ו-1', 'No constants 0 and 1'),
    tr(`הכניסות: ${ex.inputs.join(', ')} בלבד (בלי משלימים)`, `Inputs: ${ex.inputs.join(', ')} only (no complements)`),
  ];
}

const lessonFor = (ex: Exercise) =>
  tr(
    `${ex.task} בונים בין המתגים לנורה, ובלשונית ״תרגול עצמי״ לוחצים ״הגשה״.`,
    `${ex.task} Build between the switches and the lamp, and in the "Self-practice" tab click "Submit".`,
  );

const levelName = (l: Level) => ({ 1: tr('קל', 'Easy'), 2: tr('בינוני', 'Medium'), 3: tr('קשה', 'Hard') })[l];

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
    <div className="exercise" dir={textDir()}>
      <div className="exercise-bar">
        <div className="exercise-levels" role="group" aria-label={tr('רמת קושי', 'Level')}>
          {([1, 2, 3] as Level[]).map((l) => (
            <button key={l} type="button" aria-pressed={level === l} onClick={() => setLevel(l)}>
              {levelName(l)}
            </button>
          ))}
        </div>
        <button type="button" className="primary" onClick={() => ask()}>
          {tr('שאלה חדשה', 'New question')}
        </button>
        {exercise && (
          <span className="exercise-tools">
            <button type="button" className="primary" onClick={submit}>
              {tr('הגשה', 'Submit')}
            </button>
            <button type="button" onClick={showHint} disabled={hint}>
              {tr('רמז', 'Hint')}
            </button>
            <button
              type="button"
              onClick={() => {
                reveal();
                setGraded(null);
                load(
                  exercise.solution(),
                  tr(
                    `פתרון אפשרי: ${exercise.task} (Ctrl+Z מחזיר את המעגל שלכם.)`,
                    `A possible solution: ${exercise.task} (Ctrl+Z brings your circuit back.)`,
                  ),
                );
              }}
            >
              {tr('הצגת פתרון', 'Show a solution')}
            </button>
            <button type="button" onClick={() => load(exercise.starter(), lessonFor(exercise))}>
              {tr('התחלה מחדש', 'Start over')}
            </button>
            <button type="button" onClick={stop}>
              {tr('סיום', 'Done')}
            </button>
          </span>
        )}
      </div>

      {!exercise ? (
        <p className="hint analysis-empty">
          {tr(
            'בוחרים רמה ולוחצים ״שאלה חדשה״. המערכת טוענת מתגים ונורה, ואתם בונים ביניהם מעגל לפי המגבלות של השאלה, כמו במבחן. ב״הגשה״ מקבלים ציון והערות: האם המעגל נכון בכל שורה, האם נשמרו המגבלות, וכמה רכיבים הוא צריך.',
            'Pick a level and click "New question". Switches and a lamp are loaded, and you build a circuit between them within the limits of the question, as in the exam. "Submit" gives a grade and comments: whether the circuit is right in every row, whether the limits were kept, and how many components it needs.',
          )}
        </p>
      ) : (
        <div className="exercise-body">
          <section className="exercise-question">
            <h3>
              {exercise.title} <span className="exercise-level">{levelName(exercise.level)}</span>
            </h3>
            <p>{exercise.task}</p>
            <ul className="exercise-rules">
              {rulesText(exercise).map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
            <p className="exercise-source">
              {tr('מקור:', 'Source:')} {exercise.source}
            </p>
            {hint && (
              <p className="exercise-hint">
                {tr('רמז:', 'Hint:')} {exercise.hint}
              </p>
            )}
          </section>
          {grade && (
            <section className="exercise-grade" aria-live="polite">
              <p className="exercise-score">
                <b dir="ltr">{grade.score}/100</b>
                <span>
                  {tr('נכונות', 'Correctness')} {grade.parts.function}/60 · {tr('מגבלות', 'Limits')} {grade.parts.rules}/25 ·{' '}
                  {tr('חיסכון', 'Economy')} {grade.parts.economy}/15
                </span>
              </p>
              {revealed && (
                <p className="exercise-note">
                  {tr('זה הפתרון שהוצג. כדי לתרגל, לוחצים ״שאלה חדשה״.', 'This is the solution that was shown. To practise, click "New question".')}
                </p>
              )}
              {graded !== circuit && (
                <p className="exercise-note">
                  {tr('המעגל השתנה מאז ההגשה. לוחצים ״הגשה״ שוב.', 'The circuit changed since it was submitted. Click "Submit" again.')}
                </p>
              )}
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
