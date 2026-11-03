import { ReactFlowProvider } from '@xyflow/react';
import { mux2FromGates } from './examples/mux2FromGates';
import { useCircuitStore } from './store/circuitStore';
import { Editor } from './ui/Editor';

export default function App() {
  const name = useCircuitStore((s) => s.circuit.name);
  const { newCircuit, loadCircuit } = useCircuitStore.getState();

  return (
    <div className="app">
      <header className="topbar">
        <h1>CircuitMaker</h1>
        <span className="circuit-name">{name}</span>
        <div className="actions">
          <button type="button" onClick={newCircuit}>
            מעגל חדש
          </button>
          <button type="button" onClick={() => loadCircuit(mux2FromGates)}>
            דוגמה: MUX 2:1 משערים
          </button>
        </div>
      </header>
      <ReactFlowProvider>
        <Editor />
      </ReactFlowProvider>
      <footer className="footer">
        פרויקט 26-1-203 · אוניברסיטת תל אביב ·{' '}
        <a href="https://github.com/circuitmaker-tau/circuitmaker">קוד מקור</a> · הסימולציה תתווסף
        באבן דרך 4
      </footer>
    </div>
  );
}
