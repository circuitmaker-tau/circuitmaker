/**
 * Adds the consensus term to a two-level circuit: a new AND (or OR, for a
 * product of sums) on the same literals, wired into the gate that combines
 * the terms. This is the fix shown in WK5: after it, the glitch is gone.
 */
import { createComponent, createWire, nextId } from '../model';
import type { Circuit, Component } from '../model';
import { variablesOf } from './func';
import type { Cube, TwoLevel } from './func';

export type FixResult =
  | { ok: true; circuit: Circuit; added: string[] }
  | { ok: false; error: string };

export function addConsensus(circuit: Circuit, structure: TwoLevel, consensus: Cube): FixResult {
  const root = circuit.components.find((c) => c.id === structure.root)!;
  if (root.inputs >= 4) {
    return { ok: false, error: `ל-${root.id} יש כבר 4 כניסות, ואי אפשר להוסיף לו מונח` };
  }
  const vars = variablesOf(circuit);
  const c: Circuit = structuredClone(circuit);
  const ids = () => c.components.map((x) => x.id);
  const added: string[] = [];
  const termGates = structure.terms
    .map((t) => (t.gate ? c.components.find((x) => x.id === t.gate) : undefined))
    .filter((x): x is Component => x !== undefined);
  const x0 = termGates[0]?.position.x ?? root.position.x - 160;
  const y0 = Math.max(...termGates.map((g) => g.position.y), root.position.y) + 120;

  /** A net carrying the literal: the switch itself, or an inverter of it (reused if there is one). */
  const literalNet = (k: number, v: 0 | 1, slot: number): [string, string] => {
    const sw = vars[k].id;
    if (v === 1) return [sw, 'out'];
    const existing = c.components.find(
      (g) =>
        g.type === 'NOT' && c.wires.some((w) => w.to.component === g.id && w.from.component === sw),
    );
    if (existing) return [existing.id, 'out'];
    const id = nextId('g', ids());
    c.components.push(createComponent('NOT', id, { x: x0 - 140, y: y0 + slot * 60 }));
    c.wires.push(
      createWire(
        nextId(
          'w',
          c.wires.map((w) => w.id),
        ),
        [sw, 'out'],
        [id, 'in0'],
      ),
    );
    added.push(id);
    return [id, 'out'];
  };

  const literals = [...consensus].sort((a, b) => a[0] - b[0]);
  let source: [string, string];
  if (literals.length === 1) {
    source = literalNet(literals[0][0], literals[0][1], 0);
  } else {
    const type = structure.form === 'sop' ? 'AND' : 'OR';
    const id = nextId('g', ids());
    const gate = createComponent(type, id, { x: x0, y: y0 });
    gate.inputs = Math.min(4, literals.length);
    c.components.push(gate);
    added.push(id);
    literals.slice(0, 4).forEach(([k, v], i) => {
      c.wires.push(
        createWire(
          nextId(
            'w',
            c.wires.map((w) => w.id),
          ),
          literalNet(k, v, i),
          [id, `in${i}`],
        ),
      );
    });
    source = [id, 'out'];
  }
  const r = c.components.find((x) => x.id === root.id)!;
  r.inputs += 1;
  c.wires.push(
    createWire(
      nextId(
        'w',
        c.wires.map((w) => w.id),
      ),
      source,
      [r.id, `in${r.inputs - 1}`],
    ),
  );
  return { ok: true, circuit: c, added };
}
