/**
 * Hazard analysis of one lamp (work plan, component D): the function, its
 * Karnaugh map with the terms of the circuit, the hazards found analytically
 * and by simulation, an explanation in Hebrew, a demo that plays the change
 * in the timing diagram, and the consensus term as a one-click fix.
 */
import { useState } from 'react';
import type { Cube } from '../analysis/func';
import { addConsensus } from '../analysis/fix';
import { fixedOthers, minterms, product, sum } from '../analysis/format';
import type { AnalyticHazard } from '../analysis/hazards';
import { analysisReport } from '../analysis/report';
import { useAnalysisStore } from '../store/analysisStore';
import { useCircuitStore } from '../store/circuitStore';
import { structureSignature, useSimStore } from '../store/simStore';
import { useTimingStore } from '../store/timingStore';
import { KarnaughMap } from './KarnaughMap';
import type { MapGroup } from './KarnaughMap';
import { isEnglish, textDir, tr } from '../i18n/lang';

const TERM_COLORS = ['#4ea1ff', '#f2c94c', '#d4506e', '#a77bff', '#3fd0d0', '#ff9f43'];
const PATH_COLORS = ['#4ea1ff', '#f2c94c'];

const bitOf = (m: number, k: number, n: number) => ((m >> (n - 1 - k)) & 1) as 0 | 1;

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

  // cached per circuit and output, so re-renders do not redo the scan
  const result = lamp ? analysisReport(circuit, lamp.net) : null;

  if (!lamp) {
    return (
      <p className="hint analysis-empty">
        {tr('מחברים נורה ליציאה שרוצים לנתח, והניתוח יופיע כאן.', 'Connect a lamp to the output you want to analyse, and the analysis will show here.')}
      </p>
    );
  }
  if (!result) return null;
  if (!result.ok) return <p className="hint analysis-empty">{result.reason}</p>;

  const { vars, table, analytic, simulated, races } = result;
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
    // the current circuit from the store: this runs later, on a click
    const r = addConsensus(useCircuitStore.getState().circuit, analytic!.structure, h.consensus);
    const store = useCircuitStore.getState();
    if (!r.ok) store.showMessage(r.error);
    else {
      store.replaceCircuit(r.circuit);
      store.showMessage(
        tr(
          `נוסף המונח ${termText(h.consensus)}. אפשר להריץ את ההדגמה שוב ולראות שהריצוד נעלם.`,
          `The term ${termText(h.consensus)} was added. Run the demo again and see the glitch is gone.`,
        ),
      );
      setSelected(null);
    }
  };

  const pathText = (i: number) => {
    const race = races[i];
    if (!race) return null;
    const h = simulated[i];
    const show = (p: typeof race.fast) =>
      `${[vars[h.variable], ...p.through].join(' → ')} (${fmt(p.delay)}${p.inversions % 2 ? tr(', עם היפוך', ', inverted') : ''})`;
    return (
      <span className="paths" dir="ltr">
        <span style={{ color: PATH_COLORS[0] }}>{show(race.fast)}</span>
        {' · '}
        <span style={{ color: PATH_COLORS[1] }}>{show(race.slow)}</span>
      </span>
    );
  };
  const showPaths = (i: number) => {
    const race = races[i];
    if (race) setHighlight(race.highlight);
    else clearHighlight();
  };

  return (
    <div className="analysis" dir={textDir()}>
      <div className="analysis-side">
        <label className="analysis-output">
          {tr('יציאה', 'Output')}
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
            {tr(
              'המעגל אינו סכום מכפלות או מכפלת סכומים, ולכן אין ניתוח לפי מפת קרנו. הסימולציה בודקת אותו בכל זאת.',
              'The circuit is not a sum of products or a product of sums, so there is no Karnaugh map analysis. The simulation checks it all the same.',
            )}
          </p>
        )}
      </div>

      <div className="analysis-findings">
        {analytic && (
          <section>
            <h3>
              {tr('לפי המבנה', 'By the structure')} (
              {sop ? tr('סכום מכפלות', 'sum of products') : tr('מכפלת סכומים', 'product of sums')})
            </h3>
            {analytic.hazards.length === 0 && (
              <p className="ok">
                {tr(
                  'אין hazard סטטי: כל שני מינטרמים סמוכים מכוסים במונח אחד משותף.',
                  'No static hazard: every two adjacent minterms are covered by one shared term.',
                )}
              </p>
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
                  {isEnglish() ? (
                    <p>
                      <b>{h.kind} hazard</b> when <bdi>{vars[h.variable]}</bdi> changes with{' '}
                      <bdi>{fixedOthers(vars, h.minterms[0], h.variable)}</bdi> (minterms {h.minterms[0]} and{' '}
                      {h.minterms[1]}). Each is covered by a different term, <bdi>{a}</bdi> and <bdi>{b}</bdi>, and no
                      term covers both:{' '}
                      {sop
                        ? 'one turns off before the other turns on, and the output drops to 0 for a moment'
                        : 'one rises before the other falls, and the output jumps to 1 for a moment'}
                      .
                    </p>
                  ) : (
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
                  )}
                  <p>
                    {tr('התיקון: מונח הקונצנזוס', 'The fix: the consensus term')}{' '}
                    <bdi className="term">{termText(h.consensus)}</bdi>
                    {tr(', שמכסה את שניהם.', ', which covers both.')}
                  </p>
                  <div className="finding-actions">
                    <button type="button" onClick={() => demo(demoStart(h), h.variable)}>
                      {tr('הדגמה', 'Demo')}
                    </button>
                    <button type="button" onClick={() => fix(h)}>
                      {tr('הוספת המונח', 'Add the term')} {termText(h.consensus)}
                    </button>
                  </div>
                </article>
              );
            })}
          </section>
        )}

        <section>
          <h3>{tr('בסימולציה, עם ה-Tp של המעגל', "In simulation, with the circuit's Tp")}</h3>
          {simulated.length === 0 && (
            <p className="ok">
              {tr(
                'אף שינוי של כניסה אחת לא גורם ליציאה לזוז יותר מפעם אחת.',
                'No change of a single input makes the output move more than once.',
              )}{' '}
              {analytic?.hazards.length
                ? tr(
                    'ה-hazard מהמבנה קיים, אבל ההשהיות הנוכחיות לא חושפות אותו.',
                    'The hazard of the structure is there, but the present delays do not show it.',
                  )
                : ''}
            </p>
          )}
          {simulated.map((h, i) => (
            <article
              key={i}
              className="finding"
              onMouseEnter={() => showPaths(i)}
              onMouseLeave={clearHighlight}
              onFocus={() => showPaths(i)}
            >
              <p>
                <b>{h.kind === 'dynamic' ? 'dynamic hazard' : `${h.kind} hazard`}</b>:{' '}
                <bdi>
                  {vars[h.variable]} {bitOf(h.from, h.variable, n)} → {bitOf(h.to, h.variable, n)}
                </bdi>{' '}
                {tr('כש-', 'with ')}
                <bdi>{fixedOthers(vars, h.from, h.variable)}</bdi>.{' '}
                {h.kind === 'dynamic'
                  ? tr(
                      `היציאה משתנה ${h.transitions.length} פעמים במקום פעם אחת.`,
                      `The output changes ${h.transitions.length} times instead of once.`,
                    )
                  : tr(
                      `היציאה צריכה להישאר ${table[h.from]}, אבל משתנה ${h.transitions.length} פעמים.`,
                      `The output should stay ${table[h.from]}, but changes ${h.transitions.length} times.`,
                    )}
                {h.glitches.map((g, j) => (
                  <span key={j}>
                    {' '}
                    {tr(
                      `ריצוד ברוחב ${fmt(g.end - g.start)}, מ-t = ${fmt(g.start)} אחרי השינוי.`,
                      `A glitch ${fmt(g.end - g.start)} wide, from t = ${fmt(g.start)} after the change.`,
                    )}
                  </span>
                ))}
              </p>
              {races[i] && (
                <p className="hint">
                  {tr('הנתיבים שמתחרים:', 'The racing paths:')} {pathText(i)}
                </p>
              )}
              <div className="finding-actions">
                <button type="button" onClick={() => demo(h.from, h.variable)}>
                  {tr('הדגמה', 'Demo')}
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
