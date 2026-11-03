import { evalGate, type GateType, type Logic } from './engine/logic';

const values: Logic[] = [0, 1, 'X'];
const gates: GateType[] = ['AND', 'OR', 'XOR'];

/**
 * Placeholder home page for milestone 3. It shows that the engine module is
 * wired into the UI by rendering three-valued truth tables computed live.
 */
export default function App() {
  return (
    <main className="page">
      <header>
        <h1>CircuitMaker</h1>
        <p className="subtitle">הדמיה אינטראקטיבית של מעגלים ספרתיים · בבנייה</p>
      </header>

      <section aria-labelledby="tables-title">
        <h2 id="tables-title">בדיקת מנוע: טבלאות אמת עם X</h2>
        <div className="tables">
          {gates.map((g) => (
            <table key={g} dir="ltr">
              <caption>{g}</caption>
              <thead>
                <tr>
                  <th>a \ b</th>
                  {values.map((b) => (
                    <th key={String(b)}>{b}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {values.map((a) => (
                  <tr key={String(a)}>
                    <th>{a}</th>
                    {values.map((b) => (
                      <td key={String(b)}>{evalGate(g, [a, b])}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          ))}
        </div>
      </section>

      <footer>
        פרויקט 26-1-203 · אוניברסיטת תל אביב ·{' '}
        <a href="https://github.com/circuitmaker-tau/circuitmaker">קוד מקור</a>
      </footer>
    </main>
  );
}
