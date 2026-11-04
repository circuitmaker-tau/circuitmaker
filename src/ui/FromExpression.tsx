/**
 * "Circuit from an expression": type a function as in the course, see what
 * it means (minterms, minimal forms), and get a circuit that runs. The new
 * circuit replaces the current one, and undo brings the old one back.
 */
import { useEffect, useRef, useState } from 'react';
import { parseFunction } from '../analysis/expression';
import type { ParsedFunction } from '../analysis/expression';
import { minterms } from '../analysis/format';
import { circuitFromFunction, describe, formFor } from '../analysis/fromFunction';
import type { BuildMode } from '../analysis/fromFunction';
import { useCircuitStore } from '../store/circuitStore';

const EXAMPLES = [
  "F = X0X1 + X1'X2",
  "Z = (A' + B)(B' + C)",
  'F(A,B,C,D) = Σ(2,3,4,5,10,11,15) + d(14)',
  'f = AB ⊕ CD',
];

const MODES: { id: BuildMode; label: string }[] = [
  { id: 'written', label: 'כמו שכתבתי' },
  { id: 'sop', label: 'סכום מכפלות מינימלי' },
  { id: 'pos', label: 'מכפלת סכומים מינימלית' },
  { id: 'canonical', label: 'סכום מינטרמים' },
];

const ones = (fn: ParsedFunction) => fn.table.flatMap((v, m) => (v === 1 ? [m] : []));
const dontCares = (fn: ParsedFunction) => fn.table.flatMap((v, m) => (v === 'd' ? [m] : []));

export function FromExpression({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [text, setText] = useState(EXAMPLES[0]);
  const [mode, setMode] = useState<BuildMode>('written');

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const parsed = parseFunction(text);
  const fn = parsed.ok ? parsed.fn : null;
  // a list of minterms has no "as written" form
  const effective: BuildMode = fn && !fn.expr && mode === 'written' ? 'sop' : mode;

  const build = () => {
    if (!fn) return;
    const circuit = circuitFromFunction(fn, effective);
    const form = MODES.find((m) => m.id === effective)!.label;
    useCircuitStore
      .getState()
      .loadCircuit(
        circuit,
        `נבנה מהביטוי ${text.trim()} (${form}). המתגים הם ${fn.vars.join(', ')}, ו-${circuit.components.find((c) => c.type === 'OUTPUT')!.id} היא הנורה. בלשונית ״טבלת אמת״ רואים את הפונקציה, ובלשונית ״ניתוח hazards״ את ה-hazards של המבנה שנבנה. Ctrl+Z מחזיר את המעגל הקודם.`,
      );
    onClose();
  };

  return (
    <dialog
      ref={dialog}
      className="from-expression"
      dir="rtl"
      aria-labelledby="from-expression-title"
      onClose={onClose}
      onClick={(e) => e.target === dialog.current && onClose()}
    >
      <form
        method="dialog"
        onSubmit={(e) => {
          e.preventDefault();
          build();
        }}
      >
        <h2 id="from-expression-title">מעגל מביטוי</h2>
        <label className="field">
          <span>הפונקציה</span>
          <input
            type="text"
            dir="ltr"
            spellCheck={false}
            autoComplete="off"
            value={text}
            onChange={(e) => setText(e.target.value)}
            aria-describedby="from-expression-help"
          />
        </label>
        <p id="from-expression-help" className="hint">
          כמו בקורס: X1&apos; הוא NOT, AB הוא AND, + הוא OR, ⊕ או ^ הוא XOR, ואפשר סוגריים. או רשימת
          מינטרמים: Σ(3,4,5,7) + d(…), או מקסטרמים: Π(…).
        </p>
        <div className="from-examples">
          {EXAMPLES.map((ex) => (
            <button key={ex} type="button" dir="ltr" onClick={() => setText(ex)}>
              {ex}
            </button>
          ))}
        </div>

        <fieldset className="from-modes">
          <legend>איך לבנות</legend>
          {MODES.map((m) => (
            <label key={m.id} className="check">
              <input
                type="radio"
                name="mode"
                checked={effective === m.id}
                disabled={m.id === 'written' && fn !== null && !fn.expr}
                onChange={() => setMode(m.id)}
              />
              <span>{m.label}</span>
            </label>
          ))}
        </fieldset>

        <div className="from-preview" aria-live="polite">
          {fn ? (
            <>
              <p className="analysis-func" dir="ltr">
                {fn.name}({fn.vars.join(', ')}) = {minterms(ones(fn))}
                {dontCares(fn).length > 0 && ` + d(${dontCares(fn).join(', ')})`}
              </p>
              <p className="analysis-func" dir="ltr">
                {fn.name} = {describe(formFor(fn, effective))}
              </p>
            </>
          ) : (
            <p className="from-error">{!parsed.ok && parsed.error}</p>
          )}
        </div>

        <div className="from-actions">
          <button type="submit" className="primary" disabled={!fn}>
            בניית המעגל
          </button>
          <button type="button" onClick={onClose}>
            ביטול
          </button>
        </div>
      </form>
    </dialog>
  );
}
