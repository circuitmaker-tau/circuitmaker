import { useState } from 'react';
import {
  CATALOG,
  expansionSummary,
  formatSchedule,
  hasAsyncOption,
  outputPortsOf,
  parseSchedule,
} from '../model';
import type { Component } from '../model';
import { useCircuitStore } from '../store/circuitStore';
import { useTimingStore } from '../store/timingStore';
import { splitLesson } from './lessonText';

interface PropertiesPanelProps {
  component: Component | null;
  /** Called after a rename, so the editor can keep the component selected. */
  onRenamed?: (from: string, to: string) => void;
  /** Every selected component (several with Shift or a box drag). */
  selection?: string[];
  onDuplicate?: (ids: string[]) => void;
  /** Select these components (the parts of a block that was taken apart). */
  onSelect?: (ids: string[]) => void;
}

export function PropertiesPanel({
  component,
  onRenamed,
  selection = [],
  onDuplicate,
  onSelect,
}: PropertiesPanelProps) {
  const lesson = useCircuitStore((s) => s.lesson);
  return (
    <aside className="properties" aria-label="מאפייני רכיב">
      <h2>מאפיינים</h2>
      {selection.length > 1 ? (
        <div className="fields">
          <p className="field-title">נבחרו {selection.length} רכיבים</p>
          <p className="hint">
            גוררים את כולם יחד, או משכפלים ומוחקים. Ctrl+C ו-Ctrl+V מעתיקים ומדביקים, גם עם
            החוטים שביניהם.
          </p>
          <button type="button" onClick={() => onDuplicate?.(selection)}>
            שכפול
          </button>
          <button
            type="button"
            className="danger"
            onClick={() => useCircuitStore.getState().removeComponents(selection)}
          >
            מחיקת {selection.length} הרכיבים
          </button>
        </div>
      ) : component ? (
        // key resets the draft value when another component is selected
        <ComponentFields
          key={component.id}
          component={component}
          onRenamed={onRenamed}
          onDuplicate={onDuplicate}
          onSelect={onSelect}
        />
      ) : (
        <>
          <p className="hint">בחרו רכיב כדי לערוך את השם, ה-Tp ומספר הכניסות.</p>
          {lesson && (
            <section className="lesson" aria-label="מה לומדים מהדוגמה">
              <h3>מה לומדים כאן</h3>
              <p>
                {splitLesson(lesson).map((piece, i) =>
                  piece.ltr ? (
                    <bdi key={i} dir="ltr">
                      {piece.text}
                    </bdi>
                  ) : (
                    piece.text
                  ),
                )}
              </p>
            </section>
          )}
        </>
      )}
    </aside>
  );
}

function ComponentFields({
  component,
  onRenamed,
  onDuplicate,
  onSelect,
}: {
  component: Component;
  onRenamed?: (from: string, to: string) => void;
  onDuplicate?: (ids: string[]) => void;
  onSelect?: (ids: string[]) => void;
}) {
  const updateComponent = useCircuitStore((s) => s.updateComponent);
  const [nameText, setNameText] = useState(component.id);
  const removeComponents = useCircuitStore((s) => s.removeComponents);
  const inside = expansionSummary(component);
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

  const commitName = () => {
    const from = component.id;
    const to = nameText.trim();
    if (to === from) return;
    if (useCircuitStore.getState().renameComponent(from, to)) onRenamed?.(from, to);
    else setNameText(from);
  };

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
      <p className="field-title">{def.label}</p>

      <label className="field">
        <span>שם</span>
        <input
          type="text"
          dir="ltr"
          maxLength={12}
          spellCheck={false}
          autoComplete="off"
          value={nameText}
          onChange={(e) => setNameText(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => e.key === 'Enter' && commitName()}
        />
      </label>

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

      {hasAsyncOption(component.type) && (
        <label className="check field">
          <input
            type="checkbox"
            checked={component.props?.async === true}
            onChange={(e) => updateComponent(component.id, { props: { async: e.target.checked } })}
          />
          <span>
            כניסות אסינכרוניות <bdi>CLR&apos;</bdi> ו-<bdi>PRE&apos;</bdi> (פעילות ב-0)
          </span>
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

      {inside && (
        <div className="field expand-field">
          <p className="field-title">מה יש בפנים</p>
          <p className="hint">{inside}</p>
          <button
            type="button"
            onClick={() => {
              const parts = useCircuitStore.getState().expand(component.id);
              if (parts.length > 0) onSelect?.(parts);
            }}
            title="מחליף את הרכיב ברכיבים שהוא בנוי מהם, עם אותם חיבורים"
          >
            פירוק לרכיבים
          </button>
        </div>
      )}

      <button type="button" onClick={() => onDuplicate?.([component.id])}>
        שכפול
      </button>
      <button type="button" className="danger" onClick={() => removeComponents([component.id])}>
        מחיקת הרכיב
      </button>
    </div>
  );
}
