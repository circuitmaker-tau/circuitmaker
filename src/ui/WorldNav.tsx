/**
 * The worlds of the app, in a row under the top bar (supervisor's review,
 * 25.11): building circuits, Boolean expressions, and the worlds still being
 * built, shown so the whole course is visible at a glance.
 */
import './worlds.css';

const WORLDS: { id: string; label: string; ready: boolean }[] = [
  { id: 'editor', label: 'מעגלים', ready: true },
  { id: 'expressions', label: 'ביטויים בוליאניים', ready: true },
  { id: 'karnaugh', label: 'מפות קרנו', ready: true },
  { id: 'fsm', label: 'מכונות מצבים', ready: true },
  { id: 'rom', label: 'ROM ו-PLA', ready: false },
];

export function WorldNav({ current }: { current: string }) {
  return (
    <nav className="worlds" aria-label="עולמות">
      {WORLDS.map((w) =>
        w.ready ? (
          <a
            key={w.id}
            href={`#/${w.id}`}
            className="world"
            aria-current={w.id === current ? 'page' : undefined}
          >
            {w.label}
          </a>
        ) : (
          <span key={w.id} className="world is-soon" title="בשלב הבא של הפרויקט">
            {w.label}
            <small>בקרוב</small>
          </span>
        ),
      )}
    </nav>
  );
}
