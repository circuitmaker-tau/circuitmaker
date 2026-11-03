import { useState } from 'react';
import { CATALOG, formatSchedule, outputPortsOf, parseSchedule } from '../model';
import type { Component } from '../model';
import { useCircuitStore } from '../store/circuitStore';
import { useTimingStore } from '../store/timingStore';

interface PropertiesPanelProps {
  component: Component | null;
}

export function PropertiesPanel({ component }: PropertiesPanelProps) {
  const lesson = useCircuitStore((s) => s.lesson);
  return (
    <aside className="properties" aria-label="מאפייני רכיב">
      <h2>מאפיינים</h2>
      {component ? (
        // key resets the draft value when another component is selected
        <ComponentFields key={component.id} component={component} />
      ) : (
        <>
          <p className="hint">בחרו רכיב כדי לערוך את ה-Tp ואת מספר הכניסות.</p>
          {lesson && (
            <section className="lesson" aria-label="מה לומדים מהדוגמה">
              <h3>מה לומדים כאן</h3>
              <p>{lesson}</p>
            </section>
          )}
        </>
      )}
    </aside>
  );
}

function ComponentFields({ component }: { component: Component }) {
  const updateComponent = useCircuitStore((s) => s.updateComponent);
  const removeComponents = useCircuitStore((s) => s.removeComponents);
  const timeUnit = useCircuitStore((s) => s.circuit.timeUnit);
  const [delayText, setDelayText] = useState(String(component.delay));
  const [halfText, setHalfText] = useState(String(component.props?.halfPeriod ?? 1));
  const [scheduleText, setScheduleText] = useState(formatSchedule(component.props?.schedule));
  const circuit = useCircuitStore((s) => s.circuit);
  useTimingStore((s) => s.probes); // re-render when the diagram's nets change
  const { shown, setProbe } = useTimingStore.getState();
  const showMessage = useCircuitStore((s) => s.showMessage);
  const def = CATALOG[component.type];
  const hasDelay = def.category !== 'io';

  const commitDelay = () => {
    const value = Number(delayText);
    if (!updateComponent(component.id, { delay: value })) setDelayText(String(component.delay));
  };

  const commitHalf = () => {
    const value = Number(halfText);
    if (!updateComponent(component.id, { props: { halfPeriod: value } })) {
      setHalfText(String(component.props?.halfPeriod ?? 1));
    }
  };

  const commitSchedule = () => {
    const parsed = parseSchedule(scheduleText);
    if (!parsed.ok) {
      showMessage(parsed.error);
      setScheduleText(formatSchedule(component.props?.schedule));
      return;
    }
    updateComponent(component.id, {
      props: { schedule: parsed.schedule.length > 0 ? parsed.schedule : undefined },
    });
    setScheduleText(formatSchedule(parsed.schedule));
  };

  // nets of this component that can go in the timing diagram (a lamp shows what feeds it)
  const probeNets: { net: string; label: string }[] =
    component.type === 'OUTPUT'
      ? circuit.wires
          .filter((w) => w.to.component === component.id)
          .map((w) => ({ net: `${w.from.component}:${w.from.port}`, label: component.id }))
      : component.type === 'CONST0' || component.type === 'CONST1'
        ? []
        : outputPortsOf(component.type).map((p) => ({
            net: `${component.id}:${p}`,
            label: outputPortsOf(component.type).length > 1 ? p : component.id,
          }));
  const inDiagram = new Set(shown(circuit));

  // decision 8: flip-flops start at 0, latches at X, unless set here
  const isLatch = component.type === 'SR_LATCH' || component.type === 'D_LATCH';
  const init = component.props?.init ?? (isLatch ? 'X' : 0);
  const multiBit = component.type === 'REGISTER4' || component.type === 'COUNTER4';

  return (
    <div className="fields">
      <p className="field-title">
        {def.label} · <bdi>{component.id}</bdi>
      </p>

      {hasDelay && (
        <label className="field">
          <span>Tp {timeUnit !== 'none' && `(${timeUnit})`}</span>
          <input
            type="number"
            min={0}
            step={0.1}
            dir="ltr"
            value={delayText}
            onChange={(e) => setDelayText(e.target.value)}
            onBlur={commitDelay}
            onKeyDown={(e) => e.key === 'Enter' && commitDelay()}
          />
        </label>
      )}

      {def.minInputs !== def.maxInputs && (
        <label className="field">
          <span>מספר כניסות</span>
          <select
            value={component.inputs}
            onChange={(e) => updateComponent(component.id, { inputs: Number(e.target.value) })}
          >
            {Array.from(
              { length: def.maxInputs - def.minInputs + 1 },
              (_, i) => def.minInputs + i,
            ).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      )}

      {def.stateful && (
        <label className="field">
          <span>{multiBit ? 'ערך התחלתי (כל הביטים)' : 'ערך התחלתי של Q'}</span>
          <select
            value={String(init)}
            onChange={(e) => {
              const v = e.target.value;
              updateComponent(component.id, {
                props: { init: v === 'X' ? 'X' : v === '1' ? 1 : 0 },
              });
            }}
          >
            <option value="0">0</option>
            <option value="1">1</option>
            <option value="X">X (לא ידוע)</option>
          </select>
        </label>
      )}

      {component.type === 'CLOCK' && (
        <>
          <label className="field">
            <span>חצי מחזור {timeUnit !== 'none' && `(${timeUnit})`}</span>
            <input
              type="number"
              min={0.1}
              step={0.1}
              dir="ltr"
              value={halfText}
              onChange={(e) => setHalfText(e.target.value)}
              onBlur={commitHalf}
              onKeyDown={(e) => e.key === 'Enter' && commitHalf()}
            />
          </label>
          <label className="field">
            <span>רמה בהתחלה</span>
            <select
              value={String(component.props?.startLevel ?? 0)}
              onChange={(e) =>
                updateComponent(component.id, {
                  props: { startLevel: e.target.value === '1' ? 1 : 0 },
                })
              }
            >
              <option value="0">0 (עלייה ראשונה אחרי חצי מחזור)</option>
              <option value="1">1</option>
            </select>
          </label>
        </>
      )}

      {component.type === 'INPUT' && (
        <label className="field">
          <span>שינויים מתוזמנים (זמן:ערך)</span>
          <input
            type="text"
            dir="ltr"
            placeholder="לדוגמה 5:0 10:1"
            value={scheduleText}
            onChange={(e) => setScheduleText(e.target.value)}
            onBlur={commitSchedule}
            onKeyDown={(e) => e.key === 'Enter' && commitSchedule()}
          />
        </label>
      )}

      {probeNets.length > 0 && (
        <fieldset className="field probes">
          <legend>בדיאגרמת הזמנים</legend>
          {probeNets.map((p) => (
            <label key={p.net} className="check">
              <input
                type="checkbox"
                checked={inDiagram.has(p.net)}
                onChange={(e) => setProbe(circuit, p.net, e.target.checked)}
              />
              <bdi>{p.label}</bdi>
            </label>
          ))}
        </fieldset>
      )}

      <button type="button" className="danger" onClick={() => removeComponents([component.id])}>
        מחיקת הרכיב
      </button>
    </div>
  );
}
