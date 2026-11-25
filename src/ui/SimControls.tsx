import { useState } from 'react';
import { delayToTicks } from '../model/time';
import { SPEEDS, useSimStore } from '../store/simStore';
import type { Speed } from '../store/simStore';
import { useCircuitStore } from '../store/circuitStore';
import { textDir, tr } from '../i18n/lang';

const SPEED_LABEL: Record<Speed, string> = {
  0.25: '×0.25',
  0.5: '×0.5',
  1: '×1',
  2: '×2',
  4: '×4',
};

export function SimControls() {
  const sim = useSimStore((s) => s.sim);
  useSimStore((s) => s.version); // re-render on every simulation change
  const playing = useSimStore((s) => s.playing);
  const speed = useSimStore((s) => s.speed);
  const period = useSimStore((s) => s.period);
  const { play, pause, step, skipToEnd, cycle, setSpeed, reset } = useSimStore.getState();
  const unit = useCircuitStore((s) => s.circuit.timeUnit);
  const stopAt = useSimStore((s) => s.stopAt);
  const stopEachCycle = useSimStore((s) => s.stopEachCycle);
  const stoppedAt = useSimStore((s) => s.stoppedAt);
  const { setStopAt, setStopEachCycle } = useSimStore.getState();
  // what is being typed (shown as is while the field has focus), else the breakpoint itself
  const [draft, setDraft] = useState<string | null>(null);
  const typed = draft ?? (stopAt === null ? '' : String(stopAt / 10));

  // idle: nothing will ever happen; quiet: only clock ticks are left
  const idle = !sim || sim.idle;
  const quiet = !sim || sim.quiet;
  const time = sim ? (sim.now / 10).toFixed(1) : '0.0';

  return (
    <div className="sim-controls" role="toolbar" aria-label={tr('הרצת הסימולציה', 'Running the simulation')} dir={textDir()}>
      <span className="sim-time" aria-live="off">
        t = <bdi>{time}</bdi>
        {unit !== 'none' && ` ${unit}`}
      </span>
      <span className="sim-state">
        {playing
          ? tr('בתנועה', 'running')
          : stoppedAt !== null && sim?.now === stoppedAt
            ? tr('נעצר בנקודת העצירה', 'stopped at the breakpoint')
            : quiet
              ? tr('במנוחה', 'at rest')
              : tr('בהשהיה', 'paused')}
      </span>
      {playing ? (
        <button type="button" onClick={pause}>
          {tr('עצירה', 'Pause')}
        </button>
      ) : (
        <button type="button" onClick={play} disabled={idle}>
          {sim && sim.now > 0 ? tr('המשך', 'Resume') : tr('הפעלה', 'Play')}
        </button>
      )}
      <button type="button" onClick={step} disabled={idle}>
        {tr('צעד', 'Step')}
      </button>
      <button
        type="button"
        onClick={skipToEnd}
        disabled={quiet}
        title={tr('עד שכל השינויים שבדרך מגיעים ליעדם', 'Until every change on its way has arrived')}
      >
        {tr('דלג לסוף', 'Skip to end')}
      </button>
      {period > 0 && (
        <button type="button" onClick={cycle} title={tr('מחזור שעון אחד קדימה', 'One clock cycle ahead')}>
          {tr('מחזור', 'Cycle')}
        </button>
      )}
      <span className="sim-breaks" role="group" aria-label={tr('נקודות עצירה', 'Breakpoints')}>
        <label
          className="sim-stop-at"
          title={tr('ההרצה (וגם ״דלג לסוף״) נעצרת בזמן הזה', 'Running (and "Skip to end") stops at this time')}
        >
          {tr('עצירה ב-t =', 'Stop at t =')}
          <input
            type="number"
            inputMode="decimal"
            min={0}
            step={0.1}
            value={typed}
            placeholder="—"
            dir="ltr"
            onBlur={() => setDraft(null)}
            onChange={(e) => {
              setDraft(e.target.value);
              const t = Number(e.target.value);
              if (e.target.value === '') setStopAt(null);
              else if (Number.isFinite(t) && t > 0) setStopAt(delayToTicks(t));
            }}
          />
        </label>
        {period > 0 && (
          <label className="sim-stop-cycle" title={tr('ההרצה נעצרת בסוף כל מחזור שעון', 'Running stops at the end of every clock cycle')}>
            <input
              type="checkbox"
              checked={stopEachCycle}
              onChange={(e) => setStopEachCycle(e.target.checked)}
            />
            {tr('בסוף כל מחזור', 'At the end of every cycle')}
          </label>
        )}
      </span>
      <label className="sim-speed">
        {tr('מהירות', 'Speed')}
        <select value={speed} onChange={(e) => setSpeed(Number(e.target.value) as Speed)}>
          {SPEEDS.map((s) => (
            <option key={s} value={s}>
              {SPEED_LABEL[s]}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        onClick={() => reset(useCircuitStore.getState().circuit)}
        title={tr('חזרה ל-t = 0 עם הערכים הנוכחיים של המתגים', 'Back to t = 0 with the switches as they are now')}
      >
        {tr('איפוס זמן', 'Reset time')}
      </button>
    </div>
  );
}
