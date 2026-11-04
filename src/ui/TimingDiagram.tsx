/**
 * Timing diagram (work plan component C): the waveform of every chosen net,
 * drawn from the simulator's traces and kept in step with the playback.
 *
 * Time runs left to right, as in the course, even though the page is RTL.
 * A click puts a cursor and shows every value at that time; shift-click puts a
 * second cursor and shows the time between them. Glitches (pulses caused by a
 * single outside change, see engine/glitches.ts) are marked with their width.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { MouseEvent, WheelEvent } from 'react';
import { findGlitches } from '../engine/glitches';
import type { Glitch } from '../engine/glitches';
import type { Logic } from '../engine/logic';
import type { Transition } from '../engine/simulator';
import { useCircuitStore } from '../store/circuitStore';
import { useSimStore } from '../store/simStore';
import { allRows, useTimingStore } from '../store/timingStore';
import { AnalysisPanel } from './AnalysisPanel';
import { exportTimingImage } from './exportImage';
import { TruthTablePanel } from './TruthTablePanel';

const ROW_H = 30;
const HIGH = 7;
const LOW = 23;
const AXIS_H = 22;
const PAD = 12;
/** Shortest run shown when fitting, in units, so a short run is not stretched. */
const MIN_SPAN = 10;

/** Horizontal position of a tick. */
const xScale = (pxPerUnit: number) => (t: number) => PAD + (t / 10) * pxPerUnit;

const units = (ticks: number) => Math.round(ticks) / 10;
const fmt = (ticks: number) => String(units(ticks));

/** Value of a trace at a tick. */
function valueAt(trace: readonly Transition[], t: number): Logic {
  let v: Logic = trace[0]?.value ?? 'X';
  for (const x of trace) {
    if (x.time > t) break;
    v = x.value;
  }
  return v;
}

/** A round step for axis labels: 1, 2 or 5 × 10^k units, at least ~60 px apart. */
function axisStep(pxPerUnit: number): number {
  const target = 60 / pxPerUnit;
  const p = 10 ** Math.floor(Math.log10(target));
  return [1, 2, 5, 10].map((m) => m * p).find((s) => s >= target) ?? 10 * p;
}

/**
 * One colour per signal, as in the course's timing diagrams. Green and red are
 * left out on purpose: on the canvas they mean 1 and 0.
 */
const SIGNAL_COLORS = [
  '#4ea1ff', // blue
  '#f2c94c', // yellow
  '#d4506e', // bordeaux
  '#a77bff', // purple
  '#3fd0d0', // cyan
  '#ff9f43', // orange
  '#ff7ac6', // pink
  '#c8c8d0', // silver
];

interface Wave {
  /** The 0 and 1 levels and every edge between them, drawn in the signal's colour. */
  line: string;
  unknown: { x: number; w: number }[];
}

function buildWave(trace: readonly Transition[], end: number, x: (t: number) => number): Wave {
  let line = '';
  const unknown: { x: number; w: number }[] = [];
  trace.forEach((tr, i) => {
    const t1 = i + 1 < trace.length ? trace[i + 1].time : end;
    const x0 = x(tr.time);
    const x1 = x(Math.max(t1, tr.time));
    if (i > 0) line += `M${x0} ${HIGH}V${LOW}`; // the edge
    if (tr.value === 1) line += `M${x0} ${HIGH}H${x1}`;
    else if (tr.value === 0) line += `M${x0} ${LOW}H${x1}`;
    else unknown.push({ x: x0, w: x1 - x0 });
  });
  return { line, unknown };
}

export function TimingDiagram() {
  const circuit = useCircuitStore((s) => s.circuit);
  const sim = useSimStore((s) => s.sim);
  const version = useSimStore((s) => s.version);
  const { open, tab, height: panelHeight, zoom, cursor, cursorB, probes } = useTimingStore();
  const { setOpen, setTab, setHeight, setZoom, setCursor } = useTimingStore.getState();
  const timing = open && tab === 'timing';
  const drag = useRef<{ y: number; h: number } | null>(null);
  const unit = circuit.timeUnit === 'none' ? '' : ` ${circuit.timeUnit}`;

  const scroller = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el); // reports the first size too
    return () => ro.disconnect();
    // the scroller is a new element each time the diagram is shown again (closed, or back from the analysis tab)
  }, [timing]);

  // a signal keeps its colour when others are hidden: it comes from its place among all nets
  const rows = useMemo(() => {
    void probes;
    const shown = new Set(useTimingStore.getState().shown(circuit));
    return allRows(circuit)
      .map((r, i) => ({ ...r, color: SIGNAL_COLORS[i % SIGNAL_COLORS.length] }))
      .filter((r) => shown.has(r.net));
  }, [circuit, probes]);

  const now = sim?.now ?? 0;
  const spanTicks = Math.max(now, MIN_SPAN * 10);
  const fitZoom = (width - 2 * PAD) / (spanTicks / 10);
  const pxPerUnit = zoom ?? fitZoom;
  const x = xScale(pxPerUnit);
  const svgWidth = Math.max(width, x(spanTicks) + PAD);

  // keep the present moment in view while time runs
  useEffect(() => {
    const el = scroller.current;
    if (!el || zoom === null) return;
    const nowX = PAD + (now / 10) * zoom;
    if (nowX > el.scrollLeft + el.clientWidth - 40) el.scrollLeft = nowX - el.clientWidth + 80;
  }, [now, zoom]);

  const data = useMemo(() => {
    void version;
    return rows.map((r) => {
      const trace = sim?.trace(r.net) ?? [];
      const glitches: Glitch[] = r.source ? [] : findGlitches(trace);
      // at rest nothing will change again, so the last values carry on to the edge
      const end = sim?.idle ? spanTicks : now;
      return { row: r, trace, wave: buildWave(trace, end, xScale(pxPerUnit)), glitches };
    });
  }, [rows, sim, version, now, spanTicks, pxPerUnit]);

  const timeFromEvent = (e: MouseEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const t = (((e.clientX - box.left - PAD) / pxPerUnit) * 10) | 0;
    return Math.min(Math.max(0, t), now);
  };

  const onWheel = (e: WheelEvent<HTMLDivElement>) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    setZoom(Math.min(400, Math.max(2, pxPerUnit * (e.deltaY < 0 ? 1.25 : 0.8))));
  };

  const step = axisStep(pxPerUnit);
  const ticks: number[] = [];
  for (let u = 0; u * 10 <= spanTicks; u += step) ticks.push(Math.round(u * 10));
  const height = AXIS_H + rows.length * ROW_H + 6;
  const shownAt = cursor ?? hover ?? now;
  const glitchCount = data.reduce((n, d) => n + d.glitches.length, 0);

  return (
    <section
      className={`timing${open ? '' : ' is-closed'}`}
      style={open ? { height: panelHeight } : undefined}
      aria-label="דיאגרמת זמנים וניתוח"
    >
      {open && (
        <div
          className="timing-resize"
          role="separator"
          aria-orientation="horizontal"
          aria-label="גובה דיאגרמת הזמנים"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            drag.current = { y: e.clientY, h: panelHeight };
          }}
          onPointerMove={(e) => {
            if (drag.current) setHeight(drag.current.h - (e.clientY - drag.current.y));
          }}
          onPointerUp={() => (drag.current = null)}
        />
      )}
      <header className="timing-bar">
        <button
          type="button"
          className="timing-toggle"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
        >
          {open ? '▾' : '▸'}
        </button>
        <div className="panel-tabs" role="tablist">
          {(
            [
              ['timing', 'דיאגרמת זמנים'],
              ['analysis', 'ניתוח hazards'],
              ['truth', 'טבלת אמת'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={open && tab === id}
              onClick={() => (open && tab === id ? setOpen(false) : setTab(id))}
            >
              {label}
            </button>
          ))}
        </div>
        {timing && (
          <>
            <span className="timing-readout" dir="ltr">
              {cursor !== null && `t = ${fmt(cursor)}${unit}`}
              {cursor !== null &&
                cursorB !== null &&
                `   Δt = ${fmt(Math.abs(cursorB - cursor))}${unit}`}
            </span>
            {glitchCount > 0 && (
              <span className="timing-glitches">
                {glitchCount === 1 ? 'ריצוד אחד' : `${glitchCount} ריצודים`}
              </span>
            )}
            <span className="timing-tools">
              <button type="button" onClick={() => setZoom(pxPerUnit * 1.5)} aria-label="הגדלה">
                +
              </button>
              <button type="button" onClick={() => setZoom(pxPerUnit / 1.5)} aria-label="הקטנה">
                −
              </button>
              <button type="button" onClick={() => setZoom(null)} disabled={zoom === null}>
                הכול
              </button>
              <button
                type="button"
                onClick={() => void exportTimingImage(circuit.name)}
                title="שמירת הדיאגרמה כתמונה (PNG)"
              >
                תמונה
              </button>
              {cursor !== null && (
                <button type="button" onClick={() => setCursor(null)}>
                  ניקוי סמן
                </button>
              )}
            </span>
          </>
        )}
      </header>

      {open && tab === 'analysis' && <AnalysisPanel />}
      {open && tab === 'truth' && <TruthTablePanel />}
      {timing && (
        <div className="timing-body" dir="ltr">
          <div className="timing-labels" style={{ paddingTop: AXIS_H }}>
            {data.map(({ row, trace }) => {
              const v = valueAt(trace, shownAt);
              return (
                <div
                  key={row.net}
                  className="timing-label"
                  style={{ height: ROW_H, color: row.color }}
                >
                  <bdi title={row.net.replace(':', '.')}>{row.label}</bdi>
                  <b>{v}</b>
                </div>
              );
            })}
            {rows.length === 0 && (
              <p className="hint" dir="rtl">
                אין אותות להצגה. בוחרים רכיב ומסמנים &quot;בדיאגרמת הזמנים&quot;.
              </p>
            )}
          </div>
          <div className="timing-scroll" ref={scroller} onWheel={onWheel}>
            <svg
              width={svgWidth}
              height={height}
              className="timing-svg"
              onMouseMove={(e) => setHover(timeFromEvent(e))}
              onMouseLeave={() => setHover(null)}
              onClick={(e) => setCursor(timeFromEvent(e), e.shiftKey && cursor !== null)}
              role="img"
              aria-label="צורות הגל של האותות לאורך הזמן"
            >
              <g className="timing-axis">
                {ticks.map((t) => (
                  <g key={t}>
                    <line x1={x(t)} x2={x(t)} y1={AXIS_H - 5} y2={height} />
                    <text x={x(t)} y={AXIS_H - 8}>
                      {fmt(t)}
                    </text>
                  </g>
                ))}
              </g>
              {data.map(({ row, wave, glitches }, i) => (
                <g key={row.net} transform={`translate(0 ${AXIS_H + i * ROW_H})`}>
                  {wave.unknown.map((u, k) => (
                    <rect
                      key={k}
                      className="wave-x"
                      x={u.x}
                      y={HIGH}
                      width={u.w}
                      height={LOW - HIGH}
                    />
                  ))}
                  {glitches.map((g, k) => (
                    <g key={`g${k}`} className="wave-glitch">
                      <rect
                        x={x(g.start) - 2}
                        y={1}
                        width={x(g.end) - x(g.start) + 4}
                        height={ROW_H - 2}
                      />
                      <text x={(x(g.start) + x(g.end)) / 2} y={(HIGH + LOW) / 2 + 3}>
                        {fmt(g.end - g.start)}
                        {unit}
                      </text>
                    </g>
                  ))}
                  <path className="wave" d={wave.line} stroke={row.color} />
                </g>
              ))}
              <line className="timing-now" x1={x(now)} x2={x(now)} y1={0} y2={height} />
              {hover !== null && cursor === null && (
                <line className="timing-hover" x1={x(hover)} x2={x(hover)} y1={0} y2={height} />
              )}
              {cursor !== null && (
                <line className="timing-cursor" x1={x(cursor)} x2={x(cursor)} y1={0} y2={height} />
              )}
              {cursorB !== null && (
                <line
                  className="timing-cursor is-b"
                  x1={x(cursorB)}
                  x2={x(cursorB)}
                  y1={0}
                  y2={height}
                />
              )}
            </svg>
          </div>
        </div>
      )}
    </section>
  );
}
