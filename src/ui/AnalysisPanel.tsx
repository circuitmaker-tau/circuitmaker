/**
 * Hazard analysis of one lamp (work plan, component D): the function, its
 * Karnaugh map with the terms of the circuit, the hazards found analytically
 * and by simulation, an explanation in Hebrew, a demo that plays the change
 * in the timing diagram, and the consensus term as a one-click fix.
 */
import { useMemo, useState } from 'react';
import { truthTable, unsupportedReason, variablesOf } from '../analysis/func';
import type { Cube } from '../analysis/func';
import { addConsensus } from '../analysis/fix';
import { fixedOthers, minterms, product, sum } from '../analysis/format';
import { analyse, pathsFrom, scanTransitions } from '../analysis/hazards';
import type { AnalyticHazard, SimulatedHazard } from '../analysis/hazards';
import type { Circuit } from '../model';
import { useAnalysisStore } from '../store/analysisStore';
import { useCircuitStore } from '../store/circuitStore';
import { structureSignature, useSimStore } from '../store/simStore';
import { useTimingStore } from '../store/timingStore';
import { KarnaughMap } from './KarnaughMap';
import type { MapGroup } from './KarnaughMap';

const TERM_COLORS = ['#4ea1ff', '#f2c94c', '#d4506e', '#a77bff', '#3fd0d0', '#ff9f43'];
const PATH_COLORS = ['#4ea1ff', '#f2c94c'];

const bitOf = (m: number, k: number, n: number) => ((m >> (n - 1 - k)) & 1) as 0 | 1;

function compute(circuit: Circuit, net: string) {
  const reason = unsupportedReason(circuit);
  if (reason) return { ok: false, reason } as const;
  const vars = variablesOf(circuit).map((v) => v.id);
  return {
    ok: true,
    vars,
    table: truthTable(circuit, net),
    analytic: analyse(circuit, net),
    simulated: scanTransitions(circuit, net),
  } as const;
}

export function AnalysisPanel() {
  const circuit = useCircuitStore((s) => s.circuit);
  const chosen = useAnalysisStore((s) => s.output);
  const { setOutput, setHighlight, clearHighlight } = useAnalysisStore.getState();
  const [selected, setSelected] = useState<string | null>(null);
  const unit = circuit.timeUnit === 'none' ? '' : ` ${circuit.timeUnit}`;
  const fmt = (ticks: number) => `${ticks / 10}${unit}`;

  const lamps = circuit.components
    .filter((c) => c.type === 'OUTPUT')
    .map((c) => {
      const w = circuit.wires.find((x) => x.to.component === c.id);
      return { id: c.id, net: w ? `${w.from.component}:${w.from.port}` : null };
    })
    .filter((l): l is { id: string; net: string } => l.net !== null);
  const lamp = lamps.find((l) => l.id === chosen) ?? lamps[0];

  const net = lamp?.net;
  const result = useMemo(() => (net ? compute(circuit, net) : null), [circuit, net]);

  if (!lamp) {
    return (
      <p className="hint analysis-empty">מחברים נורה ליציאה שרוצים לנתח, והניתוח יופיע כאן.</p>
    );
  }
  if (!result) return null;
  if (!result.ok) return <p className="hint analysis-empty">{result.reason}</p>;

  const { vars, table, analytic, simulated } = result;
  const n = vars.length;
  const sop = analytic?.structure.form !== 'pos';
  const termText = (c: Cube) => (sop ? product(vars, c) : `(${sum(vars, c)})`);
  const ones = table.flatMap((v, m) => (v === 1 ? [m] : []));

  // the selected hazard drives the map marks and the dashed consensus
  const selectedAnalytic = analytic?.hazards.find((h) => key(h) === selected);
  const groups: MapGroup[] =
    analytic?.structure.terms.map((t, i) => ({
      cube: sop ? t.cube : zeros(t.cube),
      color: TERM_COLORS[i % TERM_COLORS.length],
    })) ?? [];
  if (selectedAnalytic) {
    groups.push({
      cube: sop ? selectedAnalytic.consensus : zeros(selectedAnalytic.consensus),
      color: '#ffffff',
      dashed: true,
    });
  }

  /** Put the switches at `from`, then flip one of them at t = 1 and play it in the timing diagram. */
  const demo = (from: number, k: number) => {
    const { updateComponent } = useCircuitStore.getState();
    clearHighlight();
    useSimStore
      .getState()
      .prepareDemo({ net: `${vars[k]}:out`, value: bitOf(from, k, n) ? 0 : 1, at: 10 });
    const before = structureSignature(useCircuitStore.getState().circuit);
    for (let i = 0; i < n; i++) {
      updateComponent(vars[i], { props: { value: bitOf(from, i, n), schedule: undefined } });
    }
    // removing a planned change alters the structure, and the editor then resets by itself
    const after = useCircuitStore.getState().circuit;
    if (structureSignature(after) === before) useSimStore.getState().reset(after);
    useTimingStore.getState().setTab('timing');
  };

  /** Start the demo from the side of the pair where the simulation sees the glitch, if it does. */
  const demoStart = (h: AnalyticHazard) =>
    simulated.find((x) => x.variable === h.variable && h.minterms.includes(x.from))?.from ??
    h.minterms[0];

  const fix = (h: AnalyticHazard) => {
    const r = addConsensus(circuit, analytic!.structure, h.consensus);
    const store = useCircuitStore.getState();
    if (!r.ok) store.showMessage(r.error);
    else {
      store.replaceCircuit(r.circuit);
      store.showMessage(
        `נוסף המונח ${termText(h.consensus)}. אפשר להריץ את ההדגמה שוב ולראות שהריצוד נעלם.`,
      );
      setSelected(null);
    }
  };

  /** Colour the two paths that race: the fastest and the slowest from the switch to the output. */
  const showPaths = (h: SimulatedHazard) => {
    const paths = pathsFrom(circuit, vars[h.variable], lamp.net);
    if (paths.length < 2) return clearHighlight();
    const pair = [paths[0], paths[paths.length - 1]];
    const map = new Map<string, number>();
    pair.forEach((p, i) => {
      const chain = [vars[h.variable], ...p.through];
      chain.forEach((id, j) => {
        if (j > 0) map.set(id, map.has(id) ? map.get(id)! : i);
        const next = chain[j + 1];
        const w = circuit.wires.find((x) => x.from.component === id && x.to.component === next);
        if (w) map.set(w.id, i);
      });
    });
    setHighlight(map);
  };

  const pathText = (h: SimulatedHazard) => {
    const paths = pathsFrom(circuit, vars[h.variable], lamp.net);
    if (paths.length < 2) return null;
    const [fast, slow] = [paths[0], paths[paths.length - 1]];
    const show = (p: typeof fast) =>
      `${[vars[h.variable], ...p.through].join(' → ')} (${fmt(p.delay)}${p.inversions % 2 ? ', עם היפוך' : ''})`;
    return (
      <span className="paths" dir="ltr">
        <span style={{ color: PATH_COLORS[0] }}>{show(fast)}</span>
        {' · '}
        <span style={{ color: PATH_COLORS[1] }}>{show(slow)}</span>
      </span>
    );
  };

  return (
    <div className="analysis" dir="rtl">
      <div className="analysis-side">
        <label className="analysis-output">
          יציאה
          <select value={lamp.id} onChange={(e) => setOutput(e.target.value)}>
            {lamps.map((l) => (
              <option key={l.id} value={l.id}>
                {l.id}
              </option>
            ))}
          </select>
        </label>
        <p className="analysis-func" dir="ltr">
          {lamp.id} = {minterms(ones)}
        </p>
        {analytic && (
          <p className="analysis-func" dir="ltr">
            {lamp.id} ={' '}
            {analytic.structure.terms.map((t, i) => (
              <span key={i}>
                {i > 0 && (sop ? ' + ' : '')}
                <span style={{ color: TERM_COLORS[i % TERM_COLORS.length] }}>
                  {termText(t.cube)}
                </span>
              </span>
            ))}
          </p>
        )}
        {n >= 2 && n <= 4 && (
          <KarnaughMap
            vars={vars}
            values={table}
            groups={groups}
            marked={selectedAnalytic ? [...selectedAnalytic.minterms] : []}
          />
        )}
        {!analytic && (
          <p className="hint">
            המעגל אינו סכום מכפלות או מכפלת סכומים, ולכן אין ניתוח לפי מפת קרנו. הסימולציה בודקת
            אותו בכל זאת.
          </p>
        )}
      </div>

      <div className="analysis-findings">
        {analytic && (
          <section>
            <h3>לפי המבנה ({sop ? 'סכום מכפלות' : 'מכפלת סכומים'})</h3>
            {analytic.hazards.length === 0 && (
              <p className="ok">אין hazard סטטי: כל שני מינטרמים סמוכים מכוסים במונח אחד משותף.</p>
            )}
            {analytic.hazards.map((h) => {
              const [a, b] = h.terms.map((i) => termText(analytic.structure.terms[i].cube));
              return (
                <article
                  key={key(h)}
                  className={`finding${selected === key(h) ? ' is-selected' : ''}`}
                  onMouseEnter={() => setSelected(key(h))}
                  onFocus={() => setSelected(key(h))}
                >
                  <p>
                    <b>{h.kind} hazard</b> כש-<bdi>{vars[h.variable]}</bdi> משתנה, כש-
                    <bdi>{fixedOthers(vars, h.minterms[0], h.variable)}</bdi> (מינטרמים{' '}
                    {h.minterms[0]} ו-
                    {h.minterms[1]}). כל אחד מהם מכוסה במונח אחר, <bdi>{a}</bdi> ו-<bdi>{b}</bdi>,
                    ואין מונח שמכסה את שניהם:{' '}
                    {sop
                      ? 'אחד נכבה לפני שהשני נדלק, והיציאה יורדת ל-0 לרגע'
                      : 'אחד עולה לפני שהשני יורד, והיציאה קופצת ל-1 לרגע'}
                    .
                  </p>
                  <p>
                    התיקון: מונח הקונצנזוס <bdi className="term">{termText(h.consensus)}</bdi>,
                    שמכסה את שניהם.
                  </p>
                  <div className="finding-actions">
                    <button type="button" onClick={() => demo(demoStart(h), h.variable)}>
                      הדגמה
                    </button>
                    <button type="button" onClick={() => fix(h)}>
                      הוספת המונח {termText(h.consensus)}
                    </button>
                  </div>
                </article>
              );
            })}
          </section>
        )}

        <section>
          <h3>בסימולציה, עם ה-Tp של המעגל</h3>
          {simulated.length === 0 && (
            <p className="ok">
              אף שינוי של כניסה אחת לא גורם ליציאה לזוז יותר מפעם אחת.{' '}
              {analytic?.hazards.length
                ? 'ה-hazard מהמבנה קיים, אבל ההשהיות הנוכחיות לא חושפות אותו.'
                : ''}
            </p>
          )}
          {simulated.map((h, i) => (
            <article
              key={i}
              className="finding"
              onMouseEnter={() => showPaths(h)}
              onMouseLeave={clearHighlight}
              onFocus={() => showPaths(h)}
            >
              <p>
                <b>{h.kind === 'dynamic' ? 'dynamic hazard' : `${h.kind} hazard`}</b>:{' '}
                <bdi>
                  {vars[h.variable]} {bitOf(h.from, h.variable, n)} → {bitOf(h.to, h.variable, n)}
                </bdi>{' '}
                כש-<bdi>{fixedOthers(vars, h.from, h.variable)}</bdi>.{' '}
                {h.kind === 'dynamic'
                  ? `היציאה משתנה ${h.transitions.length} פעמים במקום פעם אחת.`
                  : `היציאה צריכה להישאר ${table[h.from]}, אבל משתנה ${h.transitions.length} פעמים.`}
                {h.glitches.map((g, j) => (
                  <span key={j}>
                    {' '}
                    ריצוד ברוחב {fmt(g.end - g.start)}, מ-t = {fmt(g.start)} אחרי השינוי.
                  </span>
                ))}
              </p>
              <p className="hint">הנתיבים שמתחרים: {pathText(h)}</p>
              <div className="finding-actions">
                <button type="button" onClick={() => demo(h.from, h.variable)}>
                  הדגמה
                </button>
              </div>
            </article>
          ))}
        </section>
      </div>
    </div>
  );
}

const key = (h: AnalyticHazard) => `${h.variable}:${h.minterms.join(',')}`;
const zeros = (c: Cube): Cube => new Map([...c].map(([k, v]) => [k, v === 1 ? 0 : 1]));
