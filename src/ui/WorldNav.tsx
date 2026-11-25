/**
 * The worlds of the app, in a row under the top bar (supervisor's review,
 * 25.11): building circuits, Boolean expressions, and the worlds still being
 * built, shown so the whole course is visible at a glance.
 */
import { LangSwitch } from './LangSwitch';
import './worlds.css';
import { tr } from '../i18n/lang';

const WORLDS: { id: string; label: [string, string]; ready: boolean }[] = [
  { id: 'editor', label: ['מעגלים', 'Circuits'], ready: true },
  { id: 'expressions', label: ['ביטויים בוליאניים', 'Boolean expressions'], ready: true },
  { id: 'karnaugh', label: ['מפות קרנו', 'Karnaugh maps'], ready: true },
  { id: 'fsm', label: ['מכונות מצבים', 'State machines'], ready: true },
  { id: 'rom', label: ['ROM ו-PLA', 'ROM and PLA'], ready: true },
];

export function WorldNav({ current }: { current: string }) {
  return (
    <nav className="worlds" aria-label={tr('עולמות', 'Worlds')}>
      {WORLDS.map((w) =>
        w.ready ? (
          <a
            key={w.id}
            href={`#/${w.id}`}
            className="world"
            aria-current={w.id === current ? 'page' : undefined}
          >
            {tr(...w.label)}
          </a>
        ) : (
          <span key={w.id} className="world is-soon" title={tr('בשלב הבא של הפרויקט', 'In the next stage of the project')}>
            {tr(...w.label)}
            <small>{tr('בקרוב', 'soon')}</small>
          </span>
        ),
      )}
      {/* the language of the whole site, at the end of the row on every page with worlds */}
      <span className="worlds-lang">
        <LangSwitch />
      </span>
    </nav>
  );
}
