/**
 * Where things are drawn. Node sizes, port positions and wire routes are all
 * computed from the circuit itself, so a wire never depends on what the
 * browser happened to measure.
 *
 * Wires are orthogonal (horizontal and vertical runs, 90° turns only). Where a
 * horizontal run crosses a vertical run of a different net, the horizontal one
 * gets a small hop, so a crossing is never mistaken for a connection.
 */
import { CATALOG, inputPortsOf, outputPortsOf } from '../model';
import type { Circuit, Component, Wire } from '../model';

export const ROW = 20;
export const LABEL_H = 30;
export const HOP_R = 5;

export interface Point {
  x: number;
  y: number;
}

export interface NodeLayout {
  width: number;
  /** Height of the drawn body; ports sit inside this band. */
  bodyHeight: number;
  /** Full node height, including the formula label under a gate. */
  height: number;
}

export function nodeLayout(c: Component): NodeLayout {
  const def = CATALOG[c.type];
  const ins = inputPortsOf(c.type, c.inputs).length;
  const outs = outputPortsOf(c.type).length;
  const bodyHeight = Math.max(ins, outs, 2) * ROW + 8;
  if (def.category === 'gate') return { width: 96, bodyHeight, height: bodyHeight + LABEL_H };
  // every body is n*20+8 high, so with positions on the 10px grid all ports land on the same grid
  if (def.category === 'io') return { width: 72, bodyHeight: 48, height: 48 };
  return { width: 112, bodyHeight, height: bodyHeight };
}

/** Vertical offset of the i-th of n ports, centred on the body. */
export const portOffset = (i: number, n: number, bodyHeight: number) =>
  bodyHeight / 2 + (i - (n - 1) / 2) * ROW;

/** Port position in flow coordinates, or null if the port does not exist. */
export function portPosition(c: Component, port: string): Point | null {
  const { width, bodyHeight } = nodeLayout(c);
  const ins = inputPortsOf(c.type, c.inputs);
  const outs = outputPortsOf(c.type);
  const i = ins.indexOf(port);
  if (i >= 0) return { x: c.position.x, y: c.position.y + portOffset(i, ins.length, bodyHeight) };
  const o = outs.indexOf(port);
  if (o >= 0) {
    return { x: c.position.x + width, y: c.position.y + portOffset(o, outs.length, bodyHeight) };
  }
  return null;
}

const STUB = 16;
const LANE = 8;

/**
 * Orthogonal route from an output to an input. The vertical run sits just
 * before the target, shifted by the input index, so the wires into one gate
 * never share a vertical run.
 */
export function routeWire(from: Point, to: Point, inputIndex = 0, lane?: number): Point[] {
  if (Math.abs(from.y - to.y) < 0.5 && to.x > from.x) return [from, to];
  const laneX = lane ?? to.x - STUB - LANE * inputIndex;
  if (laneX > from.x + STUB / 2) {
    return [from, { x: laneX, y: from.y }, { x: laneX, y: to.y }, to];
  }
  // target is behind the source: go out, around, and back in
  const outX = from.x + STUB;
  const midY = Math.max(from.y, to.y) + 2 * ROW + LANE * inputIndex;
  return [
    from,
    { x: outX, y: from.y },
    { x: outX, y: midY },
    { x: laneX, y: midY },
    { x: laneX, y: to.y },
    to,
  ];
}

export interface RoutedWire {
  id: string;
  /** Wires that share a source belong to the same net and never hop over each other. */
  net: string;
  points: Point[];
  hops: Point[];
}

interface Box {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

const boxOf = (c: Component): Box => {
  const { width, height } = nodeLayout(c);
  return {
    id: c.id,
    x1: c.position.x,
    y1: c.position.y,
    x2: c.position.x + width,
    y2: c.position.y + height,
  };
};

/** Does an axis-aligned segment pass through the inside of a box? */
const cuts = (s: Seg, b: Box) => {
  const x1 = Math.min(s.a.x, s.b.x);
  const x2 = Math.max(s.a.x, s.b.x);
  const y1 = Math.min(s.a.y, s.b.y);
  const y2 = Math.max(s.a.y, s.b.y);
  return x1 < b.x2 - 1 && x2 > b.x1 + 1 && y1 < b.y2 - 1 && y2 > b.y1 + 1;
};

interface Run {
  net: string;
  fixed: number;
  lo: number;
  hi: number;
}

const overlaps = (runs: Run[], net: string, fixed: number, lo: number, hi: number) =>
  runs.some((r) => r.net !== net && Math.abs(r.fixed - fixed) < 1 && lo < r.hi && r.lo < hi);

/**
 * Routes every wire whose ends exist, then marks the crossings.
 * For each wire several vertical lanes are tried, near the target first and
 * then near the source; the chosen one cuts through the fewest components and
 * never runs on top of another net.
 */
export function routeCircuit(circuit: Circuit): RoutedWire[] {
  const byId = new Map(circuit.components.map((c) => [c.id, c]));
  const boxes = circuit.components.map(boxOf);
  const routed: RoutedWire[] = [];
  const verticalRuns: Run[] = [];
  const horizontalRuns: Run[] = [];

  for (const w of circuit.wires) {
    const src = byId.get(w.from.component);
    const dst = byId.get(w.to.component);
    if (!src || !dst) continue;
    const a = portPosition(src, w.from.port);
    const b = portPosition(dst, w.to.port);
    if (!a || !b) continue;
    const index = inputPortsOf(dst.type, dst.inputs).indexOf(w.to.port);
    const net = netOf(w);
    const others = boxes.filter((box) => box.id !== src.id && box.id !== dst.id);

    const score = (points: Point[]) => {
      let cost = 0;
      for (const s of segments(points)) {
        cost += 10 * others.filter((box) => cuts(s, box)).length;
        if (isVertical(s)) {
          if (overlaps(verticalRuns, net, s.a.x, Math.min(s.a.y, s.b.y), Math.max(s.a.y, s.b.y)))
            cost += 6;
        } else if (isHorizontal(s)) {
          if (overlaps(horizontalRuns, net, s.a.y, Math.min(s.a.x, s.b.x), Math.max(s.a.x, s.b.x)))
            cost += 6;
        }
      }
      return cost;
    };

    let best = routeWire(a, b, index);
    if (best.length === 4) {
      const lanes: number[] = [];
      for (let k = 0; k < 8; k++) lanes.push(b.x - STUB - LANE * (index + k));
      for (let k = 0; k < 8; k++) lanes.push(a.x + STUB + LANE * k);
      let bestCost = Infinity;
      for (const x of lanes) {
        if (x <= a.x + 4 || x >= b.x - 4) continue;
        const pts = routeWire(a, b, index, x);
        const cost = score(pts);
        if (cost < bestCost) {
          bestCost = cost;
          best = pts;
        }
        if (cost === 0) break;
      }
    }
    for (const s of segments(best)) {
      if (isVertical(s)) {
        verticalRuns.push({
          net,
          fixed: s.a.x,
          lo: Math.min(s.a.y, s.b.y),
          hi: Math.max(s.a.y, s.b.y),
        });
      } else if (isHorizontal(s)) {
        horizontalRuns.push({
          net,
          fixed: s.a.y,
          lo: Math.min(s.a.x, s.b.x),
          hi: Math.max(s.a.x, s.b.x),
        });
      }
    }
    routed.push({ id: w.id, net, points: best, hops: [] });
  }
  markCrossings(routed);
  return routed;
}

const netOf = (w: Wire) => `${w.from.component}:${w.from.port}`;

interface Seg {
  a: Point;
  b: Point;
}

const segments = (points: Point[]): Seg[] => points.slice(1).map((b, i) => ({ a: points[i], b }));

const isHorizontal = (s: Seg) => Math.abs(s.a.y - s.b.y) < 0.5 && Math.abs(s.a.x - s.b.x) > 0.5;
const isVertical = (s: Seg) => Math.abs(s.a.x - s.b.x) < 0.5 && Math.abs(s.a.y - s.b.y) > 0.5;

/** A horizontal run of one net hops over every vertical run of another net it crosses. */
export function markCrossings(wires: RoutedWire[]): void {
  const verticals = wires.flatMap((w) =>
    segments(w.points)
      .filter(isVertical)
      .map((s) => ({
        net: w.net,
        x: s.a.x,
        y1: Math.min(s.a.y, s.b.y),
        y2: Math.max(s.a.y, s.b.y),
      })),
  );
  for (const w of wires) {
    w.hops = [];
    for (const s of segments(w.points).filter(isHorizontal)) {
      const x1 = Math.min(s.a.x, s.b.x);
      const x2 = Math.max(s.a.x, s.b.x);
      const y = s.a.y;
      for (const v of verticals) {
        if (v.net === w.net) continue;
        const clearOfEnds = v.x > x1 + HOP_R + 1 && v.x < x2 - HOP_R - 1;
        if (clearOfEnds && y > v.y1 + 0.5 && y < v.y2 - 0.5) w.hops.push({ x: v.x, y });
      }
    }
  }
}

/** SVG path for a route, with a half-circle hop at every marked crossing. */
export function wirePath(points: Point[], hops: Point[] = []): string {
  if (points.length === 0) return '';
  const parts = [`M${points[0].x} ${points[0].y}`];
  for (const s of segments(points)) {
    if (isHorizontal(s)) {
      const dir = s.b.x > s.a.x ? 1 : -1;
      const onSeg = hops
        .filter(
          (h) => Math.abs(h.y - s.a.y) < 0.5 && (h.x - s.a.x) * dir > 0 && (s.b.x - h.x) * dir > 0,
        )
        .sort((p, q) => (p.x - q.x) * dir);
      for (const h of onSeg) {
        // sweep chosen so the hop always bulges upwards
        parts.push(
          `L${h.x - dir * HOP_R} ${h.y}`,
          `A${HOP_R} ${HOP_R} 0 0 ${dir > 0 ? 1 : 0} ${h.x + dir * HOP_R} ${h.y}`,
        );
      }
    }
    parts.push(`L${s.b.x} ${s.b.y}`);
  }
  return parts.join(' ');
}

/**
 * First spot on a coarse grid where a new component does not touch any
 * existing one (with a margin), scanning left to right, top to bottom.
 */
export function findFreeSpot(circuit: Circuit, newcomer: Component, margin = 24): Point {
  const size = nodeLayout(newcomer);
  const boxes = circuit.components.map(boxOf);
  const free = (x: number, y: number) =>
    boxes.every(
      (b) =>
        x + size.width + margin <= b.x1 ||
        x >= b.x2 + margin ||
        y + size.height + margin <= b.y1 ||
        y >= b.y2 + margin,
    );
  for (let row = 0; row < 40; row++) {
    for (let col = 0; col < 8; col++) {
      const x = 40 + col * 160;
      const y = 40 + row * 100;
      if (free(x, y)) return { x, y };
    }
  }
  return { x: 40, y: 40 + 40 * 100 };
}
