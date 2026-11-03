import { SPEEDS, useSimStore } from '../store/simStore';
import type { Speed } from '../store/simStore';
import { useCircuitStore } from '../store/circuitStore';

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
  const { play, pause, step, skipToEnd, setSpeed, reset } = useSimStore.getState();
  const unit = useCircuitStore((s) => s.circuit.timeUnit);

  const idle = !sim || sim.idle;
  const time = sim ? (sim.now / 10).toFixed(1) : '0.0';

  return (
    <div className="sim-controls" role="toolbar" aria-label="הרצת הסימולציה" dir="rtl">
      <span className="sim-time" aria-live="off">
        t = <bdi>{time}</bdi>
        {unit !== 'none' && ` ${unit}`}
      </span>
      <span className="sim-state">{idle ? 'במנוחה' : playing ? 'בתנועה' : 'בהשהיה'}</span>
      {playing ? (
        <button type="button" onClick={pause}>
          עצירה
        </button>
      ) : (
        <button type="button" onClick={play} disabled={idle}>
          המשך
        </button>
      )}
      <button type="button" onClick={step} disabled={idle}>
        צעד
      </button>
      <button type="button" onClick={skipToEnd} disabled={idle}>
        דלג לסוף
      </button>
      <label className="sim-speed">
        מהירות
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
        title="חזרה ל-t = 0 עם הערכים הנוכחיים של המתגים"
      >
        איפוס זמן
      </button>
    </div>
  );
}
