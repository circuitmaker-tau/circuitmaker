import { describe, expect, it } from 'vitest';
import { mux2FromGates } from '../examples/mux2FromGates';
import { createComponent } from '../model';
import type { Circuit } from '../model';
import {
  findFreeSpot,
  markCrossings,
  nodeLayout,
  portPosition,
  routeCircuit,
  routeWire,
  wirePath,
} from './geometry';
import type { Point, RoutedWire } from './geometry';

const isOrthogonal = (pts: Point[]) =>
  pts.slice(1).every((b, i) => b.x === pts[i].x || b.y === pts[i].y);

describe('layout', () => {
  it('puts inputs on the left edge and outputs on the right', () => {
    const g = createComponent('AND', 'g', { x: 100, y: 200 });
    const { width } = nodeLayout(g);
    expect(portPosition(g, 'in0')?.x).toBe(100);
    expect(portPosition(g, 'out')?.x).toBe(100 + width);
    expect(portPosition(g, 'in1')!.y - portPosition(g, 'in0')!.y).toBe(20);
    expect(portPosition(g, 'nope')).toBeNull();
  });

  it('grows a gate with its fan-in and leaves room for the formula', () => {
    const two = nodeLayout(createComponent('OR', 'a'));
    const four = nodeLayout(createComponent('OR', 'b', undefined, { inputs: 4 }));
    expect(four.bodyHeight).toBeGreaterThan(two.bodyHeight);
    expect(two.height).toBeGreaterThan(two.bodyHeight);
  });
});

describe('routing', () => {
  it('draws a straight wire when the ports line up', () => {
    expect(routeWire({ x: 0, y: 50 }, { x: 200, y: 50 })).toHaveLength(2);
  });

  it('uses only 90° turns', () => {
    const fwd = routeWire({ x: 0, y: 0 }, { x: 200, y: 80 });
    const back = routeWire({ x: 300, y: 0 }, { x: 100, y: 80 });
    expect(isOrthogonal(fwd)).toBe(true);
    expect(isOrthogonal(back)).toBe(true);
    expect(back.length).toBeGreaterThan(fwd.length);
  });

  it('gives each input of a gate its own vertical lane', () => {
    const a = routeWire({ x: 0, y: 0 }, { x: 200, y: 80 }, 0);
    const b = routeWire({ x: 0, y: 160 }, { x: 200, y: 100 }, 1);
    expect(a[1].x).not.toBe(b[1].x);
  });

  it('never lets two nets share a vertical run', () => {
    const routed = routeCircuit(mux2FromGates);
    const verticals = routed.flatMap((w) =>
      w.points.slice(1).flatMap((q, i) => {
        const p = w.points[i];
        return p.x === q.x && p.y !== q.y
          ? [{ net: w.net, x: p.x, y1: Math.min(p.y, q.y), y2: Math.max(p.y, q.y) }]
          : [];
      }),
    );
    for (const a of verticals) {
      for (const b of verticals) {
        if (a === b || a.net === b.net || a.x !== b.x) continue;
        expect(a.y1 < b.y2 && b.y1 < a.y2).toBe(false);
      }
    }
  });

  it('routes around components instead of through them', () => {
    const routed = routeCircuit(mux2FromGates);
    const w2 = routed.find((r) => r.id === 'w2')!; // S0 -> upper AND, must not run through the NOT gate
    const throughNot = w2.points.slice(1).some((q, i) => {
      const p = w2.points[i];
      return (
        p.y === q.y && p.y > 0 && p.y < 48 && Math.max(p.x, q.x) > 141 && Math.min(p.x, q.x) < 235
      );
    });
    expect(throughNot).toBe(false);
  });

  it('draws S0 to the NOT gate as one straight line', () => {
    const w = routeCircuit(mux2FromGates).find((r) => r.id === 'w1');
    expect(w?.points).toHaveLength(2);
  });

  it('routes every wire of the MUX example orthogonally', () => {
    const routed = routeCircuit(mux2FromGates);
    expect(routed).toHaveLength(8);
    for (const w of routed) expect(isOrthogonal(w.points)).toBe(true);
  });
});

describe('crossings', () => {
  const wire = (id: string, net: string, points: Point[]): RoutedWire => ({
    id,
    net,
    points,
    hops: [],
  });

  it('adds a hop where wires of different nets cross', () => {
    const h = wire('h', 'a:out', [
      { x: 0, y: 50 },
      { x: 200, y: 50 },
    ]);
    const v = wire('v', 'b:out', [
      { x: 100, y: 0 },
      { x: 100, y: 100 },
    ]);
    markCrossings([h, v]);
    expect(h.hops).toEqual([{ x: 100, y: 50 }]);
    expect(v.hops).toEqual([]);
    expect(wirePath(h.points, h.hops)).toContain('A5 5');
  });

  it('never hops over its own net', () => {
    const h = wire('h', 'a:out', [
      { x: 0, y: 50 },
      { x: 200, y: 50 },
    ]);
    const v = wire('v', 'a:out', [
      { x: 100, y: 0 },
      { x: 100, y: 100 },
    ]);
    markCrossings([h, v]);
    expect(h.hops).toEqual([]);
  });

  it('ignores wires that only touch at a corner', () => {
    const h = wire('h', 'a:out', [
      { x: 0, y: 50 },
      { x: 100, y: 50 },
    ]);
    const v = wire('v', 'b:out', [
      { x: 100, y: 50 },
      { x: 100, y: 120 },
    ]);
    markCrossings([h, v]);
    expect(h.hops).toEqual([]);
  });

  it('finds the crossing in a real circuit', () => {
    // NOT output runs down to the lower AND and crosses the S0 -> upper AND wire
    const c: Circuit = structuredClone(mux2FromGates);
    const routed = routeCircuit(c);
    expect(routed.some((w) => w.hops.length > 0)).toBe(true);
  });
});

describe('path', () => {
  it('starts at the first point and ends at the last', () => {
    const d = wirePath([
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 50, y: 40 },
    ]);
    expect(d).toBe('M0 0 L50 0 L50 40');
  });
});

describe('placement', () => {
  it('puts a new component where it overlaps nothing', () => {
    const g = createComponent('XOR', 'new');
    const spot = findFreeSpot(mux2FromGates, g);
    const size = nodeLayout(g);
    for (const c of mux2FromGates.components) {
      const l = nodeLayout(c);
      const apart =
        spot.x + size.width <= c.position.x ||
        spot.x >= c.position.x + l.width ||
        spot.y + size.height <= c.position.y ||
        spot.y >= c.position.y + l.height;
      expect(apart).toBe(true);
    }
  });

  it('uses the top left corner of an empty circuit', () => {
    const empty: Circuit = { ...mux2FromGates, components: [], wires: [] };
    expect(findFreeSpot(empty, createComponent('AND', 'g'))).toEqual({ x: 40, y: 40 });
  });
});
