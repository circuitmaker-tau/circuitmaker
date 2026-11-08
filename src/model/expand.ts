/**
 * "What is inside": replace a ready-made block with the smaller parts the
 * course builds it from, keeping every wire. Each part can be taken apart
 * again, down to gates:
 *   full adder   → two half adders and an OR      (WK6A)
 *   half adder   → XOR and AND                    (WK6A)
 *   MUX 2ⁿ:1     → two MUX 2ⁿ⁻¹:1 and a MUX 2:1   (WK6B, the recursive build)
 *   MUX 2:1      → NOT, two ANDs and an OR        (WK6B, WK5)
 *   decoder      → an inverter per input and an AND per output, with En (WK7A)
 *   priority enc → gates for X1, X0 and V         (WK7A)
 *   register     → four D flip-flops              (WK8B)
 *   counter      → four T flip-flops and ANDs     (WK8B, synchronous)
 * Every part gets the block's Tp, so the whole now takes longer, as built
 * from real gates.
 */
import { createComponent, createWire, nextId } from './factory';
import type { BlockDef, Circuit, ComponentProps, ComponentType, Component, Wire } from './types';

/** "part.port", or a block port name for the outside. */
type Ref = string;

interface Part {
  key: string;
  type: ComponentType;
  inputs?: number;
  /** Offset from the block's position. */
  at: [number, number];
  props?: ComponentProps;
  /** A whole component to copy (the parts of the student's own block keep their own Tp). */
  copy?: Component;
}

export interface Expansion {
  parts: Part[];
  /** Wires inside: [from "part.port", to "part.port"]. */
  wires: [Ref, Ref][];
  /** Each input of the block feeds these part inputs. */
  inputs: Record<string, Ref[]>;
  /** Each output of the block comes from this part output. */
  outputs: Record<string, Ref>;
  /** What it became, for the message and the properties panel. */
  summary: string;
}

const seq = (p: string, n: number) => Array.from({ length: n }, (_, i) => `${p}${i}`);

const HALF: Record<number, ComponentType> = { 4: 'MUX2', 8: 'MUX4', 16: 'MUX8' };
const MUX_OF: Record<string, number> = { MUX2: 2, MUX4: 4, MUX8: 8, MUX16: 16 };

function mux(n: number): Expansion {
  if (n === 2) {
    return {
      parts: [
        { key: 'n', type: 'NOT', at: [0, 120] },
        { key: 'a0', type: 'AND', inputs: 2, at: [150, 0] },
        { key: 'a1', type: 'AND', inputs: 2, at: [150, 110] },
        { key: 'o', type: 'OR', inputs: 2, at: [300, 50] },
      ],
      wires: [
        ['n.out', 'a0.in1'],
        ['a0.out', 'o.in0'],
        ['a1.out', 'o.in1'],
      ],
      inputs: { I0: ['a0.in0'], I1: ['a1.in0'], S0: ['n.in0', 'a1.in1'] },
      outputs: { f: 'o.out' },
      summary: "NOT, שני AND ו-OR: f = S0'·I0 + S0·I1",
    };
  }
  const half = n / 2;
  const k = Math.log2(n);
  const lowSelects = seq('S', k - 1);
  const top = `S${k - 1}`;
  const gap = 20 * half + 60;
  const inputs: Record<string, Ref[]> = {};
  for (let i = 0; i < half; i++) {
    inputs[`I${i}`] = [`m0.I${i}`];
    inputs[`I${i + half}`] = [`m1.I${i}`];
  }
  for (const s of lowSelects) inputs[s] = [`m0.${s}`, `m1.${s}`];
  inputs[top] = ['t.S0'];
  return {
    parts: [
      { key: 'm0', type: HALF[n], at: [0, 0] },
      { key: 'm1', type: HALF[n], at: [0, gap] },
      { key: 't', type: 'MUX2', at: [220, gap / 2] },
    ],
    wires: [
      ['m0.f', 't.I0'],
      ['m1.f', 't.I1'],
    ],
    inputs,
    outputs: { f: 't.f' },
    summary: `שני MUX ${half}:1 ו-MUX 2:1 שבוחר ביניהם לפי ${top} (המימוש הרקורסיבי)`,
  };
}

function decoder(n: number): Expansion {
  const parts: Part[] = seq('', n).map((_, i) => ({ key: `n${i}`, type: 'NOT', at: [0, 70 * i] }));
  const inputs: Record<string, Ref[]> = { En: [] };
  for (let i = 0; i < n; i++) inputs[`I${i}`] = [`n${i}.in0`];
  const outputs: Record<string, Ref> = {};
  for (let d = 0; d < 1 << n; d++) {
    parts.push({ key: `a${d}`, type: 'AND', inputs: n + 1, at: [170, 90 * d] });
    for (let i = 0; i < n; i++) {
      const one = (d >> i) & 1;
      if (one) inputs[`I${i}`].push(`a${d}.in${i}`);
    }
    inputs.En.push(`a${d}.in${n}`);
    outputs[`D${d}`] = `a${d}.out`;
  }
  const wires: [Ref, Ref][] = [];
  for (let d = 0; d < 1 << n; d++) {
    for (let i = 0; i < n; i++) if (!((d >> i) & 1)) wires.push([`n${i}.out`, `a${d}.in${i}`]);
  }
  return {
    parts,
    wires,
    inputs,
    outputs,
    summary: `מהפך לכל כניסה ו-AND לכל יציאה (${1 << n} שערי AND עם En)`,
  };
}

/** The parts of a block, or null when it is already as small as it gets. */
export function expansionOf(c: Component, connected: ReadonlySet<string>): Expansion | null {
  switch (c.type) {
    case 'HALF_ADDER':
      return {
        parts: [
          { key: 'x', type: 'XOR', inputs: 2, at: [0, 0] },
          { key: 'a', type: 'AND', inputs: 2, at: [0, 100] },
        ],
        wires: [],
        inputs: { A: ['x.in0', 'a.in0'], B: ['x.in1', 'a.in1'] },
        outputs: { S: 'x.out', C: 'a.out' },
        summary: 'XOR לסכום ו-AND ל-carry: S = A⊕B, C = A·B',
      };
    case 'FULL_ADDER':
      return {
        parts: [
          { key: 'h1', type: 'HALF_ADDER', at: [0, 0] },
          { key: 'h2', type: 'HALF_ADDER', at: [190, -30] },
          { key: 'o', type: 'OR', inputs: 2, at: [380, 60] },
        ],
        wires: [
          ['h1.S', 'h2.A'],
          ['h1.C', 'o.in1'],
          ['h2.C', 'o.in0'],
        ],
        inputs: { A: ['h1.A'], B: ['h1.B'], Cin: ['h2.B'] },
        outputs: { S: 'h2.S', Cout: 'o.out' },
        summary: 'שני חצאי מסכם ו-OR: S = A⊕B⊕Cin, Cout = AB + Cin(A⊕B)',
      };
    case 'MUX2':
    case 'MUX4':
    case 'MUX8':
    case 'MUX16':
      return mux(MUX_OF[c.type]);
    case 'DEC2x4':
      return decoder(2);
    case 'DEC3x8':
      return decoder(3);
    case 'PRIORITY_ENC4x2':
      return {
        parts: [
          { key: 'n2', type: 'NOT', at: [0, 120] },
          { key: 'a', type: 'AND', inputs: 2, at: [150, 120] },
          { key: 'o1', type: 'OR', inputs: 2, at: [150, 0] },
          { key: 'o0', type: 'OR', inputs: 2, at: [300, 120] },
          { key: 'ov', type: 'OR', inputs: 4, at: [150, 240] },
          { key: 'e1', type: 'AND', inputs: 2, at: [450, 0] },
          { key: 'e0', type: 'AND', inputs: 2, at: [450, 120] },
          { key: 'ev', type: 'AND', inputs: 2, at: [450, 240] },
        ],
        wires: [
          ['n2.out', 'a.in0'],
          ['a.out', 'o0.in1'],
          ['o1.out', 'e1.in0'],
          ['o0.out', 'e0.in0'],
          ['ov.out', 'ev.in0'],
        ],
        inputs: {
          D0: ['ov.in0'],
          D1: ['a.in1', 'ov.in1'],
          D2: ['n2.in0', 'o1.in1', 'ov.in2'],
          D3: ['o1.in0', 'o0.in0', 'ov.in3'],
          En: ['e1.in1', 'e0.in1', 'ev.in1'],
        },
        outputs: { X1: 'e1.out', X0: 'e0.out', V: 'ev.out' },
        summary: "X1 = D3 + D2, X0 = D3 + D2'D1, V = D0 + D1 + D2 + D3, כולם כפול En",
      };
    case 'REGISTER4': {
      const init = c.props?.init;
      return {
        parts: seq('', 4).map((_, i) => ({
          key: `d${i}`,
          type: 'D_FF' as ComponentType,
          at: [0, 110 * i] as [number, number],
          props: init !== undefined ? { init } : undefined,
        })),
        wires: [],
        inputs: { ...Object.fromEntries(seq('D', 4).map((p, i) => [p, [`d${i}.D`]])), CLK: seq('d', 4).map((d) => `${d}.CLK`) },
        outputs: Object.fromEntries(seq('Q', 4).map((p, i) => [p, `d${i}.Q`])),
        summary: 'ארבעה D flip-flop עם שעון משותף',
      };
    }
    case 'COUNTER4': {
      const init = c.props?.init;
      const reset = connected.has('RESET');
      const ffProps: ComponentProps = { ...(init !== undefined ? { init } : {}), ...(reset ? { async: true } : {}) };
      const parts: Part[] = [
        { key: 'one', type: 'CONST1', at: [-120, 0] },
        ...seq('', 4).map((_, i) => ({ key: `t${i}`, type: 'T_FF' as ComponentType, at: [0, 120 * i] as [number, number], props: ffProps })),
        { key: 'a2', type: 'AND', inputs: 2, at: [-130, 250] },
        { key: 'a3', type: 'AND', inputs: 2, at: [-130, 370] },
      ];
      const wires: [Ref, Ref][] = [
        ['one.out', 't0.T'],
        ['t0.Q', 't1.T'],
        ['t0.Q', 'a2.in0'],
        ['t1.Q', 'a2.in1'],
        ['a2.out', 't2.T'],
        ['a2.out', 'a3.in0'],
        ['t2.Q', 'a3.in1'],
        ['a3.out', 't3.T'],
      ];
      const inputs: Record<string, Ref[]> = { CLK: seq('t', 4).map((t) => `${t}.CLK`) };
      if (reset) {
        // RESET is active high, CLR' active low
        parts.push({ key: 'r', type: 'NOT', at: [-130, 470] });
        inputs.RESET = ['r.in0'];
        for (let i = 0; i < 4; i++) wires.push(['r.out', `t${i}.CLR'`]);
      }
      return {
        parts,
        wires,
        inputs,
        outputs: Object.fromEntries(seq('Q', 4).map((p, i) => [p, `t${i}.Q`])),
        summary: 'ארבעה T flip-flop: T0 = 1, T1 = Q0, T2 = Q0Q1, T3 = Q0Q1Q2 (מונה סינכרוני)',
      };
    }
    default:
      return null;
  }
}

/** The parts of one of the student's own blocks: what was saved, without its switches and lamps. */
export function blockExpansion(def: BlockDef): Expansion {
  const pins = new Set([...def.inputs, ...def.outputs]);
  const inner = def.components.filter((c) => !pins.has(c.id));
  const inputs: Record<string, Ref[]> = Object.fromEntries(def.inputs.map((p) => [p, [] as Ref[]]));
  const outputs: Record<string, Ref> = {};
  const wires: [Ref, Ref][] = [];
  for (const w of def.wires) {
    const fromPin = def.inputs.includes(w.from.component);
    const toPin = def.outputs.includes(w.to.component);
    if (fromPin && !toPin) inputs[w.from.component].push(`${w.to.component}.${w.to.port}`);
    else if (toPin && !fromPin) outputs[w.to.component] = `${w.from.component}.${w.from.port}`;
    else if (!fromPin && !toPin) wires.push([`${w.from.component}.${w.from.port}`, `${w.to.component}.${w.to.port}`]);
  }
  return {
    parts: inner.map((c) => ({ key: c.id, type: c.type, at: [c.position.x, c.position.y], copy: c })),
    wires,
    inputs,
    outputs,
    summary: `${inner.length} הרכיבים שבתוך הבלוק ${def.name}`,
  };
}

/** Whether a component of this type can be taken apart. */
export const canExpand = (type: ComponentType) =>
  expansionOf(createComponent(type, 'x'), new Set()) !== null;

/** Short description of what a block is built from, for the properties panel. */
export const expansionSummary = (c: Component) => expansionOf(c, new Set())?.summary ?? null;

/**
 * The circuit with the block replaced by its parts, or null when it cannot be
 * taken apart. The parts are named after the block (FA0_h1, FA0_o), and the
 * outside wires are moved to the parts.
 */
/** Width and height of a component on the canvas (the editor passes the real ones). */
export type SizeOf = (c: Component) => { width: number; height: number };

const roughSize: SizeOf = (c) => ({ width: 130, height: 20 * Math.max(c.inputs, 3) + 40 });

export function expandComponent(
  circuit: Circuit,
  id: string,
  sizeOf: SizeOf = roughSize,
): { circuit: Circuit; parts: string[]; summary: string } | null {
  const block = circuit.components.find((c) => c.id === id);
  if (!block) return null;
  const connected = new Set(circuit.wires.filter((w) => w.to.component === id).map((w) => w.to.port));
  const def = block.type === 'BLOCK' ? (circuit.blocks ?? []).find((b) => b.name === block.props?.block) : undefined;
  const ex = def ? blockExpansion(def) : expansionOf(block, connected);
  if (!ex) return null;

  // the parts start where the block's top left corner was
  const minX = Math.min(...ex.parts.map((p) => p.at[0]));
  const minY = Math.min(...ex.parts.map((p) => p.at[1]));

  const taken = new Set(circuit.components.map((c) => c.id));
  taken.delete(id);
  const idOf = new Map<string, string>();
  const parts = ex.parts.map((p) => {
    let pid = `${id}_${p.key}`;
    if (taken.has(pid)) pid = nextId(`${pid}_`, taken);
    taken.add(pid);
    idOf.set(p.key, pid);
    const position = { x: block.position.x + p.at[0] - minX, y: block.position.y + p.at[1] - minY };
    if (p.copy) return { ...structuredClone(p.copy), id: pid, position };
    const overrides: Partial<Component> = { delay: block.delay };
    if (p.inputs) overrides.inputs = p.inputs;
    if (p.props) overrides.props = p.props;
    if (p.type === 'CONST1' || p.type === 'CONST0') overrides.delay = 0;
    return createComponent(p.type, pid, position, overrides);
  });
  const ref = (r: Ref) => {
    const [key, port] = [r.slice(0, r.indexOf('.')), r.slice(r.indexOf('.') + 1)];
    return [idOf.get(key)!, port] as [string, string];
  };

  const wireIds = new Set(circuit.wires.map((w) => w.id));
  const newWire = (from: [string, string], to: [string, string]): Wire => {
    const wid = nextId('w', wireIds);
    wireIds.add(wid);
    return createWire(wid, from, to);
  };

  const kept = circuit.wires.filter((w) => w.from.component !== id && w.to.component !== id);
  const added: Wire[] = [];
  for (const [from, to] of ex.wires) added.push(newWire(ref(from), ref(to)));
  for (const w of circuit.wires) {
    const into = w.to.component === id;
    const out = w.from.component === id;
    if (!into && !out) continue;
    // from: the outside driver, or the part behind the block's output (also for feedback to itself)
    const from: [string, string] | null = out
      ? ex.outputs[w.from.port]
        ? ref(ex.outputs[w.from.port])
        : null
      : [w.from.component, w.from.port];
    if (!from) continue;
    const targets: [string, string][] = into
      ? (ex.inputs[w.to.port] ?? []).map(ref)
      : [[w.to.component, w.to.port]];
    for (const to of targets) added.push(newWire(from, to));
  }

  // make room: what is to the right of the block moves right, what is below it moves down
  const box = sizeOf(block);
  const right = Math.max(...parts.map((p) => p.position.x + sizeOf(p).width)) - block.position.x;
  const bottom = Math.max(...parts.map((p) => p.position.y + sizeOf(p).height)) - block.position.y;
  const dx = Math.max(0, Math.ceil((right - box.width) / 10) * 10);
  const dy = Math.max(0, Math.ceil((bottom - box.height) / 10) * 10);
  const cx = block.position.x + box.width / 2;
  const cy = block.position.y + box.height / 2;
  const others = circuit.components
    .filter((c) => c.id !== id)
    .map((c) => {
      const moveX = c.position.x >= cx ? dx : 0;
      const moveY = c.position.y >= cy ? dy : 0;
      return moveX || moveY ? { ...c, position: { x: c.position.x + moveX, y: c.position.y + moveY } } : c;
    });

  return {
    circuit: {
      ...circuit,
      components: [...others, ...parts],
      wires: [...kept, ...added],
    },
    parts: parts.map((p) => p.id),
    summary: ex.summary,
  };
}
