/**
 * Build a circuit from a function: switches for the variables, a lamp for the
 * output, and gates in between, laid out left to right by level.
 *
 * - 'written': the expression as typed, gate for gate (the structure decides
 *   the hazards, so it is kept): (AB)' becomes a NAND, X1' a NOT on X1.
 * - 'sop' / 'pos': a minimal sum of products or product of sums (Karnaugh).
 * - 'canonical': one AND per minterm.
 * Fan-in is at most 4, as in the editor; wider gates become a tree.
 */
import { createComponent, createWire } from '../model';
import type { Circuit, Component, ComponentType } from '../model';
import { nodeLayout } from '../ui/geometry';
import type { Expr, ParsedFunction } from './expression';
import type { Cube } from './func';
import { minimalPos, minimalSop } from './minimize';

export type BuildMode = 'written' | 'sop' | 'pos' | 'canonical';

const MAX_FAN_IN = 4;
const COLUMN = 170;
const GAP = 30;

/** The function as an expression in the chosen form. */
export function formFor(fn: ParsedFunction, mode: BuildMode): Expr {
  const n = fn.vars.length;
  const lit = (k: number, v: 0 | 1): Expr => {
    const x: Expr = { kind: 'var', name: fn.vars[k] };
    return v === 1 ? x : { kind: 'not', arg: x };
  };
  const product = (c: Cube): Expr => {
    const lits = [...c].sort((a, b) => a[0] - b[0]).map(([k, v]) => lit(k, v));
    return lits.length === 0 ? { kind: 'const', value: 1 } : lits.length === 1 ? lits[0] : { kind: 'and', args: lits };
  };
  const sum = (c: Cube): Expr => {
    // the cube is a block of zeros: (x + y') is zero where x = 0 and y = 1
    const lits = [...c].sort((a, b) => a[0] - b[0]).map(([k, v]) => lit(k, v === 0 ? 1 : 0));
    return lits.length === 0 ? { kind: 'const', value: 0 } : lits.length === 1 ? lits[0] : { kind: 'or', args: lits };
  };
  const join = (kind: 'and' | 'or', args: Expr[], empty: 0 | 1): Expr =>
    args.length === 0 ? { kind: 'const', value: empty } : args.length === 1 ? args[0] : { kind, args };

  if (mode === 'written' && fn.expr) return fn.expr;
  if (mode === 'pos') return join('and', minimalPos(fn.table, n).map(sum), 1);
  if (mode === 'canonical') {
    const cubes = fn.table.flatMap((v, m) =>
      v === 1 ? [new Map(fn.vars.map((_, k) => [k, ((m >> (n - 1 - k)) & 1) as 0 | 1])) as Cube] : [],
    );
    return join('or', cubes.map(product), 0);
  }
  return join('or', minimalSop(fn.table, n).map(product), 0);
}

interface Placed {
  net: string;
  level: number;
  /** Wished vertical centre: the middle of what feeds it. */
  y: number;
}

export function circuitFromFunction(fn: ParsedFunction, mode: BuildMode): Circuit {
  const expr = formFor(fn, mode);
  const c: Circuit = { version: 1, name: `${fn.name} = …`, timeUnit: 'ns', components: [], wires: [] };
  const taken = new Set(fn.vars);
  let gateCount = 0;
  const newId = (prefix: string) => {
    let id = `${prefix}${++gateCount}`;
    while (taken.has(id)) id = `${prefix}${++gateCount}`;
    taken.add(id);
    return id;
  };
  const add = (type: ComponentType, id: string, level: number, inputs?: number) => {
    const comp = createComponent(type, id, { x: 0, y: 0 }, inputs ? { inputs } : {});
    c.components.push(comp);
    levels.set(id, level);
    return comp;
  };
  const wire = (from: string, to: string, port: string) => {
    const [fc, fp] = from.split(':');
    c.wires.push(createWire(`w${c.wires.length + 1}`, [fc, fp], [to, port]));
  };
  const levels = new Map<string, number>();
  const wish = new Map<string, number>();

  // switches, one row each, MSB on top
  const ROW = 90;
  fn.vars.forEach((v, k) => {
    add('INPUT', v, 0).props = { value: 0 };
    wish.set(v, k * ROW);
  });
  const inverted = new Map<string, Placed>();
  const constants = new Map<0 | 1, Placed>();

  const gate = (type: ComponentType, ins: Placed[]): Placed => {
    // wider than the editor allows: a tree of gates of the same kind
    if (ins.length > MAX_FAN_IN && type !== 'NOT') {
      const inner = type === 'NAND' ? 'AND' : type === 'NOR' ? 'OR' : type;
      const groups: Placed[] = [];
      for (let i = 0; i < ins.length; i += MAX_FAN_IN) {
        const part = ins.slice(i, i + MAX_FAN_IN);
        groups.push(part.length === 1 ? part[0] : gate(inner, part));
      }
      return gate(type, groups);
    }
    const id = newId(type === 'NOT' ? 'n' : 'g');
    const level = 1 + Math.max(...ins.map((p) => p.level));
    add(type, id, level, type === 'NOT' ? undefined : ins.length);
    ins.forEach((p, i) => wire(p.net, id, `in${i}`));
    const y = ins.reduce((s, p) => s + p.y, 0) / ins.length;
    wish.set(id, y);
    return { net: `${id}:out`, level, y };
  };

  const build = (e: Expr): Placed => {
    switch (e.kind) {
      case 'var':
        return { net: `${e.name}:out`, level: 0, y: wish.get(e.name)! };
      case 'const': {
        if (!constants.has(e.value)) {
          const id = newId('k');
          add(e.value === 1 ? 'CONST1' : 'CONST0', id, 0);
          const y = (fn.vars.length + constants.size) * ROW;
          wish.set(id, y);
          constants.set(e.value, { net: `${id}:out`, level: 0, y });
        }
        return constants.get(e.value)!;
      }
      case 'not': {
        const a = e.arg;
        if (a.kind === 'var') {
          // one inverter per variable, shared by every term that needs it
          if (!inverted.has(a.name)) inverted.set(a.name, gate('NOT', [build(a)]));
          return inverted.get(a.name)!;
        }
        if (a.kind === 'and') return gate('NAND', a.args.map(build));
        if (a.kind === 'or') return gate('NOR', a.args.map(build));
        if (a.kind === 'xor' && a.args.length === 2) return gate('XNOR', a.args.map(build));
        return gate('NOT', [build(a)]);
      }
      case 'and':
        return gate('AND', e.args.map(build));
      case 'or':
        return gate('OR', e.args.map(build));
      case 'xor':
        return gate('XOR', e.args.map(build));
    }
  };

  const out = build(expr);
  const lampId = taken.has(fn.name) ? newId('F') : fn.name;
  taken.add(lampId);
  add('OUTPUT', lampId, out.level + 1);
  wish.set(lampId, out.y);
  wire(out.net, lampId, 'in');

  layout(c.components, levels, wish);
  c.name = `${fn.name} = ${describe(expr)}`.slice(0, 80);
  return c;
}

/** Columns by level; in each column, keep the wished order and push apart what overlaps. */
function layout(components: Component[], levels: Map<string, number>, wish: Map<string, number>) {
  const byLevel = new Map<number, Component[]>();
  for (const comp of components) {
    const l = levels.get(comp.id)!;
    byLevel.set(l, [...(byLevel.get(l) ?? []), comp]);
  }
  for (const [level, column] of byLevel) {
    column.sort((a, b) => wish.get(a.id)! - wish.get(b.id)!);
    let next = -Infinity;
    for (const comp of column) {
      const { height } = nodeLayout(comp);
      const top = Math.max(wish.get(comp.id)! - height / 2 + 24, next);
      comp.position = { x: level * COLUMN, y: Math.round(top / 10) * 10 };
      next = comp.position.y + height + GAP;
    }
  }
}

/** The expression in the course's notation, for the circuit's name. */
export function describe(e: Expr, parent: Expr['kind'] | null = null): string {
  switch (e.kind) {
    case 'var':
      return e.name;
    case 'const':
      return String(e.value);
    case 'not':
      return e.arg.kind === 'var' || e.arg.kind === 'const' ? `${describe(e.arg)}'` : `(${describe(e.arg)})'`;
    case 'and': {
      const s = e.args.map((a) => describe(a, 'and')).join('');
      return s;
    }
    case 'or': {
      const s = e.args.map((a) => describe(a, 'or')).join(' + ');
      return parent === 'and' || parent === 'xor' ? `(${s})` : s;
    }
    case 'xor': {
      const s = e.args.map((a) => describe(a, 'xor')).join(' ⊕ ');
      return parent === 'and' ? `(${s})` : s;
    }
  }
}
