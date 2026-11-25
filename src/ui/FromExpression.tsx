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
import { textDir, tr } from '../i18n/lang';

const EXAMPLES = [
  "F = X0X1 + X1'X2",
  "Z = (A' + B)(B' + C)",
  'F(A,B,C,D) = Σ(2,3,4,5,10,11,15) + d(14)',
  'f = AB ⊕ CD',
];

const MODES: { id: BuildMode; he: string; en: string }[] = [
  { id: 'written', he: 'כמו שכתבתי', en: 'As written' },
  { id: 'sop', he: 'סכום מכפלות מינימלי', en: 'Minimal sum of products' },
  { id: 'pos', he: 'מכפלת סכומים מינימלית', en: 'Minimal product of sums' },
  { id: 'canonical', he: 'סכום מינטרמים', en: 'Sum of minterms' },
];
const modeLabel = (m: (typeof MODES)[number]) => tr(m.he, m.en);

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
    const form = modeLabel(MODES.find((m) => m.id === effective)!);
    useCircuitStore
      .getState()
      .loadCircuit(
        circuit,
        tr(
          `נבנה מהביטוי ${text.trim()} (${form}). המתגים הם ${fn.vars.join(', ')}, ו-${circuit.components.find((c) => c.type === 'OUTPUT')!.id} היא הנורה. בלשונית ״טבלת אמת״ רואים את הפונקציה, ובלשונית ״ניתוח hazards״ את ה-hazards של המבנה שנבנה. Ctrl+Z מחזיר את המעגל הקודם.`,
          `Built from the expression ${text.trim()} (${form}). The switches are ${fn.vars.join(', ')}, and ${circuit.components.find((c) => c.type === 'OUTPUT')!.id} is the lamp. The "Truth table" tab shows the function, and "Hazard analysis" the hazards of the structure that was built. Ctrl+Z brings the previous circuit back.`,
        ),
      );
    onClose();
  };

  return (
    <dialog
      ref={dialog}
      className="from-expression"
      dir={textDir()}
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
        <h2 id="from-expression-title">{tr('מעגל מביטוי', 'Circuit from an expression')}</h2>
        <label className="field">
          <span>{tr('הפונקציה', 'The function')}</span>
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
          {tr(
            "כמו בקורס: X1' הוא NOT, AB הוא AND, + הוא OR, ⊕ או ^ הוא XOR, ואפשר סוגריים. או רשימת מינטרמים: Σ(3,4,5,7) + d(…), או מקסטרמים: Π(…).",
            "As in the course: X1' is NOT, AB is AND, + is OR, ⊕ or ^ is XOR, and brackets are fine. Or a list of minterms: Σ(3,4,5,7) + d(…), or maxterms: Π(…).",
          )}
        </p>
        <div className="from-examples">
          {EXAMPLES.map((ex) => (
            <button key={ex} type="button" dir="ltr" onClick={() => setText(ex)}>
              {ex}
            </button>
          ))}
        </div>

        <fieldset className="from-modes">
          <legend>{tr('איך לבנות', 'How to build')}</legend>
          {MODES.map((m) => (
            <label key={m.id} className="check">
              <input
                type="radio"
                name="mode"
                checked={effective === m.id}
                disabled={m.id === 'written' && fn !== null && !fn.expr}
                onChange={() => setMode(m.id)}
              />
              <span>{modeLabel(m)}</span>
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
            {tr('בניית המעגל', 'Build the circuit')}
          </button>
          <button type="button" onClick={onClose}>
            {tr('ביטול', 'Cancel')}
          </button>
        </div>
      </form>
    </dialog>
  );
}
