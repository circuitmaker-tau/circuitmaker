/**
 * ANSI gate symbols, as drawn in the course slides and exams. Inputs enter on
 * the left at the same heights as the ports, the output leaves on the right,
 * and a small circle at the output means inversion.
 */
import type { ComponentType } from '../model';
import { portOffset } from './geometry';

const L = 16; // length of the input stubs

type Shape = 'AND' | 'OR' | 'BUF';

const SHAPE: Partial<Record<ComponentType, { shape: Shape; inverted: boolean; xor: boolean }>> = {
  AND: { shape: 'AND', inverted: false, xor: false },
  NAND: { shape: 'AND', inverted: true, xor: false },
  OR: { shape: 'OR', inverted: false, xor: false },
  NOR: { shape: 'OR', inverted: true, xor: false },
  XOR: { shape: 'OR', inverted: false, xor: true },
  XNOR: { shape: 'OR', inverted: true, xor: true },
  BUF: { shape: 'BUF', inverted: false, xor: false },
  NOT: { shape: 'BUF', inverted: true, xor: false },
};

interface GateSymbolProps {
  type: ComponentType;
  inputs: number;
  width: number;
  height: number;
}

export function GateSymbol({ type, inputs, width, height: h }: GateSymbolProps) {
  const spec = SHAPE[type];
  if (!spec) return null;
  const x0 = spec.xor ? L + 6 : L; // the XOR family has an extra curve in front
  const bodyEnd = spec.shape === 'BUF' ? x0 + 40 : x0 + 48;
  const outStart = spec.inverted ? bodyEnd + 10 : bodyEnd;
  // where an input stub meets the curved back of an OR-like gate
  const backX = (y: number, base: number) => {
    const t = y / h;
    return spec.shape === 'OR' ? base + 24 * t * (1 - t) : base;
  };

  const body =
    spec.shape === 'AND'
      ? `M${x0} 0 H${x0 + 24} A24 ${h / 2} 0 0 1 ${x0 + 24} ${h} H${x0} Z`
      : spec.shape === 'OR'
        ? `M${x0} 0 Q${x0 + 12} ${h / 2} ${x0} ${h} Q${x0 + 30} ${h} ${bodyEnd} ${h / 2} Q${x0 + 30} 0 ${x0} 0 Z`
        : `M${x0} 0 L${bodyEnd} ${h / 2} L${x0} ${h} Z`;

  return (
    <svg className="cm-gate-svg" width={width} height={h} viewBox={`0 0 ${width} ${h}`} aria-hidden>
      {Array.from({ length: inputs }, (_, i) => {
        const y = portOffset(i, inputs, h);
        const end = spec.xor ? backX(y, L) : backX(y, x0);
        return <line key={i} x1={0} y1={y} x2={end} y2={y} className="cm-stub" />;
      })}
      {spec.xor && (
        <path d={`M${L} 0 Q${L + 12} ${h / 2} ${L} ${h}`} className="cm-outline" fill="none" />
      )}
      <path d={body} className="cm-outline cm-body-fill" />
      {spec.inverted && (
        <circle cx={bodyEnd + 5} cy={h / 2} r={5} className="cm-outline cm-body-fill" />
      )}
      <line x1={outStart} y1={h / 2} x2={width} y2={h / 2} className="cm-stub" />
    </svg>
  );
}
