/**
 * The self-practice question in progress (exercises/), and its last grade.
 * The question's key is kept in the browser, so after a reload the question
 * is still there next to the circuit that autosave brought back.
 */
import { create } from 'zustand';
import { exerciseFromKey } from '../exercises/exercises';
import type { Exercise, Level } from '../exercises/exercises';
import type { Grade } from '../exercises/grade';

const KEY = 'circuitmaker.exercise';

interface Saved {
  key: string;
  level: Level;
}

function load(): Saved | null {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Saved | null;
    return s && exerciseFromKey(s.key) ? s : null;
  } catch {
    return null;
  }
}

function save(s: Saved | null) {
  try {
    if (s) localStorage.setItem(KEY, JSON.stringify(s));
    else localStorage.removeItem(KEY);
  } catch {
    // storage blocked: the question lasts until the page is closed
  }
}

interface ExerciseState {
  level: Level;
  exercise: Exercise | null;
  grade: Grade | null;
  /** The solution was shown, so the grade is only for checking. */
  revealed: boolean;
  hint: boolean;
  setLevel: (level: Level) => void;
  start: (exercise: Exercise) => void;
  setGrade: (grade: Grade | null) => void;
  reveal: () => void;
  showHint: () => void;
  stop: () => void;
}

const saved = load();

export const useExerciseStore = create<ExerciseState>((set, get) => ({
  level: saved?.level ?? 1,
  exercise: saved ? exerciseFromKey(saved.key) : null,
  grade: null,
  revealed: false,
  hint: false,
  setLevel: (level) => set({ level }),
  start: (exercise) => {
    save({ key: exercise.key, level: get().level });
    set({ exercise, grade: null, revealed: false, hint: false });
  },
  setGrade: (grade) => set({ grade }),
  reveal: () => set({ revealed: true, grade: null }),
  showHint: () => set({ hint: true }),
  stop: () => {
    save(null);
    set({ exercise: null, grade: null, revealed: false, hint: false });
  },
}));
