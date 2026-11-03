/**
 * A Karnaugh map for 2 to 4 variables, in the course's layout: rows are the
 * first variables, columns the rest, both in Gray order (00, 01, 11, 10).
 * Each term of the circuit is drawn as a group; the two cells of a hazard are
 * marked, and the consensus term that would cover both is drawn dashed.
 */
import type { Cube } from '../analysis/func';
import type { Logic } from '../engine/logic';

const CELL = 34;
const HEAD = 30;
const GRAY = [[0], [0, 1], [0, 1, 3, 2]];

export interface MapGroup {
  cube: Cube;
  color: string;
  dashed?: boolean;
}

interface KarnaughMapProps {
  vars: string[];
  values: Logic[];
  groups: MapGroup[];
  /** Minterms to mark (the two neighbours of a hazard). */
  marked?: number[];
}

/** Indices along one axis covered by a cube, split into runs that do not wrap. */
function runs(axisVars: number[], cube: Cube, order: number[]): [number, number][] {
  const covered = order.map((code) =>
    axisVars.every((k, i) => {
      const fixed = cube.get(k);
      const bit = (code >> (axisVars.length - 1 - i)) & 1;
      return fixed === undefined || fixed === bit;
    }),
  );
  const out: [number, number][] = [];
  let start = -1;
  covered.forEach((c, i) => {
    if (c && start < 0) start = i;
    if (!c && start >= 0) {
      out.push([start, i - 1]);
      start = -1;
    }
  });
  if (start >= 0) out.push([start, covered.length - 1]);
  return out;
}

export function KarnaughMap({ vars, values, groups, marked = [] }: KarnaughMapProps) {
  const n = vars.length;
  const r = Math.floor(n / 2);
  const rowVars = Array.from({ length: r }, (_, i) => i);
  const colVars = Array.from({ length: n - r }, (_, i) => r + i);
  const rows = GRAY[r];
  const cols = GRAY[n - r];
  const label = (bits: number, width: number) => bits.toString(2).padStart(width, '0');
  const mintermAt = (ri: number, ci: number) => (rows[ri] << (n - r)) | cols[ci];
  const x = (ci: number) => HEAD + ci * CELL;
  const y = (ri: number) => HEAD + ri * CELL;
  const width = HEAD + cols.length * CELL + 4;
  const height = HEAD + rows.length * CELL + 4;

  return (
    <svg
      className="kmap"
      width={width}
      height={height}
      role="img"
      aria-label={`מפת קרנו של ${vars.join(', ')}`}
      direction="ltr"
    >
      <text className="kmap-axis" x={2} y={12}>
        {colVars.map((k) => vars[k]).join('')}
      </text>
      <text className="kmap-axis" x={2} y={HEAD - 4}>
        {rowVars.map((k) => vars[k]).join('') || ' '}
      </text>
      {cols.map((code, ci) => (
        <text key={`c${ci}`} className="kmap-head" x={x(ci) + CELL / 2} y={HEAD - 8}>
          {label(code, n - r)}
        </text>
      ))}
      {rows.map((code, ri) => (
        <text
          key={`r${ri}`}
          className="kmap-head"
          x={HEAD - 6}
          y={y(ri) + CELL / 2 + 4}
          textAnchor="end"
        >
          {r > 0 ? label(code, r) : ''}
        </text>
      ))}
      {rows.map((_, ri) =>
        cols.map((__, ci) => {
          const m = mintermAt(ri, ci);
          const v = values[m];
          return (
            <g key={`${ri}-${ci}`}>
              <rect className="kmap-cell" x={x(ci)} y={y(ri)} width={CELL} height={CELL} />
              <text
                className={`kmap-value v-${v === 'X' ? 'x' : v}`}
                x={x(ci) + CELL / 2}
                y={y(ri) + CELL / 2 + 5}
              >
                {v}
              </text>
              <text className="kmap-index" x={x(ci) + 3} y={y(ri) + 10}>
                {m}
              </text>
            </g>
          );
        }),
      )}
      {groups.map((g, gi) => {
        const inset = 3 + 3 * (gi % 4);
        return runs(rowVars, g.cube, rows).flatMap(([r0, r1]) =>
          runs(colVars, g.cube, cols).map(([c0, c1]) => (
            <rect
              key={`${gi}-${r0}-${c0}`}
              className={`kmap-group${g.dashed ? ' is-dashed' : ''}`}
              x={x(c0) + inset}
              y={y(r0) + inset}
              width={(c1 - c0 + 1) * CELL - 2 * inset}
              height={(r1 - r0 + 1) * CELL - 2 * inset}
              rx={8}
              stroke={g.color}
            />
          )),
        );
      })}
      {marked.map((m) => {
        const ri = rows.indexOf(m >> (n - r));
        const ci = cols.indexOf(m & ((1 << (n - r)) - 1));
        return (
          <rect
            key={`m${m}`}
            className="kmap-mark"
            x={x(ci) + 1}
            y={y(ri) + 1}
            width={CELL - 2}
            height={CELL - 2}
          />
        );
      })}
    </svg>
  );
}
