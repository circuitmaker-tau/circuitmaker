import { useEffect, useState } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { tr } from './i18n/lang';
import { useLang } from './i18n/useLang';
import { useAutosave } from './persistence/useAutosave';
import { Editor } from './ui/Editor';
import { FsmWorld } from './ui/FsmWorld';
import { ExpressionsWorld } from './ui/ExpressionsWorld';
import { KarnaughWorld } from './ui/KarnaughWorld';
import { RomWorld } from './ui/RomWorld';
import { useFirstVisitTour, useTourStore } from './store/tourStore';
import { Help } from './ui/Help';
import { Home } from './ui/Home';
import { Toolbar } from './ui/Toolbar';
import { Tour } from './ui/Tour';
import { WorldNav } from './ui/WorldNav';

type View = 'home' | 'editor' | 'expressions' | 'karnaugh' | 'fsm' | 'rom' | 'help';

/** Hash routes (#/, #/editor, #/expressions, #/karnaugh, #/fsm, #/rom, #/help) work on GitHub Pages without any server rewrite. */
const viewFromHash = (): View => {
  const h = window.location.hash;
  if (h.startsWith('#/editor')) return 'editor';
  if (h.startsWith('#/expressions')) return 'expressions';
  if (h.startsWith('#/karnaugh')) return 'karnaugh';
  if (h.startsWith('#/fsm')) return 'fsm';
  if (h.startsWith('#/rom')) return 'rom';
  if (h.startsWith('#/help')) return 'help';
  return 'home';
};

export default function App() {
  useAutosave();
  const lang = useLang();
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'en' ? 'ltr' : 'rtl';
  }, [lang]);
  // a new language draws everything again, so every tr() reads it
  return <Views key={lang} />;
}

function Views() {
  const [view, setView] = useState<View>(viewFromHash);

  useEffect(() => {
    const onHash = () => setView(viewFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const go = (next: View) => {
    window.location.hash = next === 'home' ? '#/' : `#/${next}`;
    window.scrollTo(0, 0);
  };

  if (view === 'home') {
    return <Home onOpenEditor={() => go('editor')} onHelp={() => go('help')} />;
  }
  if (view === 'help') {
    return (
      <Help
        onHome={() => go('home')}
        onOpenEditor={() => go('editor')}
        onStartTour={() => {
          go('editor');
          useTourStore.getState().start();
        }}
      />
    );
  }
  if (view === 'rom') {
    return <RomWorld onHome={() => go('home')} onHelp={() => go('help')} />;
  }
  if (view === 'fsm') {
    return <FsmWorld onHome={() => go('home')} onHelp={() => go('help')} />;
  }
  if (view === 'karnaugh') {
    return <KarnaughWorld onHome={() => go('home')} onHelp={() => go('help')} />;
  }
  if (view === 'expressions') {
    return <ExpressionsWorld onHome={() => go('home')} onHelp={() => go('help')} />;
  }
  return <EditorView onHome={() => go('home')} onHelp={() => go('help')} />;
}

function EditorView({ onHome, onHelp }: { onHome: () => void; onHelp: () => void }) {
  useFirstVisitTour();

  return (
    <div className="app">
      <Toolbar onHome={onHome} onHelp={onHelp} />
      <WorldNav current="editor" />
      <ReactFlowProvider>
        <Editor />
      </ReactFlowProvider>
      <footer className="footer">
        {tr(
          'המעגל נשמר אוטומטית בדפדפן הזה. לשמירה קבועה או להעברה למחשב אחר: ייצוא JSON.',
          'The circuit is saved in this browser automatically. To keep it for good or move it to another computer: Export JSON.',
        )}{' '}
        <a href="https://github.com/circuitmaker-tau/circuitmaker">{tr('קוד מקור', 'Source code')}</a>
      </footer>
      <Tour />
    </div>
  );
}
