/**
 * Critical path tab (WK5): the delay of the circuit, the path that sets it
 * (highlighted on the canvas), and the longest path to every lamp and to every
 * flip-flop input. Clicking a row highlights that path instead.
 */
import { useEffect, useState } from 'react';
import { criticalPaths } from '../analysis/critical';
import type { CriticalPath, CriticalResult } from '../analysis/critical';
import type { Circuit } from '../model';
import { useAnalysisStore } from '../store/analysisStore';
import { useCircuitStore } from '../store/circuitStore';

/** Highlight colour of the critical path (0 and 1 are the racing paths of the hazard analysis). */
const CRITICAL = 2;

const cache = new WeakMap<Circuit, CriticalResult>();
function resultFor(circuit: Circuit): CriticalResult {
  let r = cache.get(circuit);
  if (!r) {
    r = criticalPaths(circuit);
    cache.set(circuit, r);
  }
  return r;
}

const chain = (p: CriticalPath) => [...p.components, p.end].join(' → ');

export function CriticalPathPanel() {
  const circuit = useCircuitStore((s) => s.circuit);
  const result = resultFor(circuit);
  const [chosen, setChosen] = useState<string | null>(null);
  const unit = circuit.timeUnit === 'none' ? '' : ` ${circuit.timeUnit}`;
  const time = (ticks: number) => `${Math.round(ticks) / 10}${unit}`;

  const paths = result.ok ? result.paths : [];
  const shown = paths.find((p) => p.end === chosen) ?? paths[0];

  useEffect(() => {
    const { setHighlight, clearHighlight } = useAnalysisStore.getState();
    if (!shown) {
      clearHighlight();
      return;
    }
    setHighlight(new Map([...shown.components, ...shown.wires].map((id) => [id, CRITICAL])));
    return clearHighlight;
  }, [shown]);

  if (!result.ok) return <p className="hint analysis-empty">{result.reason}</p>;

  const worst = paths[0];
  const hasClock = circuit.components.some((c) => c.type === 'CLOCK');
  // only the inputs sampled at the clock edge; CLR', PRE' and RESET act at once
  const toStored = paths.filter((p) => p.end.includes('.') && !/\.(CLR'|PRE'|RESET)$/.test(p.end));
  const clockBound = toStored.length > 0 ? toStored[0] : null;

  return (
    <div className="critical" dir="rtl">
      <div className="critical-summary">
        <p className="critical-total">
          השהיית המעגל: <b dir="ltr">{time(worst.delay)}</b>
          <span className="critical-levels">
            {worst.levels === 1 ? 'רמה אחת' : `${worst.levels} רמות`}
          </span>
        </p>
        <p className="analysis-func" dir="ltr">
          {chain(worst)}
        </p>
        <p className="hint">
          זה הנתיב הארוך ביותר מכניסה ליציאה, והוא מסומן בכתום במעגל. כל רכיב נספר עם ההשהיה הגדולה מבין
          tpLH ו-tpHL. עד שעובר הזמן הזה, היציאות עלולות עוד להשתנות.
        </p>
        {hasClock && clockBound && (
          <p className="hint">
            בין שתי עליות שעון השינוי צריך להספיק להגיע מיציאת flip-flop לכניסה של flip-flop: הנתיב
            הארוך ביותר כזה הוא <b dir="ltr">{time(clockBound.delay)}</b>, ולכן מחזור השעון צריך להיות
            לפחות כזה.
          </p>
        )}
      </div>
      <div className="critical-list">
        <table className="truth-table critical-table">
          <thead>
            <tr>
              <th>אל</th>
              <th>השהיה</th>
              <th>רמות</th>
              <th>הנתיב</th>
            </tr>
          </thead>
          <tbody>
            {paths.map((p) => (
              <tr
                key={p.end}
                className={p === shown ? 'is-current' : undefined}
                onClick={() => setChosen(p.end)}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setChosen(p.end);
                  }
                }}
                title="לחיצה מסמנת את הנתיב הזה במעגל"
              >
                <td>
                  <bdi>{p.end}</bdi>
                </td>
                <td dir="ltr">{time(p.delay)}</td>
                <td>{p.levels}</td>
                <td dir="ltr" className="critical-chain">
                  {chain(p)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
