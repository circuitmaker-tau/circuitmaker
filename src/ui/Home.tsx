import { EXAMPLES } from '../examples';
import { useCircuitStore } from '../store/circuitStore';
import { HazardDemo } from './HazardDemo';
import './home.css';
import { tr } from '../i18n/lang';
import { LangSwitch } from './LangSwitch';

interface HomeProps {
  onOpenEditor: () => void;
  onHelp: () => void;
}

/** A thin printed-circuit trace pattern behind the hero. Decorative only. */
function Traces() {
  return (
    <svg className="traces" viewBox="0 0 1200 600" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <g fill="none">
        <path d="M0 80 H220 L260 120 H520" />
        <path d="M0 520 H140 L180 480 H420 L460 440 H700" />
        <path d="M1200 60 H980 L940 100 H760" />
        <path d="M1200 300 H1060 L1020 340 H900 V420 L860 460 H640" />
        <path d="M1200 540 H900 L860 500 H780" />
        <path d="M60 0 V40 L100 80" />
        <path d="M1100 600 V560 L1060 520 H1000" />
      </g>
      <g>
        <circle cx="520" cy="120" r="5" />
        <circle cx="700" cy="440" r="5" />
        <circle cx="760" cy="100" r="5" />
        <circle cx="640" cy="460" r="5" />
        <circle cx="780" cy="500" r="5" />
        <circle cx="1000" cy="520" r="5" />
      </g>
    </svg>
  );
}

export function Home({ onOpenEditor, onHelp }: HomeProps) {
  const openExample = () => {
    useCircuitStore.getState().loadCircuit(EXAMPLES[0].circuit, EXAMPLES[0].lesson);
    onOpenEditor();
  };

  return (
    <div className="home">
      <header className="home-bar">
        <span className="brand">
          <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden>
            <rect
              x="4"
              y="4"
              width="14"
              height="14"
              rx="2"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
            />
            <path
              d="M8 4V1M14 4V1M8 21v-3M14 21v-3M4 8H1M4 14H1M21 8h-3M21 14h-3"
              stroke="currentColor"
              strokeWidth="1.6"
            />
          </svg>
          CircuitMaker
        </span>
        <nav className="home-links">
          <LangSwitch />
          <a href="#/expressions" className="quiet-link">
            {tr('ביטויים בוליאניים', 'Boolean expressions')}
          </a>
          <button type="button" className="quiet-link" onClick={onHelp}>
            {tr('מדריך', 'Guide')}
          </button>
          <a href="https://github.com/circuitmaker-tau/circuitmaker" className="quiet-link">
            {tr('קוד מקור', 'Source code')}
          </a>
        </nav>
      </header>

      <main>
        <section className="hero">
          <Traces />
          <div className="hero-text">
            <h1>{tr('השהיה של Tp אחד, וכבר יש ריצוד ביציאה', 'One Tp of delay, and the output already glitches')}</h1>
            <p className="lead">
              {tr(
                'בונים מעגל משערים, קובעים Tp לכל שער, ורואים את האות עובר בחוטים ואת דיאגרמת הזמנים נבנית. בדיוק כמו בשאלות הזמנים במבחן של מבוא לחומרה.',
                'Build a circuit from gates, give every gate its Tp, and watch the signal travel along the wires while the timing diagram is drawn. Just like the timing questions in the Introduction to Hardware exam.',
              )}
            </p>
            <div className="hero-actions">
              <button type="button" className="primary" onClick={onOpenEditor}>
                {tr('פתיחת העורך', 'Open the editor')}
              </button>
              <button type="button" className="secondary" onClick={openExample}>
                {tr('פתיחת הדוגמה הזו', 'Open this example')}
              </button>
            </div>
            <p className="building">
              {tr(
                `${EXAMPLES.length} מעגלים מוכנים מההרצאות ומהמבחנים, דיאגרמת זמנים וניתוח hazards.`,
                `${EXAMPLES.length} ready circuits from the lectures and the exams, a timing diagram and hazard analysis.`,
              )}{' '}
              <button type="button" className="inline-link" onClick={onHelp}>
                {tr('איך משתמשים', 'How to use it')}
              </button>
            </p>
          </div>
          <HazardDemo />
        </section>

        <section className="facts" aria-label={tr('מה יש באפליקציה', 'What the app does')}>
          <div className="fact">
            <h2>{tr('Tp לכל שער', 'A Tp for every gate')}</h2>
            <p>
              {tr(
                'השהיה עשרונית לכל רכיב, ואפשר לקבוע זמן עלייה וזמן ירידה בנפרד. עובדים בדיוק עם הנתונים שמופיעים בשאלה.',
                'A decimal delay for every component, with separate rise and fall times if needed. You work with exactly the numbers given in the question.',
              )}
            </p>
          </div>
          <div className="fact">
            <h2>{tr('hazard מוסבר על מפת קרנו', 'Hazards explained on a Karnaugh map')}</h2>
            <p>
              {tr(
                'מסמנים את שתי הקבוצות הסמוכות ואת המונח החסר, ואז מוסיפים אותו ורואים שהריצוד נעלם.',
                'The two adjacent groups and the missing term are marked; add the term and watch the glitch disappear.',
              )}
            </p>
          </div>
          <div className="fact">
            <h2>{tr('בדפדפן, בלי התקנה', 'In the browser, nothing to install')}</h2>
            <p>
              {tr(
                'המעגל נשמר אוטומטית במחשב שלך. לשמירה קבועה, או כדי להעביר מעגל לחבר, מייצאים קובץ JSON.',
                'The circuit is saved on your computer automatically. To keep it for good, or to give it to a friend, export a JSON file.',
              )}
            </p>
          </div>
        </section>
      </main>

      <footer className="home-foot">
        {tr(
          'פרויקט 26-1-203, אוניברסיטת תל אביב. קוד פתוח, רישיון MIT.',
          'Project 26-1-203, Tel Aviv University. Open source, MIT license.',
        )}
      </footer>
    </div>
  );
}
