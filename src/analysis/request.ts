/**
 * "Build me a circuit" from a template, without a language model (supervisor's
 * review, 25.11): build [these functions] using [these components] with
 * [fan-in at most k]. Every way of building is a construction from the course:
 * two-level sum of products or product of sums (WK4), NAND-NAND and NOR-NOR
 * (WK3: NAND and NOR are complete), a multiplexer with the last variable on
 * its data inputs (WK6B), MUX 2:1 only by Shannon expansion, and a decoder
 * with OR gates (WK7A). Each result is checked against the functions by
 * simulation before it is offered (see request.test.ts).
 */
import { buildCircuit } from '../examples/build';
import type { Part } from '../examples/build';
import { settle } from '../engine/settle';
import type { Circuit, Component, ComponentType } from '../model';
import { withInputs } from './func';
import type { Cube } from './func';
import { minimalPos, minimalSop } from './minimize';
import type { Value } from './minimize';
import type { FunctionSet } from './romPla';
import { tr } from '../i18n/lang';

export type Method = 'sop' | 'pos' | 'nand' | 'nor' | 'mux' | 'mux2' | 'decoder';

export const METHODS: { id: Method; he: string; en: string; fanIn: boolean }[] = [
  { id: 'sop', he: 'שערי AND, OR ו-NOT (סכום מכפלות)', en: 'AND, OR and NOT gates (sum of products)', fanIn: true },
  { id: 'pos', he: 'שערי OR, AND ו-NOT (מכפלת סכומים)', en: 'OR, AND and NOT gates (product of sums)', fanIn: true },
  { id: 'nand', he: 'שערי NAND בלבד', en: 'NAND gates only', fanIn: true },
  { id: 'nor', he: 'שערי NOR בלבד', en: 'NOR gates only', fanIn: true },
  { id: 'mux', he: 'MUX אחד לכל יציאה ומהפך', en: 'One MUX per output and an inverter', fanIn: false },
  { id: 'mux2', he: 'MUX 2:1 בלבד', en: 'MUX 2:1 only', fanIn: false },
  { id: 'decoder', he: 'מפענח ושערי OR', en: 'A decoder and OR gates', fanIn: true },
];

export const PRESETS: { id: string; he: string; en: string; text: string }[] = [
  { id: 'fa', he: 'מסכם מלא', en: 'A full adder', text: 'S = A ⊕ B ⊕ C; Cout = AB + AC + BC' },
  { id: 'ha', he: 'חצי מסכם', en: 'A half adder', text: 'S = A ⊕ B; Cout = AB' },
  { id: 'maj', he: 'רוב מתוך 3', en: 'Majority of 3', text: 'F = AB + AC + BC' },
  { id: 'eq', he: 'השוואה של שני מספרים של 2 ביט', en: 'Equality of two 2-bit numbers', text: "E(A1,A0,B1,B0) = (A1 ⊕ B1)'(A0 ⊕ B0)'" },
];

/** The name of a method or a preset in the interface language. */
export const nameOf = (x: { he: string; en: string }) => tr(x.he, x.en);

export type RequestResult =
  | { ok: true; circuit: Circuit; counts: [ComponentType, number][]; text: string }
  | { ok: false; error: string };

type Ref = string;

interface Node {
  id: string;
  type: ComponentType;
  /** Sources in port order, with the port name to connect to. */
  ins: [Ref, string][];
  inputs?: number;
}

/** Collects the parts, sharing every gate that is asked for twice. */
class Net {
  nodes: Node[] = [];
  private memo = new Map<string, Ref>();
  private inverse = new Map<Ref, Ref>();
  private counter = new Map<string, number>();

  constructor(
    readonly method: Method,
    readonly fanIn: number,
  ) {}

  private next(prefix: string) {
    const n = (this.counter.get(prefix) ?? 0) + 1;
    this.counter.set(prefix, n);
    return `${prefix}${n}`;
  }

  add(type: ComponentType, ins: [Ref, string][], prefix: string, inputs?: number): Ref {
    const key = `${type}(${ins.map(([r, p]) => `${r}>${p}`).join(',')})`;
    const known = this.memo.get(key);
    if (known) return known;
    const id = this.next(prefix);
    this.nodes.push({ id, type, ins, inputs });
    this.memo.set(key, id);
    return id;
  }

  constant(v: 0 | 1): Ref {
    return this.add(v ? 'CONST1' : 'CONST0', [], v ? 'one' : 'zero');
  }

  private gate(type: ComponentType, items: Ref[]): Ref {
    const sorted = [...items].sort();
    return this.add(type, sorted.map((r, i) => [r, `in${i}`]), 'g', sorted.length);
  }

  not(x: Ref): Ref {
    const back = this.inverse.get(x);
    if (back) return back;
    const id =
      this.method === 'nand'
        ? this.add('NAND', [[x, 'in0'], [x, 'in1']], 'n', 2)
        : this.method === 'nor'
          ? this.add('NOR', [[x, 'in0'], [x, 'in1']], 'n', 2)
          : this.method === 'mux2'
            ? this.add('MUX2', [[this.constant(1), 'I0'], [this.constant(0), 'I1'], [x, 'S0']], 'n')
            : this.add('NOT', [[x, 'in0']], 'n', 1);
    this.inverse.set(id, x);
    this.inverse.set(x, id);
    return id;
  }

  private chunks(items: Ref[]): Ref[][] {
    const out: Ref[][] = [];
    for (let i = 0; i < items.length; i += this.fanIn) out.push(items.slice(i, i + this.fanIn));
    return out;
  }

  and(items: Ref[]): Ref {
    if (items.length === 1) return items[0];
    if (items.length > this.fanIn) return this.and(this.chunks(items).map((c) => this.and(c)));
    if (this.method === 'nand') return this.not(this.gate('NAND', items));
    if (this.method === 'nor') return this.gate('NOR', items.map((x) => this.not(x)));
    return this.gate('AND', items);
  }

  or(items: Ref[]): Ref {
    if (items.length === 1) return items[0];
    if (items.length > this.fanIn) return this.or(this.chunks(items).map((c) => this.or(c)));
    if (this.method === 'nand') return this.gate('NAND', items.map((x) => this.not(x)));
    if (this.method === 'nor') return this.not(this.gate('NOR', items));
    return this.gate('OR', items);
  }
}

const sortedCube = (c: Cube) => [...c].sort((a, b) => a[0] - b[0]);
const bit = (m: number, n: number, k: number) => ((m >> (n - 1 - k)) & 1) as 0 | 1;
const known = (v: Value): 0 | 1 => (v === 1 ? 1 : 0);

/** Sum of products, or product of sums, in whatever gates the method uses. */
function twoLevel(net: Net, vars: string[], table: Value[], form: 'sop' | 'pos'): Ref {
  const lit = (k: number, v: 0 | 1) => (v === 1 ? vars[k] : net.not(vars[k]));
  if (form === 'sop') {
    const terms = minimalSop(table, vars.length);
    if (terms.length === 0) return net.constant(0);
    if (terms.some((c) => c.size === 0)) return net.constant(1);
    return net.or(terms.map((c) => net.and(sortedCube(c).map(([k, v]) => lit(k, v)))));
  }
  // a block of zeros {x: 0, y: 1} is the sum (x + y')
  const terms = minimalPos(table, vars.length);
  if (terms.length === 0) return net.constant(1);
  if (terms.some((c) => c.size === 0)) return net.constant(0);
  return net.and(terms.map((c) => net.or(sortedCube(c).map(([k, v]) => lit(k, v === 0 ? 1 : 0)))));
}

const MUX_OF: Record<number, ComponentType> = { 1: 'MUX2', 2: 'MUX4', 3: 'MUX8' };

/** One multiplexer: the first n-1 variables select, the last one (or 0, 1, its complement) is the data. */
function withMux(net: Net, vars: string[], table: Value[]): Ref {
  const n = vars.length;
  const last = vars[n - 1];
  const sel = vars.slice(0, n - 1);
  const data: [Ref, string][] = Array.from({ length: 1 << (n - 1) }, (_, k) => {
    const [a, b] = [known(table[2 * k]), known(table[2 * k + 1])];
    const ref = a === b ? net.constant(a) : b ? last : net.not(last);
    return [ref, `I${k}`];
  });
  const select: [Ref, string][] = sel.map((v, k) => [v, `S${sel.length - 1 - k}`]);
  return net.add(MUX_OF[n - 1], [...data, ...select], 'm');
}

/** MUX 2:1 only: f = x'·f(x = 0) + x·f(x = 1) on the first variable, again and again. */
function withMux2(net: Net, vars: string[], table: Value[], from = 0): Ref {
  const t = table.map(known);
  if (t.every((v) => v === t[0])) return net.constant(t[0]);
  const half = t.length / 2;
  const [lo, hi] = [t.slice(0, half), t.slice(half)];
  const x = vars[from];
  // f = x or f = x' needs no multiplexer for this variable
  if (lo.every((v) => v === 0) && hi.every((v) => v === 1)) return x;
  if (lo.every((v) => v === 1) && hi.every((v) => v === 0)) return net.not(x);
  const i0 = withMux2(net, vars, lo, from + 1);
  const i1 = withMux2(net, vars, hi, from + 1);
  if (i0 === i1) return i0;
  return net.add('MUX2', [[i0, 'I0'], [i1, 'I1'], [x, 'S0']], 'm');
}

function withDecoder(net: Net, vars: string[], table: Value[]): Ref {
  const n = vars.length;
  const type: ComponentType = n === 2 ? 'DEC2x4' : 'DEC3x8';
  const dec = net.add(type, [...vars.map((v, k): [Ref, string] => [v, `I${n - 1 - k}`]), [net.constant(1), 'En']], 'd');
  const ones = table.flatMap((v, m) => (v === 1 ? [`${dec}.D${m}`] : []));
  if (ones.length === 0) return net.constant(0);
  return net.or(ones);
}

export function buildRequest(set: FunctionSet, method: Method, fanIn: number): RequestResult {
  const { vars, fns } = set;
  const n = vars.length;
  const clash = fns.find((f) => vars.includes(f.name));
  if (clash) {
    return {
      ok: false,
      error: tr(
        `לפונקציה ולמשתנה אותו שם (${clash.name}). תנו לפונקציה שם אחר.`,
        `A function and a variable share the name ${clash.name}. Give the function another name.`,
      ),
    };
  }
  if (method === 'mux' && n < 2) {
    return { ok: false, error: tr('למימוש ב-MUX צריך לפחות 2 משתנים.', 'A MUX needs at least 2 variables.') };
  }
  if (method === 'mux' && n > 4) {
    return { ok: false, error: tr('כאן MUX עד 8:1, כלומר עד 4 משתנים.', 'MUX up to 8:1 here, that is up to 4 variables.') };
  }
  if (method === 'decoder' && (n < 2 || n > 3)) {
    return {
      ok: false,
      error: tr(
        `יש מפענח 2:4 ו-3:8, כלומר 2 או 3 משתנים, ובפונקציה יש ${n}.`,
        `There are 2:4 and 3:8 decoders, so 2 or 3 variables, and the function has ${n}.`,
      ),
    };
  }

  // NOR-NOR comes from the product of sums, everything else from the sum of products
  const net = new Net(method, Math.max(2, Math.min(4, fanIn)));
  const roots = fns.map((f) =>
    method === 'sop' || method === 'nand'
      ? twoLevel(net, vars, f.table, 'sop')
      : method === 'pos' || method === 'nor'
        ? twoLevel(net, vars, f.table, 'pos')
        : method === 'mux'
          ? withMux(net, vars, f.table)
          : method === 'mux2'
            ? withMux2(net, vars, f.table)
            : withDecoder(net, vars, f.table),
  );

  // columns by depth, switches first and lamps last
  const depth = new Map<Ref, number>(vars.map((v) => [v, 0]));
  const base = (r: Ref) => r.split('.')[0];
  for (const node of net.nodes) {
    depth.set(node.id, 1 + Math.max(0, ...node.ins.map(([r]) => depth.get(base(r)) ?? 0)));
  }
  const last = Math.max(1, ...net.nodes.map((nd) => depth.get(nd.id)!));
  const height = (nd: Node) => {
    const rows = nd.type.startsWith('MUX') ? nd.ins.filter(([, p]) => p.startsWith('I')).length : nd.ins.length;
    return nd.type.startsWith('DEC') ? 200 : Math.max(2, rows) * 20 + 40;
  };
  const y = new Map<number, number>();
  const parts: Part[] = vars.map((v, k): Part => [v, 'INPUT', 0, 90 * k]);
  for (const nd of net.nodes) {
    const d = depth.get(nd.id)!;
    const top = y.get(d) ?? 0;
    y.set(d, top + height(nd));
    parts.push([nd.id, nd.type, 180 * d, top, nd.inputs ? { inputs: nd.inputs } : {}]);
  }
  fns.forEach((f, j) => parts.push([f.name, 'OUTPUT', 180 * (last + 1), 90 * j + 20]));

  const out = (r: Ref) => {
    if (r.includes('.')) return r;
    const nd = net.nodes.find((x) => x.id === r);
    return nd && nd.type.startsWith('MUX') ? `${r}.f` : r;
  };
  const wires = [
    ...net.nodes.flatMap((nd) => nd.ins.map(([r, p]) => `${out(r)}>${nd.id}.${p}`)),
    ...roots.map((r, j) => `${out(r)}>${fns[j].name}.in`),
  ];
  const label = nameOf(METHODS.find((m) => m.id === method)!);
  const circuit = buildCircuit(`${fns.map((f) => f.name).join(', ')}: ${label}`, 'none', parts, wires);

  const counts = new Map<ComponentType, number>();
  for (const nd of net.nodes) counts.set(nd.type, (counts.get(nd.type) ?? 0) + 1);
  const listed = [...counts].filter(([t]) => t !== 'CONST0' && t !== 'CONST1');
  const text =
    listed.map(([t, c]) => `${c} ${t}`).join(', ') ||
    tr('בלי רכיבים: הפונקציות הן משתנים או קבועים', 'no parts: the functions are variables or constants');
  return { ok: true, circuit, counts: listed, text };
}

/** The minterm of row m as switch values, for messages. */
export const rowOf = (vars: string[], m: number) => vars.map((v, k) => `${v} = ${bit(m, vars.length, k)}`).join(', ');

/** True when the circuit gives every function in every row (don't cares aside), by simulation. */
export function verifyRequest(set: FunctionSet, circuit: Circuit): boolean {
  const switches = set.vars.map((v) => circuit.components.find((c) => c.id === v && c.type === 'INPUT'));
  if (switches.some((s) => !s)) return false;
  return set.fns.every((f) => {
    const w = circuit.wires.find((x) => x.to.component === f.name);
    if (!w) return false;
    const net = `${w.from.component}:${w.from.port}`;
    return f.table.every(
      (v, m) => v === 'd' || settle(withInputs(circuit, switches as Component[], m)).nets.get(net) === v,
    );
  });
}
