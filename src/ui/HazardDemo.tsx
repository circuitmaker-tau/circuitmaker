/**
 * The home-page demo: a MUX 2:1 built from gates (TC-H1). S0 drops from 1 to
 * 0, the change ripples through the gates one Tp at a time, and F glitches to
 * 0 for exactly one Tp. Wires take the signal colours; a playhead sweeps the
 * timing diagram in step with them. With reduced motion the frame at the
 * glitch is shown instead.
 */
import { GateSymbol } from './GateSymbol';

const W = 96;
const H = 48;

/** Waveform rows on a 0..8 s loop, the same timings as the CSS keyframes. */
const ROWS: { name: string; d: string; glitch?: boolean }[] = [
  { name: 'S0', d: 'M0 4 H100 V22 H300 V4 H400' },
  { name: 'a1 = S0·I1', d: 'M0 4 H125 V22 H325 V4 H400' },
  { name: "a2 = S0'·I0", d: 'M0 22 H150 V4 H350 V22 H400' },
  { name: 'F', d: 'M0 4 H150 V22 H175 V4 H400', glitch: true },
];

function Gate({ type, x, y }: { type: 'AND' | 'OR' | 'NOT'; x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <GateSymbol type={type} inputs={type === 'NOT' ? 1 : 2} width={W} height={H} />
    </g>
  );
}

export function HazardDemo() {
  return (
    <figure className="demo" aria-label="הדגמה: static-1 hazard ב-MUX 2:1 משערים">
      <svg className="demo-circuit" viewBox="0 0 560 300" direction="ltr" role="img">
        <title>MUX 2:1 משערים: כש-S0 יורד ל-0, F נופל ל-0 לזמן של Tp אחד</title>
        {/* wires, each animated by the value it carries */}
        <g className="demo-wires" fill="none">
          <path className="w w-s0" d="M60 40 H140" />
          <path className="w w-s0" d="M84 40 V114 H241 A5 5 0 0 1 251 114 H260" />
          <path className="w w-ns0" d="M236 40 H246 V214 H260" />
          <path className="w w-one" d="M60 134 H241 A5 5 0 0 1 251 134 H260" />
          <path className="w w-one" d="M60 234 H260" />
          <path className="w w-a1" d="M356 124 H384 V154 H400" />
          <path className="w w-a2" d="M356 224 H392 V174 H400" />
          <path className="w w-f" d="M496 164 H520" />
        </g>
        <circle cx="84" cy="40" r="3.5" className="dot" />

        <g className="demo-inputs">
          <rect x="16" y="28" width="44" height="24" rx="6" className="sw sw-s0" />
          <text x="38" y="45" className="sw-text sw-text-s0">
            S0
          </text>
          <rect x="16" y="122" width="44" height="24" rx="6" className="sw sw-on" />
          <text x="38" y="139" className="sw-text">
            I1
          </text>
          <rect x="16" y="222" width="44" height="24" rx="6" className="sw sw-on" />
          <text x="38" y="239" className="sw-text">
            I0
          </text>
        </g>

        <Gate type="NOT" x={140} y={16} />
        <Gate type="AND" x={260} y={100} />
        <Gate type="AND" x={260} y={200} />
        <Gate type="OR" x={400} y={140} />

        <circle cx="534" cy="164" r="14" className="lamp" />
        <text x="534" y="198" className="lamp-label">
          F
        </text>
      </svg>

      <svg className="demo-timing" viewBox="0 0 520 132" direction="ltr" role="img">
        <title>דיאגרמת זמנים: F יורד ל-0 בין t = 3 ל-t = 3.5</title>
        {ROWS.map((r, i) => (
          <g key={r.name} transform={`translate(110 ${8 + i * 30})`}>
            <text x={-12} y={17} className="trace-name">
              {r.name}
            </text>
            {r.glitch && <rect x={150} y={0} width={25} height={26} className="glitch-band" />}
            <path d={r.d} className={`trace${r.glitch ? ' trace-f' : ''}`} />
          </g>
        ))}
        <line x1="110" x2="110" y1="4" y2="128" className="playhead" />
      </svg>
      <figcaption>
        S0 יורד ל-0. ה-NOT מגיב רק אחרי Tp אחד, ובזמן הזה שני שערי ה-AND מוציאים 0. התוצאה: F נופל
        לרגע ל-0, למרות שלפי הפונקציה הוא אמור להישאר 1.
      </figcaption>
    </figure>
  );
}
