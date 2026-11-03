import { ReactFlowProvider } from '@xyflow/react';
import { useAutosave } from './persistence/useAutosave';
import { Editor } from './ui/Editor';
import { Toolbar } from './ui/Toolbar';

export default function App() {
  useAutosave();

  return (
    <div className="app">
      <Toolbar />
      <ReactFlowProvider>
        <Editor />
      </ReactFlowProvider>
      <footer className="footer">
        המעגל נשמר אוטומטית בדפדפן הזה. לשמירה קבועה או להעברה למחשב אחר: ייצוא JSON · פרויקט
        26-1-203 · אוניברסיטת תל אביב ·{' '}
        <a href="https://github.com/circuitmaker-tau/circuitmaker">קוד מקור</a>
      </footer>
    </div>
  );
}
