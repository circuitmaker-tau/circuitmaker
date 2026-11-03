import { useEffect, useState } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { useAutosave } from './persistence/useAutosave';
import { Editor } from './ui/Editor';
import { Home } from './ui/Home';
import { Toolbar } from './ui/Toolbar';

type View = 'home' | 'editor';

/** Hash routes (#/ and #/editor) work on GitHub Pages without any server rewrite. */
const viewFromHash = (): View => (window.location.hash.startsWith('#/editor') ? 'editor' : 'home');

export default function App() {
  useAutosave();
  const [view, setView] = useState<View>(viewFromHash);

  useEffect(() => {
    const onHash = () => setView(viewFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const go = (next: View) => {
    window.location.hash = next === 'editor' ? '#/editor' : '#/';
  };

  if (view === 'home') return <Home onOpenEditor={() => go('editor')} />;

  return (
    <div className="app">
      <Toolbar onHome={() => go('home')} />
      <ReactFlowProvider>
        <Editor />
      </ReactFlowProvider>
      <footer className="footer">
        המעגל נשמר אוטומטית בדפדפן הזה. לשמירה קבועה או להעברה למחשב אחר: ייצוא JSON.{' '}
        <a href="https://github.com/circuitmaker-tau/circuitmaker">קוד מקור</a>
      </footer>
    </div>
  );
}
