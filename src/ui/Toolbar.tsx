import { useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { EXAMPLES } from '../examples';
import { downloadCircuit, readCircuitFile } from '../persistence/persistence';
import type { SaveStatus } from '../persistence/persistence';
import { useCircuitStore } from '../store/circuitStore';
import { FromExpression } from './FromExpression';
import { RequestDialog } from './RequestDialog';
import { ShareDialog } from './ShareDialog';
import { tr } from '../i18n/lang';

const statusText = (s: SaveStatus) =>
  ({
    idle: '',
    saving: tr('שומר…', 'Saving…'),
    saved: tr('נשמר בדפדפן', 'Saved in this browser'),
    error: tr('השמירה בדפדפן נכשלה. כדאי לייצא JSON', 'Saving in the browser failed. Export JSON to be safe'),
  })[s];

interface ToolbarProps {
  onHome: () => void;
  onHelp: () => void;
}

export function Toolbar({ onHome, onHelp }: ToolbarProps) {
  const name = useCircuitStore((s) => s.circuit.name);
  const saveStatus = useCircuitStore((s) => s.saveStatus);
  const canUndo = useCircuitStore((s) => s.past.length > 0);
  const canRedo = useCircuitStore((s) => s.future.length > 0);
  const { newCircuit, loadCircuit, renameCircuit, showMessage, undo, redo } =
    useCircuitStore.getState();
  const fileInput = useRef<HTMLInputElement>(null);
  const [fromExpression, setFromExpression] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [requesting, setRequesting] = useState(false);

  const onImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ''; // picking the same file again should still fire
    if (!file) return;
    const result = await readCircuitFile(file);
    if (!result.ok) {
      showMessage(tr(`לא ניתן לטעון את ${file.name}: ${result.errors.join(' · ')}`, `Cannot load ${file.name}: ${result.errors.join(' · ')}`));
      return;
    }
    loadCircuit(result.circuit);
    if (result.warnings.length > 0) {
      showMessage(
        tr(
          `המעגל נטען. ${result.warnings.length} כניסות לא מחוברות (ערכן X).`,
          `The circuit was loaded. ${result.warnings.length} inputs are not connected (their value is X).`,
        ),
      );
    }
  };

  return (
    <header className="topbar">
      <h1>
        <button type="button" className="home-link" onClick={onHome} aria-label={tr('דף הבית', 'Home page')}>
          CircuitMaker
        </button>
      </h1>
      <input
        className="circuit-name"
        aria-label={tr('שם המעגל', 'Circuit name')}
        value={name}
        onChange={(e) => renameCircuit(e.target.value)}
      />
      <span className="save-status" role="status" data-status={saveStatus}>
        {statusText(saveStatus)}
      </span>
      <div className="actions">
        <button
          type="button"
          className="icon"
          onClick={undo}
          disabled={!canUndo}
          aria-label={tr('ביטול הפעולה האחרונה', 'Undo the last action')}
          title={tr('ביטול (Ctrl+Z)', 'Undo (Ctrl+Z)')}
        >
          ↶
        </button>
        <button
          type="button"
          className="icon"
          onClick={redo}
          disabled={!canRedo}
          aria-label={tr('ביצוע מחדש', 'Redo')}
          title={tr('ביצוע מחדש (Ctrl+Shift+Z)', 'Redo (Ctrl+Shift+Z)')}
        >
          ↷
        </button>
        <button type="button" onClick={newCircuit}>
          {tr('מעגל חדש', 'New circuit')}
        </button>
        <button
          type="button"
          onClick={() => setFromExpression(true)}
          title={tr('בניית מעגל מביטוי בוליאני או מרשימת מינטרמים', 'Build a circuit from a Boolean expression or a list of minterms')}
        >
          {tr('מעגל מביטוי', 'From expression')}
        </button>
        <button
          type="button"
          onClick={() => setRequesting(true)}
          title={tr('בנה [מה] בעזרת [אילו רכיבים] עם [מגבלות]: מעגל לפי תבנית', 'Build [what] using [which parts] with [limits]: a circuit from a template')}
        >
          {tr('בקשת מעגל', 'Request a circuit')}
        </button>
        <select
          className="examples"
          aria-label={tr('טעינת מעגל דוגמה', 'Load an example circuit')}
          value=""
          onChange={(e) => {
            const ex = EXAMPLES.find((x) => x.id === e.target.value);
            if (ex) loadCircuit(ex.circuit, ex.lesson);
          }}
        >
          <option value="" disabled>
            {tr('דוגמאות מהקורס', 'Course examples')}
          </option>
          {[...new Set(EXAMPLES.map((x) => x.group))].map((group) => (
            <optgroup key={group} label={group}>
              {EXAMPLES.filter((x) => x.group === group).map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <button type="button" onClick={() => fileInput.current?.click()}>
          {tr('ייבוא JSON', 'Import JSON')}
        </button>
        <button type="button" onClick={() => downloadCircuit(useCircuitStore.getState().circuit)}>
          {tr('ייצוא JSON', 'Export JSON')}
        </button>
        <button
          type="button"
          onClick={() => setSharing(true)}
          title={tr('קישור שפותח את המעגל הזה אצל מישהו אחר', 'A link that opens this circuit for someone else')}
        >
          {tr('שיתוף', 'Share')}
        </button>
        <button type="button" onClick={onHelp} title={tr('מדריך למשתמש', 'User guide')}>
          {tr('עזרה', 'Help')}
        </button>
        <input
          ref={fileInput}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(e) => void onImport(e)}
        />
      </div>
      <FromExpression open={fromExpression} onClose={() => setFromExpression(false)} />
      <ShareDialog open={sharing} onClose={() => setSharing(false)} />
      <RequestDialog open={requesting} onClose={() => setRequesting(false)} />
    </header>
  );
}
