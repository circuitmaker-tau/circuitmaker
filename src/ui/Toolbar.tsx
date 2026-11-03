import { useRef } from 'react';
import type { ChangeEvent } from 'react';
import { EXAMPLES } from '../examples';
import { downloadCircuit, readCircuitFile } from '../persistence/persistence';
import type { SaveStatus } from '../persistence/persistence';
import { useCircuitStore } from '../store/circuitStore';

const STATUS_TEXT: Record<SaveStatus, string> = {
  idle: '',
  saving: 'שומר…',
  saved: 'נשמר בדפדפן',
  error: 'השמירה בדפדפן נכשלה. כדאי לייצא JSON',
};

interface ToolbarProps {
  onHome: () => void;
}

export function Toolbar({ onHome }: ToolbarProps) {
  const name = useCircuitStore((s) => s.circuit.name);
  const saveStatus = useCircuitStore((s) => s.saveStatus);
  const { newCircuit, loadCircuit, renameCircuit, showMessage } = useCircuitStore.getState();
  const fileInput = useRef<HTMLInputElement>(null);

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
        <button type="button" onClick={newCircuit}>
          מעגל חדש
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
        <input
          ref={fileInput}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(e) => void onImport(e)}
        />
      </div>
    </header>
  );
}
