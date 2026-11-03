import { EXAMPLES } from '../examples';
import { useCircuitStore } from '../store/circuitStore';
import { HazardDemo } from './HazardDemo';
import './home.css';

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
          <button type="button" className="quiet-link" onClick={onHelp}>
            מדריך
          </button>
          <a href="https://github.com/circuitmaker-tau/circuitmaker" className="quiet-link">
            קוד מקור
          </a>
        </nav>
      </header>

      <main>
        <section className="hero">
          <Traces />
          <div className="hero-text">
            <h1>השהיה של Tp אחד, וכבר יש ריצוד ביציאה</h1>
            <p className="lead">
              בונים מעגל משערים, קובעים Tp לכל שער, ורואים את האות עובר בחוטים ואת דיאגרמת הזמנים
              נבנית. בדיוק כמו בשאלות הזמנים במבחן של מבוא לחומרה.
            </p>
            <div className="hero-actions">
              <button type="button" className="primary" onClick={onOpenEditor}>
                פתיחת העורך
              </button>
              <button type="button" className="secondary" onClick={openExample}>
                פתיחת הדוגמה הזו
              </button>
            </div>
            <p className="building">
              {EXAMPLES.length} מעגלים מוכנים מההרצאות ומהמבחנים, דיאגרמת זמנים וניתוח hazards.{' '}
              <button type="button" className="inline-link" onClick={onHelp}>
                איך משתמשים
              </button>
            </p>
          </div>
          <HazardDemo />
        </section>

        <section className="facts" aria-label="מה יש באפליקציה">
          <div className="fact">
            <h2>Tp לכל שער</h2>
            <p>
              השהיה עשרונית לכל רכיב, ואפשר לקבוע זמן עלייה וזמן ירידה בנפרד. עובדים בדיוק עם
              הנתונים שמופיעים בשאלה.
            </p>
          </div>
          <div className="fact">
            <h2>hazard מוסבר על מפת קרנו</h2>
            <p>
              מסמנים את שתי הקבוצות הסמוכות ואת המונח החסר, ואז מוסיפים אותו ורואים שהריצוד נעלם.
            </p>
          </div>
          <div className="fact">
            <h2>בדפדפן, בלי התקנה</h2>
            <p>
              המעגל נשמר אוטומטית במחשב שלך. לשמירה קבועה, או כדי להעביר מעגל לחבר, מייצאים קובץ
              JSON.
            </p>
          </div>
        </section>
      </main>

      <footer className="home-foot">
        פרויקט 26-1-203, אוניברסיטת תל אביב. קוד פתוח, רישיון MIT.
      </footer>
    </div>
  );
}
