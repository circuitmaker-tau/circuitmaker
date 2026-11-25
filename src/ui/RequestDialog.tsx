/**
 * "Request a circuit" (supervisor's review, 25.11): a sentence with blanks,
 * build [what] using [which components] with [fan-in at most k], filled from
 * lists, so there is nothing to misunderstand and no language model. The
 * circuit is built by the constructions of the course, checked by simulation,
 * and replaces the current one (Ctrl+Z brings it back).
 */
import { useEffect, useRef, useState } from 'react';
import { buildRequest, METHODS, nameOf, PRESETS, verifyRequest } from '../analysis/request';
import type { Method } from '../analysis/request';
import { readFunctions } from '../analysis/romPla';
import { useCircuitStore } from '../store/circuitStore';
import { textDir, tr } from '../i18n/lang';

const OWN = 'own';

export function RequestDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [what, setWhat] = useState(PRESETS[0].id);
  const [text, setText] = useState(PRESETS[0].text);
  const [method, setMethod] = useState<Method>('nand');
  const [fanIn, setFanIn] = useState(2);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const read = readFunctions(text);
  const result = read.ok ? buildRequest(read.set, method, fanIn) : null;
  const checked = read.ok && result?.ok ? verifyRequest(read.set, result.circuit) : false;
  const usesFanIn = METHODS.find((m) => m.id === method)!.fanIn;
  const whatLabel = what === OWN ? text.trim() : nameOf(PRESETS.find((p) => p.id === what)!);
  const methodLabel = nameOf(METHODS.find((m) => m.id === method)!);

  const build = () => {
    if (!read.ok || !result?.ok || !checked) return;
    useCircuitStore
      .getState()
      .loadCircuit(
        result.circuit,
        tr(
          `נבנה לפי הבקשה: ${whatLabel}, בעזרת ${methodLabel}${usesFanIn ? `, fan-in עד ${fanIn}` : ''}. ברכיבים: ${result.text}. נבדק בסימולציה בכל ${1 << read.set.vars.length} השורות. בלשונית ״טבלת אמת״ רואים את הפונקציות, ו-Ctrl+Z מחזיר את המעגל הקודם.`,
          `Built as requested: ${whatLabel}, using ${methodLabel}${usesFanIn ? `, fan-in at most ${fanIn}` : ''}. Parts: ${result.text}. Checked by simulation in all ${1 << read.set.vars.length} rows. The "Truth table" tab shows the functions, and Ctrl+Z brings the previous circuit back.`,
        ),
      );
    onClose();
  };

  return (
    <dialog
      ref={dialog}
      className="request-dialog"
      dir={textDir()}
      aria-labelledby="request-title"
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
        <h2 id="request-title">{tr('בקשת מעגל', 'Request a circuit')}</h2>
        <p className="hint">
          {tr(
            'ממלאים את המשפט, והמעגל נבנה בשיטות של הקורס ונבדק בסימולציה לפני שהוא נטען.',
            'Fill in the sentence, and the circuit is built by the methods of the course and checked by simulation before it loads.',
          )}
        </p>

        <div className="request-sentence">
          <label>
            <span>{tr('בנה', 'Build')}</span>
            <select
              value={what}
              onChange={(e) => {
                setWhat(e.target.value);
                const preset = PRESETS.find((p) => p.id === e.target.value);
                if (preset) setText(preset.text);
              }}
            >
              {PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {nameOf(p)}
                </option>
              ))}
              <option value={OWN}>{tr('פונקציה משלי', 'my own function')}</option>
            </select>
          </label>
          <label>
            <span>{tr('בעזרת', 'using')}</span>
            <select value={method} onChange={(e) => setMethod(e.target.value as Method)}>
              {METHODS.map((m) => (
                <option key={m.id} value={m.id}>
                  {nameOf(m)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>{tr('עם fan-in עד', 'with fan-in at most')}</span>
            <select value={fanIn} disabled={!usesFanIn} onChange={(e) => setFanIn(Number(e.target.value))}>
              {[2, 3, 4].map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="field">
          <span>
            {tr('מה בדיוק: ביטוי לכל יציאה, אחד בכל שורה או מופרדים ב-;', 'Exactly what: an expression for each output, one per line or separated by ;')}
          </span>
          <textarea
            dir="ltr"
            rows={2}
            spellCheck={false}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setWhat(OWN);
            }}
          />
        </label>

        <div className="request-preview" aria-live="polite">
          {!read.ok ? (
            <p className="request-error">{read.error}</p>
          ) : !result?.ok ? (
            <p className="request-error">{result?.error}</p>
          ) : (
            <>
              <p>
                {tr('ייבנה:', 'To be built:')} <bdi dir="ltr">{result.text}</bdi>. {tr('משתנים:', 'Variables:')}{' '}
                <bdi dir="ltr">{read.set.vars.join(', ')}</bdi>, {tr('יציאות:', 'outputs:')}{' '}
                <bdi dir="ltr">{read.set.fns.map((f) => f.name).join(', ')}</bdi>.
              </p>
              <p className={checked ? 'request-ok' : 'request-error'}>
                {checked
                  ? tr(
                      `נבדק בסימולציה: נכון בכל ${1 << read.set.vars.length} השורות.`,
                      `Checked by simulation: right in all ${1 << read.set.vars.length} rows.`,
                    )
                  : tr('הבדיקה בסימולציה נכשלה, ולכן המעגל לא ייטען.', 'The simulation check failed, so the circuit will not load.')}
              </p>
            </>
          )}
        </div>

        <div className="request-actions">
          <button type="submit" className="primary" disabled={!checked}>
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
