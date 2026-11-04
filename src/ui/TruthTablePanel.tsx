/**
 * The truth table of the circuit (WK3–4): every combination of the switches,
 * the value of every lamp, and for each lamp its minterms and a minimal sum of
 * products and product of sums, to compare with the student's own map.
 * Clicking a row sets the switches to it, so the change plays on the canvas.
 */
import type { Circuit } from '../model';
import type { Logic } from '../engine/logic';
import { minterms, product, sum } from '../analysis/format';
import { truthTable, unsupportedReason, variablesOf } from '../analysis/func';
import { minimalPos, minimalSop } from '../analysis/minimize';
import type { Value } from '../analysis/minimize';
import { useCircuitStore } from '../store/circuitStore';
import { useSimStore } from '../store/simStore';

interface LampColumn {
  id: string;
  values: Logic[];
  sop: string | null;
  pos: string | null;
  ones: number[];
}

interface Table {
  vars: string[];
  lamps: LampColumn[];
}

const cache = new WeakMap<Circuit, Table | string>();

/** The table, or why there is none; worked out once per version of the circuit. */
function truthTableOf(circuit: Circuit): Table | string {
  const hit = cache.get(circuit);
  if (hit !== undefined) return hit;
  const result = compute(circuit);
  cache.set(circuit, result);
  return result;
}

function compute(circuit: Circuit): Table | string {
  const reason = unsupportedReason(circuit);
  if (reason) return reason.replace('הניתוח מיועד', 'טבלת אמת מיועדת');
  const vars = variablesOf(circuit).map((v) => v.id);
  const n = vars.length;
  const lamps = circuit.components.filter((c) => c.type === 'OUTPUT');
  if (lamps.length === 0) return 'מחברים נורה ליציאה, והטבלה תופיע כאן.';
  return {
    vars,
    lamps: lamps.map((lamp) => {
      const w = circuit.wires.find((x) => x.to.component === lamp.id);
      const values: Logic[] = w
        ? truthTable(circuit, `${w.from.component}:${w.from.port}`)
        : Array<Logic>(1 << n).fill('X');
      const defined = values.every((v) => v !== 'X');
      const table = values as Value[];
      const sop = minimalSop(table, n);
      const pos = minimalPos(table, n);
      const flip = (c: Map<number, 0 | 1>) =>
        new Map([...c].map(([k, v]) => [k, v === 0 ? 1 : 0] as [number, 0 | 1]));
      return {
        id: lamp.id,
        values,
        ones: values.flatMap((v, m) => (v === 1 ? [m] : [])),
        sop: defined ? (sop.length === 0 ? '0' : sop.map((c) => product(vars, c)).join(' + ')) : null,
        pos: defined
          ? pos.length === 0
            ? '1'
            : pos.map((c) => (c.size > 1 ? `(${sum(vars, flip(c))})` : sum(vars, flip(c)))).join('')
          : null,
      };
    }),
  };
}

export function TruthTablePanel() {
  const circuit = useCircuitStore((s) => s.circuit);
  const table = truthTableOf(circuit);
  if (typeof table === 'string') return <p className="hint analysis-empty">{table}</p>;

  const { vars, lamps } = table;
  const n = vars.length;
  const switches = variablesOf(circuit);
  const current = switches.reduce((m, s) => 2 * m + (s.props?.value === 1 ? 1 : 0), 0);
  const bit = (m: number, k: number) => (m >> (n - 1 - k)) & 1;

  /** Flip the switches that differ, all at once: the change plays like a real input change. */
  const goTo = (m: number) => {
    const { flip } = useSimStore.getState();
    switches.forEach((s, k) => {
      if ((s.props?.value === 1 ? 1 : 0) !== bit(m, k)) flip(s.id);
    });
  };

  return (
    <div className="truth" dir="rtl">
      <div className="truth-scroll">
        <table className="truth-table" dir="ltr">
          <thead>
            <tr>
              <th className="truth-m">m</th>
              {vars.map((v) => (
                <th key={v}>{v}</th>
              ))}
              {lamps.map((l) => (
                <th key={l.id} className="truth-out">
                  {l.id}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 1 << n }, (_, m) => (
              <tr
                key={m}
                className={m === current ? 'is-current' : undefined}
                onClick={() => goTo(m)}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    goTo(m);
                  }
                }}
                title="לחיצה מציבה את המתגים בשורה הזו"
              >
                <td className="truth-m">{m}</td>
                {vars.map((v, k) => (
                  <td key={v}>{bit(m, k)}</td>
                ))}
                {lamps.map((l) => (
                  <td key={l.id} className={`truth-out v-${l.values[m]}`}>
                    {l.values[m]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="truth-forms">
        {lamps.map((l) => (
          <section key={l.id}>
            <h3>
              <bdi>{l.id}</bdi>
            </h3>
            <p className="analysis-func" dir="ltr">
              {l.id}({vars.join(', ')}) = {minterms(l.ones)}
            </p>
            {l.sop !== null && l.pos !== null ? (
              <>
                <p className="truth-label">סכום מכפלות מינימלי</p>
                <p className="analysis-func" dir="ltr">
                  {l.id} = {l.sop}
                </p>
                <p className="truth-label">מכפלת סכומים מינימלית</p>
                <p className="analysis-func" dir="ltr">
                  {l.id} = {l.pos}
                </p>
              </>
            ) : (
              <p className="hint">
                בחלק מהשורות היציאה X (למשל כניסה לא מחוברת), ולכן אין לה ביטוי.
              </p>
            )}
          </section>
        ))}
        <p className="hint">
          הביטויים המינימליים הם מה שיוצא ממפת קרנו, לא בהכרח מה שבנוי במעגל. ה-hazards תלויים במעגל
          עצמו, וזה מה שלשונית הניתוח בודקת.
        </p>
      </div>
    </div>
  );
}
