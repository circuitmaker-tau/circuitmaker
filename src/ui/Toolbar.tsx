import { useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { EXAMPLES } from '../examples';
import { downloadCircuit, readCircuitFile } from '../persistence/persistence';
import type { SaveStatus } from '../persistence/persistence';
import { useCircuitStore } from '../store/circuitStore';
import { FromExpression } from './FromExpression';
import { ShareDialog } from './ShareDialog';

const STATUS_TEXT: Record<SaveStatus, string> = {
  idle: '',
  saving: 'שומר…',
  saved: 'נשמר בדפדפן',
  error: 'השמירה בדפדפן נכשלה. כדאי לייצא JSON',
};

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

  const onImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ''; // picking the same file again should still fire
    if (!file) return;
    const result = await readCircuitFile(file);
    if (!result.ok) {
      showMessage(`לא ניתן לטעון את ${file.name}: ${result.errors.join(' · ')}`);
      return;
    }
    loadCircuit(result.circuit);
    if (result.warnings.length > 0) {
      showMessage(`המעגל נטען. ${result.warnings.length} כניסות לא מחוברות (ערכן X).`);
    }
  };

  return (
    <header className="topbar">
      <h1>
        <button type="button" className="home-link" onClick={onHome} aria-label="דף הבית">
          CircuitMaker
        </button>
      </h1>
      <input
        className="circuit-name"
        aria-label="שם המעגל"
        value={name}
        onChange={(e) => renameCircuit(e.target.value)}
      />
      <span className="save-status" role="status" data-status={saveStatus}>
        {STATUS_TEXT[saveStatus]}
      </span>
      <div className="actions">
        <button
          type="button"
          className="icon"
          onClick={undo}
          disabled={!canUndo}
          aria-label="ביטול הפעולה האחרונה"
          title="ביטול (Ctrl+Z)"
        >
          ↶
        </button>
        <button
          type="button"
          className="icon"
          onClick={redo}
          disabled={!canRedo}
          aria-label="ביצוע מחדש"
          title="ביצוע מחדש (Ctrl+Shift+Z)"
        >
          ↷
        </button>
        <button type="button" onClick={newCircuit}>
          מעגל חדש
        </button>
        <button type="button" onClick={() => setFromExpression(true)} title="בניית מעגל מביטוי בוליאני או מרשימת מינטרמים">
          מעגל מביטוי
        </button>
        <select
          className="examples"
          aria-label="טעינת מעגל דוגמה"
          value=""
          onChange={(e) => {
            const ex = EXAMPLES.find((x) => x.id === e.target.value);
            if (ex) loadCircuit(ex.circuit, ex.lesson);
          }}
        >
          <option value="" disabled>
            דוגמאות מהקורס
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
          ייבוא JSON
        </button>
        <button type="button" onClick={() => downloadCircuit(useCircuitStore.getState().circuit)}>
          ייצוא JSON
        </button>
        <button type="button" onClick={() => setSharing(true)} title="קישור שפותח את המעגל הזה אצל מישהו אחר">
          שיתוף
        </button>
        <button type="button" onClick={onHelp} title="מדריך למשתמש">
          עזרה
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
    </header>
  );
}
