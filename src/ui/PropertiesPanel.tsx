import { useState } from 'react';
import {
  CATALOG,
  expansionSummary,
  formatSchedule,
  hasAsyncOption,
  hasEdgeOption,
  hasEnableOption,
  hasEnablePolarity,
  outputsOfComponent,
  parseSchedule,
} from '../model';
import type { Component } from '../model';
import { useCircuitStore } from '../store/circuitStore';
import { useTimingStore } from '../store/timingStore';
import { splitLesson } from './lessonText';
import { tr } from '../i18n/lang';
import { labelOf } from '../i18n/components';

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
    <aside className="properties" aria-label={tr('מאפייני רכיב', 'Component properties')}>
      <h2>{tr('מאפיינים', 'Properties')}</h2>
      {selection.length > 1 ? (
        <div className="fields">
          <p className="field-title">
            {tr(`נבחרו ${selection.length} רכיבים`, `${selection.length} components selected`)}
          </p>
          <p className="hint">
            {tr(
              'גוררים את כולם יחד, או משכפלים ומוחקים. Ctrl+C ו-Ctrl+V מעתיקים ומדביקים, גם עם החוטים שביניהם.',
              'Drag them all together, or duplicate and delete. Ctrl+C and Ctrl+V copy and paste, with the wires between them.',
            )}
          </p>
          <button type="button" onClick={() => onDuplicate?.(selection)}>
            {tr('שכפול', 'Duplicate')}
          </button>
          <SaveAsBlock selection={selection} />
          <button
            type="button"
            className="danger"
            onClick={() => useCircuitStore.getState().removeComponents(selection)}
          >
            {tr(`מחיקת ${selection.length} הרכיבים`, `Delete the ${selection.length} components`)}
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
          <p className="hint">
            {tr('בחרו רכיב כדי לערוך את השם, ה-Tp ומספר הכניסות.', 'Select a component to edit its name, Tp and number of inputs.')}
          </p>
          {lesson && (
            <section className="lesson" aria-label={tr('מה לומדים מהדוגמה', 'What the example teaches')}>
              <h3>{tr('מה לומדים כאן', 'What to learn here')}</h3>
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
  const blocks = useCircuitStore((s) => s.circuit.blocks);
  const own = component.type === 'BLOCK' ? blocks?.find((b) => b.name === component.props?.block) : undefined;
  const inside = own
    ? tr(
        `${own.name}: ${own.components.filter((c) => c.type !== 'INPUT' && c.type !== 'OUTPUT').length} רכיבים, עם הכניסות ${own.inputs.join(', ')} והיציאות ${own.outputs.join(', ')}. לכל רכיב בפנים ה-Tp שלו.`,
        `${own.name}: ${own.components.filter((c) => c.type !== 'INPUT' && c.type !== 'OUTPUT').length} components, with the inputs ${own.inputs.join(', ')} and the outputs ${own.outputs.join(', ')}. Every part inside has its own Tp.`,
      )
    : expansionSummary(component);
  const timeUnit = useCircuitStore((s) => s.circuit.timeUnit);
  const [delayText, setDelayText] = useState(String(component.delay));
  const [halfText, setHalfText] = useState(String(component.props?.halfPeriod ?? 1));
  const [scheduleText, setScheduleText] = useState(formatSchedule(component.props?.schedule));
  const circuit = useCircuitStore((s) => s.circuit);
  useTimingStore((s) => s.probes); // re-render when the diagram's nets change
  const { shown, setProbe } = useTimingStore.getState();
  const showMessage = useCircuitStore((s) => s.showMessage);
  const def = CATALOG[component.type];
  // a block of the student's own takes as long as the gates inside it
  const hasDelay = def.category !== 'io' && component.type !== 'BLOCK';

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
        : outputsOfComponent(component).map((p) => ({
            net: `${component.id}:${p}`,
            label: outputsOfComponent(component).length > 1 ? p : component.id,
          }));
  const inDiagram = new Set(shown(circuit));

  // decision 8: flip-flops start at 0, latches at X, unless set here
  const isLatch = component.type === 'SR_LATCH' || component.type === 'D_LATCH';
  const init = component.props?.init ?? (isLatch ? 'X' : 0);
  const multiBit = component.type === 'REGISTER4' || component.type === 'COUNTER4';

  return (
    <div className="fields">
      <p className="field-title">{labelOf(component.type)}</p>

      <label className="field">
        <span>{tr('שם', 'Name')}</span>
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
          <span>{tr('מספר כניסות', 'Number of inputs')}</span>
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
          <span>
            {multiBit ? tr('ערך התחלתי (כל הביטים)', 'Initial value (all bits)') : tr('ערך התחלתי של Q', 'Initial value of Q')}
          </span>
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
            <option value="X">{tr('X (לא ידוע)', 'X (unknown)')}</option>
          </select>
        </label>
      )}

      {hasEnableOption(component.type) && (
        <label className="check field">
          <input
            type="checkbox"
            checked={component.props?.enable === true}
            onChange={(e) =>
              updateComponent(component.id, {
                props: { enable: e.target.checked, ...(e.target.checked ? {} : { enableLow: false }) },
              })
            }
          />
          <span>
            {tr('כניסת Enable', 'Enable input')} (<bdi>En</bdi>):{' '}
            {component.type.startsWith('MUX')
              ? tr('כשהיא כבויה, f = 0', 'when it is off, f = 0')
              : tr('כשהיא כבויה, הערך נשמר', 'when it is off, the value is kept')}
          </span>
        </label>
      )}

      {hasEnablePolarity(component) && (
        <label className="field">
          <span>
            <bdi>En</bdi> {tr('פעיל ב-', 'is active at')}
          </span>
          <select
            value={component.props?.enableLow ? 'low' : 'high'}
            onChange={(e) => updateComponent(component.id, { props: { enableLow: e.target.value === 'low' } })}
          >
            <option value="high">{tr('1 (רגיל)', '1 (normal)')}</option>
            <option value="low">{tr('0 (עיגול על En)', '0 (bubble on En)')}</option>
          </select>
        </label>
      )}

      {hasEdgeOption(component.type) && (
        <label className="field">
          <span>{tr('מגיב לשעון ב-', 'Triggers on the')}</span>
          <select
            value={component.props?.fallingEdge ? 'falling' : 'rising'}
            onChange={(e) =>
              updateComponent(component.id, { props: { fallingEdge: e.target.value === 'falling' } })
            }
          >
            <option value="rising">{tr('עליית שעון (0 → 1)', 'rising edge (0 → 1)')}</option>
            <option value="falling">{tr('ירידת שעון (1 → 0), עיגול על CLK', 'falling edge (1 → 0), bubble on CLK')}</option>
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
            {tr('כניסות אסינכרוניות', 'Asynchronous inputs')} <bdi>CLR&apos;</bdi> {tr('ו-', 'and ')}
            <bdi>PRE&apos;</bdi> {tr('(פעילות ב-0)', '(active low)')}
          </span>
        </label>
      )}

      {component.type === 'CLOCK' && (
        <>
          <label className="field">
            <span>
              {tr('חצי מחזור', 'Half period')} {timeUnit !== 'none' && `(${timeUnit})`}
            </span>
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
            <span>{tr('רמה בהתחלה', 'Level at the start')}</span>
            <select
              value={String(component.props?.startLevel ?? 0)}
              onChange={(e) =>
                updateComponent(component.id, {
                  props: { startLevel: e.target.value === '1' ? 1 : 0 },
                })
              }
            >
              <option value="0">{tr('0 (עלייה ראשונה אחרי חצי מחזור)', '0 (first rise after half a period)')}</option>
              <option value="1">1</option>
            </select>
          </label>
        </>
      )}

      {component.type === 'INPUT' && (
        <label className="field">
          <span>{tr('שינויים מתוזמנים (זמן:ערך)', 'Scheduled changes (time:value)')}</span>
          <input
            type="text"
            dir="ltr"
            placeholder={tr('לדוגמה 5:0 10:1', 'e.g. 5:0 10:1')}
            value={scheduleText}
            onChange={(e) => setScheduleText(e.target.value)}
            onBlur={commitSchedule}
            onKeyDown={(e) => e.key === 'Enter' && commitSchedule()}
          />
        </label>
      )}

      {probeNets.length > 0 && (
        <fieldset className="field probes">
          <legend>{tr('בדיאגרמת הזמנים', 'In the timing diagram')}</legend>
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
          <p className="field-title">{tr('מה יש בפנים', "What's inside")}</p>
          <p className="hint">{inside}</p>
          <button
            type="button"
            onClick={() => {
              const parts = useCircuitStore.getState().expand(component.id);
              if (parts.length > 0) onSelect?.(parts);
            }}
            title={tr('מחליף את הרכיב ברכיבים שהוא בנוי מהם, עם אותם חיבורים', 'Replaces the component by the parts it is built from, with the same connections')}
          >
            {tr('פירוק לרכיבים', 'Take apart')}
          </button>
        </div>
      )}

      <button type="button" onClick={() => onDuplicate?.([component.id])}>
        {tr('שכפול', 'Duplicate')}
      </button>
      <button type="button" className="danger" onClick={() => removeComponents([component.id])}>
        {tr('מחיקת הרכיב', 'Delete the component')}
      </button>
    </div>
  );
}

/** Save the selection as a block of the student's own: its switches become inputs, its lamps outputs. */
function SaveAsBlock({ selection }: { selection: string[] }) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const save = () => {
    const problem = useCircuitStore.getState().saveBlock(selection, name);
    setError(problem);
    if (!problem) setName('');
  };
  return (
    <div className="field expand-field">
      <p className="field-title">{tr('שמירה כבלוק', 'Save as block')}</p>
      <p className="hint">
        {tr(
          'המתגים שבבחירה יהיו הכניסות של הבלוק והנורות יהיו היציאות שלו, לפי הסדר מלמעלה למטה.',
          'The selected switches become the inputs of the block and the lamps its outputs, from top to bottom.',
        )}
      </p>
      <label className="field">
        <span>{tr('שם הבלוק', 'Block name')}</span>
        <input
          type="text"
          value={name}
          placeholder={tr('למשל MUX2', 'e.g. MUX2')}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && save()}
        />
      </label>
      {error && <p className="field-error">{error}</p>}
      <button type="button" onClick={save}>
        {tr('שמירה כבלוק', 'Save as block')}
      </button>
    </div>
  );
}
