/**
 * Self-practice: build a circuit or a component from given parts under the
 * limits of an exam question ("using NAND gates only, fan-in 2", "one MUX 4:1
 * and one inverter"), then submit it and get a score and comments.
 *
 * Each exercise comes from a family, at one of three levels. A family is a
 * kind of exam question; most draw a new function from a seed, so the same
 * question comes in many versions. Every family also builds a solution, which
 * the tests grade (100 for every seed) and the student can ask to see.
 */
import { minimalSop } from '../analysis/minimize';
import type { Cube } from '../analysis/func';
import { product } from '../analysis/format';
import { buildCircuit } from '../examples/build';
import type { Part } from '../examples/build';
import type { Circuit, ComponentType } from '../model/types';

export type Level = 1 | 2 | 3;
export const LEVEL_NAMES: Record<Level, string> = { 1: 'קל', 2: 'בינוני', 3: 'קשה' };

export interface Rules {
  /** Component types that may be used (switches, lamps and, when allowed, constants aside). */
  allowed: ComponentType[];
  /** At most this many of a type. */
  max?: Partial<Record<ComponentType, number>>;
  /** At most this many components in all (constants not counted). */
  maxParts?: number;
  /** Most inputs of one gate (AND, OR, NAND, NOR, XOR, XNOR). */
  maxFanIn?: number;
  /** Whether constant 0 and constant 1 may be used. */
  constants: boolean;
}

export interface Target {
  /** Lamp id. */
  id: string;
  /** Value for every row; row m has inputs[0] as its MSB. */
  table: (0 | 1)[];
  /** The function as the course writes it. */
  expr: string;
}

export interface Exercise {
  /** "family:seed": the same key always gives the same exercise. */
  key: string;
  family: string;
  level: Level;
  title: string;
  task: string;
  source: string;
  hint: string;
  /** Switch ids, MSB first. */
  inputs: string[];
  outputs: Target[];
  rules: Rules;
  /** Components in our solution (constants not counted). */
  best: number;
  /** The circuit the student starts from: switches and lamps only. */
  starter: () => Circuit;
  solution: () => Circuit;
}

// ------------------------------------------------------------------ helpers

/** A small seeded generator (mulberry32), so a key always gives the same exercise. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const bit = (m: number, n: number, k: number) => (m >> (n - 1 - k)) & 1;

/** True when the function changes with every variable. */
function dependsOnAll(t: readonly (0 | 1)[], n: number): boolean {
  for (let k = 0; k < n; k++) {
    const mask = 1 << (n - 1 - k);
    if (!t.some((v, m) => v !== t[m ^ mask])) return false;
  }
  return true;
}

function randomTable(n: number, next: () => number, ok: (t: (0 | 1)[]) => boolean): (0 | 1)[] {
  for (let i = 0; i < 10000; i++) {
    const t = Array.from({ length: 1 << n }, () => (next() < 0.5 ? 0 : 1) as 0 | 1);
    if (dependsOnAll(t, n) && ok(t)) return t;
  }
  throw new Error('no function found');
}

const tableOf = (n: number, f: (b: number[]) => number): (0 | 1)[] =>
  Array.from({ length: 1 << n }, (_, m) => (f(Array.from({ length: n }, (_, k) => bit(m, n, k))) ? 1 : 0) as 0 | 1);

const sopOf = (t: readonly (0 | 1)[], n: number) => minimalSop(t, n);

function sopText(t: readonly (0 | 1)[], vars: string[]): string {
  const terms = sopOf(t, vars.length);
  return terms.length === 0 ? '0' : terms.map((c) => product(vars, c)).join(' + ');
}

const ones = (t: readonly (0 | 1)[]) => t.flatMap((v, m) => (v ? [m] : []));
const sigma = (t: readonly (0 | 1)[]) => `Σm(${ones(t).join(', ')})`;

/** f with the last variable left free, for each value of the others: 0, 1, x or x'. */
function residues(t: readonly (0 | 1)[]): ('0' | '1' | 'x' | "x'")[] {
  return Array.from({ length: t.length / 2 }, (_, k) => {
    const [a, b] = [t[2 * k], t[2 * k + 1]];
    return a === b ? (a ? '1' : '0') : b ? 'x' : "x'";
  });
}

/** Switches down the left, lamps on the right. */
function frame(name: string, inputs: string[], outputs: string[], parts: Part[], wires: string[]): Circuit {
  const right = Math.max(560, ...parts.map((p) => p[2] + 200));
  return buildCircuit(
    name,
    'none',
    [
      ...inputs.map((id, i): Part => [id, 'INPUT', 0, 90 * i]),
      ...outputs.map((id, i): Part => [id, 'OUTPUT', right, 90 * i + 40]),
      ...parts,
    ],
    wires,
  );
}

interface Family {
  id: string;
  level: Level;
  make: (seed: number) => Omit<Exercise, 'key' | 'family' | 'level' | 'starter'>;
}

const GATE_RULE = (types: ComponentType[], maxFanIn: number, constants = false): Rules => ({
  allowed: types,
  maxFanIn,
  constants,
});

// ---------------------------------------------------------------- level 1

type Basic = 'NOT' | 'AND' | 'OR' | 'NOR' | 'NAND';

/** NOT, AND, OR and NOR (or NAND) from one kind of gate (WK3: NAND and NOR are complete). */
function fromOneGate(id: string, gate: 'NAND' | 'NOR'): Family {
  const other = gate === 'NAND' ? 'NOR' : 'NAND';
  const order: Basic[] = ['NOT', 'AND', 'OR', other];
  return {
    id,
    level: 1,
    make: (seed) => {
      const want = order[seed % order.length];
      const inputs = want === 'NOT' ? ['A'] : ['A', 'B'];
      const fn: Record<Basic, (b: number[]) => number> = {
        NOT: (b) => 1 - b[0],
        AND: (b) => b[0] & b[1],
        OR: (b) => b[0] | b[1],
        NOR: (b) => 1 - (b[0] | b[1]),
        NAND: (b) => 1 - (b[0] & b[1]),
      };
      const expr: Record<Basic, string> = { NOT: "A'", AND: 'A·B', OR: 'A + B', NOR: "(A + B)'", NAND: "(A·B)'" };
      // the solution, gate by gate: an inverter is the gate with its inputs tied
      const g = (k: number, x: number, y: number): Part => [`g${k}`, gate, x, y, { inputs: 2 }];
      const inv = (k: number, src: string) => [`${src}>g${k}.in0`, `${src}>g${k}.in1`];
      // with NAND: AND = NOT(NAND), OR = NAND of the inverses; with NOR the other way round
      const direct = gate === 'NAND' ? 'AND' : 'OR'; // gate + inverter
      const dual = gate === 'NAND' ? 'OR' : 'AND'; // inverters + gate
      let parts: Part[];
      let wires: string[];
      if (want === 'NOT') {
        parts = [g(1, 200, 0)];
        wires = [...inv(1, 'A'), 'g1>F.in'];
      } else if (want === direct) {
        parts = [g(1, 200, 20), g(2, 380, 20)];
        wires = ['A>g1.in0', 'B>g1.in1', ...inv(2, 'g1'), 'g2>F.in'];
      } else {
        parts = [g(1, 200, 0), g(2, 200, 110), g(3, 380, 50)];
        wires = [...inv(1, 'A'), ...inv(2, 'B'), 'g1>g3.in0', 'g2>g3.in1'];
        if (want === dual) wires.push('g3>F.in');
        else {
          parts.push(g(4, 540, 50));
          wires.push(...inv(4, 'g3'), 'g4>F.in');
        }
      }
      return {
        title: `${want} משערי ${gate} בלבד`,
        task: `בנו F = ${expr[want]} (שער ${want}) רק משערי ${gate} עם 2 כניסות לכל היותר.`,
        source: `שערי ${gate} ו-${other} הם מערכת שלמה (WK3; סעיף B בשאלה 2 בכל מבחן).`,
        hint: `שער ${gate} ששתי הכניסות שלו מחוברות לאותו אות הוא NOT.`,
        inputs,
        outputs: [{ id: 'F', table: tableOf(inputs.length, fn[want]), expr: expr[want] }],
        rules: GATE_RULE([gate], 2),
        best: parts.length,
        solution: () => frame(`פתרון: ${want} מ-${gate}`, inputs, ['F'], parts, wires),
      };
    },
  };
}

const xorFromNand: Family = {
  id: 'xor-nand',
  level: 1,
  make: (seed) => {
    const xnor = seed % 2 === 1;
    const g = (k: number, x: number, y: number): Part => [`g${k}`, 'NAND', x, y, { inputs: 2 }];
    const parts = [g(1, 180, 40), g(2, 340, 0), g(3, 340, 110), g(4, 500, 50)];
    const wires = ['A>g1.in0', 'B>g1.in1', 'A>g2.in0', 'g1>g2.in1', 'g1>g3.in0', 'B>g3.in1', 'g2>g4.in0', 'g3>g4.in1'];
    if (xnor) {
      parts.push(g(5, 660, 50));
      wires.push('g4>g5.in0', 'g4>g5.in1', 'g5>F.in');
    } else wires.push('g4>F.in');
    const name = xnor ? 'XNOR' : 'XOR';
    return {
      title: `${name} משערי NAND בלבד`,
      task: `בנו F = ${xnor ? "(A ⊕ B)'" : 'A ⊕ B'} רק משערי NAND עם 2 כניסות לכל היותר, ובכמה שפחות שערים.`,
      source: 'מימוש XOR משערים אוניברסליים (WK3, תרגול 3).',
      hint: 'אפשר ב-4 שערים: NAND(A, B) נכנס לשני שערי NAND, אחד עם A ואחד עם B.',
      inputs: ['A', 'B'],
      outputs: [{ id: 'F', table: tableOf(2, (b) => (b[0] ^ b[1]) ^ (xnor ? 1 : 0)), expr: xnor ? "A'B' + AB" : "A'B + AB'" }],
      rules: GATE_RULE(['NAND'], 2),
      best: parts.length,
      solution: () => frame(`פתרון: ${name} מ-NAND`, ['A', 'B'], ['F'], parts, wires),
    };
  },
};

const fromMux2: Family = {
  id: 'mux2-gate',
  level: 1,
  make: (seed) => {
    const variants = [
      { name: 'NOT', expr: "A'", inputs: ['A'], fn: (b: number[]) => 1 - b[0], i0: 'one', i1: 'zero' },
      { name: 'AND', expr: 'A·B', inputs: ['A', 'B'], fn: (b: number[]) => b[0] & b[1], i0: 'zero', i1: 'B' },
      { name: 'OR', expr: 'A + B', inputs: ['A', 'B'], fn: (b: number[]) => b[0] | b[1], i0: 'B', i1: 'one' },
      { name: "A'·B", expr: "A'·B", inputs: ['A', 'B'], fn: (b: number[]) => (1 - b[0]) & b[1], i0: 'B', i1: 'zero' },
    ];
    const v = variants[seed % variants.length];
    const consts = [v.i0, v.i1].filter((x) => x === 'one' || x === 'zero');
    const parts: Part[] = [['m1', 'MUX2', 260, 20]];
    if (consts.includes('one')) parts.push(['one', 'CONST1', 100, 200]);
    if (consts.includes('zero')) parts.push(['zero', 'CONST0', 100, 280]);
    return {
      title: `${v.name} מ-MUX 2:1 יחיד`,
      task: `בנו F = ${v.expr} מ-MUX 2:1 אחד בלבד. מותר לחבר קבועים 0 ו-1.`,
      source: 'MUX 2:1 עם I0 = 1 ו-I1 = 0 הוא NOT (הערה חוזרת בפתרונות המבחנים).',
      hint: 'MUX 2:1 מוציא S0′·I0 + S0·I1. מחברים את A ל-S0 וחושבים מה צריך לצאת כש-A = 0 וכש-A = 1.',
      inputs: v.inputs,
      outputs: [{ id: 'F', table: tableOf(v.inputs.length, v.fn), expr: v.expr }],
      rules: { allowed: ['MUX2'], max: { MUX2: 1 }, constants: true },
      best: 1,
      solution: () =>
        frame(`פתרון: ${v.name} מ-MUX`, v.inputs, ['F'], parts, [`${v.i0}>m1.I0`, `${v.i1}>m1.I1`, 'A>m1.S0', 'm1.f>F.in']),
    };
  },
};

// ---------------------------------------------------------------- level 2

/** f(A, B, C) with one MUX on A, B (or A, B, C) and its data inputs from 0, 1, x and x'. */
function muxWithInverter(id: string, level: Level, n: 3 | 4): Family {
  const vars = ['A', 'B', 'C', 'D'].slice(0, n);
  const last = vars[n - 1];
  const sel = vars.slice(0, n - 1);
  const mux: ComponentType = n === 3 ? 'MUX4' : 'MUX8';
  const muxName = n === 3 ? 'MUX 4:1' : 'MUX 8:1';
  return {
    id,
    level,
    make: (seed) => {
      // f needs x' somewhere, so the one inverter is part of the question
      const t = randomTable(n, rng(seed), (x) => residues(x).includes("x'"));
      const res = residues(t);
      const parts: Part[] = [['m1', mux, 300, 40]];
      const wires: string[] = [];
      // select: the first variable is the MSB (S1 for MUX 4:1, S2 for MUX 8:1)
      sel.forEach((v, k) => wires.push(`${v}>m1.S${sel.length - 1 - k}`));
      if (res.includes("x'")) {
        parts.push(['n1', 'NOT', 160, 90 * (n - 1) + 60]);
        wires.push(`${last}>n1.in0`);
      }
      if (res.includes('0')) parts.push(['zero', 'CONST0', 160, 90 * n + 60]);
      if (res.includes('1')) parts.push(['one', 'CONST1', 160, 90 * n + 140]);
      res.forEach((r, k) => wires.push(`${{ '0': 'zero', '1': 'one', x: last, "x'": 'n1' }[r]}>m1.I${k}`));
      wires.push('m1.f>F.in');
      return {
        title: `f(${vars.join(', ')}) ב-${muxName} ומהפך`,
        task: `ממשו f = ${sigma(t)} בעזרת ${muxName} אחד, כש-${sel.join(', ')} מחוברים לקווי הבחירה (${sel[0]} הוא ה-MSB), ומהפך אחד לכל היותר. מותר לחבר קבועים 0 ו-1.`,
        source: n === 3 ? '2025 מועד ב 1D, 2026 מועד א 1C (MUX 4:1 ושער אחד).' : '2026 מועד ג 1B (MUX 8:1 ומהפך יחיד).',
        hint: `לכל צירוף של ${sel.join(', ')} רושמים את f כפונקציה של ${last}: היא 0, 1, ${last} או ${last}'. זה מה שנכנס ל-I המתאים.`,
        inputs: vars,
        outputs: [{ id: 'F', table: t, expr: sopText(t, vars) }],
        rules: { allowed: [mux, 'NOT'], max: { [mux]: 1, NOT: 1 }, constants: true },
        best: res.includes("x'") ? 2 : 1,
        solution: () => frame(`פתרון: ${sigma(t)}`, vars, ['F'], parts, wires),
      };
    },
  };
}

const decoderOr: Family = {
  id: 'dec-or',
  level: 2,
  make: (seed) => {
    const vars = ['A', 'B', 'C'];
    const t = randomTable(3, rng(seed), (x) => ones(x).length >= 2 && ones(x).length <= 4);
    const on = ones(t);
    const parts: Part[] = [
      ['d1', 'DEC3x8', 220, 20],
      ['one', 'CONST1', 60, 300],
      ['o1', 'OR', 460, 60, { inputs: on.length }],
    ];
    const wires = ['A>d1.I2', 'B>d1.I1', 'C>d1.I0', 'one>d1.En', ...on.map((m, i) => `d1.D${m}>o1.in${i}`), 'o1>F.in'];
    return {
      title: 'f(A, B, C) במפענח 3:8 ושער OR',
      task: `ממשו f = ${sigma(t)} בעזרת מפענח 3:8 אחד (A הוא ה-MSB) ושער OR אחד, עם עד 4 כניסות. מותר לחבר קבועים.`,
      source: 'מפענח ו-OR כסכום מינטרמים (WK7; שאלה 2C במבחני 2026).',
      hint: 'כל יציאה D_m של המפענח היא המינטרם m. לא לשכוח לחבר En ל-1.',
      inputs: vars,
      outputs: [{ id: 'F', table: t, expr: sopText(t, vars) }],
      rules: { allowed: ['DEC3x8', 'OR'], max: { DEC3x8: 1, OR: 1 }, maxFanIn: 4, constants: true },
      best: 2,
      solution: () => frame(`פתרון: ${sigma(t)}`, vars, ['F'], parts, wires),
    };
  },
};

const mux4FromMux2: Family = {
  id: 'mux4-mux2',
  level: 2,
  make: () => {
    const inputs = ['S1', 'S0', 'I3', 'I2', 'I1', 'I0'];
    const parts: Part[] = [
      ['m1', 'MUX2', 260, 300],
      ['m2', 'MUX2', 260, 120],
      ['m3', 'MUX2', 460, 200],
    ];
    const wires = ['I0>m1.I0', 'I1>m1.I1', 'S0>m1.S0', 'I2>m2.I0', 'I3>m2.I1', 'S0>m2.S0', 'm1.f>m3.I0', 'm2.f>m3.I1', 'S1>m3.S0', 'm3.f>F.in'];
    return {
      title: 'MUX 4:1 משלושה MUX 2:1',
      task: 'בנו MUX 4:1: F = I(S1S0), כלומר F = I0 כש-S1S0 = 00, I1 כש-01, I2 כש-10 ו-I3 כש-11. מותר להשתמש רק ב-MUX 2:1, לכל היותר שלושה.',
      source: 'בניית MUX גדול ממרבבים קטנים (WK6B).',
      hint: 'שני MUX בוחרים לפי S0 (אחד בין I0 ל-I1, אחד בין I2 ל-I3), והשלישי בוחר ביניהם לפי S1.',
      inputs,
      outputs: [
        {
          id: 'F',
          table: tableOf(6, (b) => b[2 + (3 - (2 * b[0] + b[1]))]),
          expr: "S1'S0'I0 + S1'S0I1 + S1S0'I2 + S1S0I3",
        },
      ],
      rules: { allowed: ['MUX2'], max: { MUX2: 3 }, constants: false },
      best: 3,
      solution: () => frame('פתרון: MUX 4:1 מ-MUX 2:1', inputs, ['F'], parts, wires),
    };
  },
};

/** Gates to build a sum of products with fan-in 2: inverters, AND chains, an OR chain. */
function sopCircuit(terms: Cube[], vars: string[], gate: { and: ComponentType; or: ComponentType }) {
  const parts: Part[] = [];
  const wires: string[] = [];
  const inverted = new Map<number, string>();
  const lit = (k: number, v: 0 | 1) => {
    if (v === 1) return vars[k];
    if (!inverted.has(k)) {
      const id = `n${vars[k]}`;
      parts.push([id, 'NOT', 160, 90 * k + 40]);
      wires.push(`${vars[k]}>${id}.in0`);
      inverted.set(k, id);
    }
    return inverted.get(k)!;
  };
  let g = 0;
  const two = (type: ComponentType, a: string, b: string, x: number, y: number) => {
    const id = `g${++g}`;
    parts.push([id, type, x, y, { inputs: 2 }]);
    wires.push(`${a}>${id}.in0`, `${b}>${id}.in1`);
    return id;
  };
  const outs = terms.map((c, i) => {
    const ls = [...c].sort((a, b) => a[0] - b[0]).map(([k, v]) => lit(k, v));
    return ls.slice(1).reduce((acc, l, j) => two(gate.and, acc, l, 320 + 140 * j, 110 * i), ls[0]);
  });
  const root = outs.slice(1).reduce((acc, o, j) => two(gate.or, acc, o, 640 + 140 * j, 60 + 40 * j), outs[0]);
  wires.push(`${root}>F.in`);
  return { parts, wires };
}

const sopFanIn2: Family = {
  id: 'sop-fanin2',
  level: 2,
  make: (seed) => {
    const vars = ['A', 'B', 'C'];
    const t = randomTable(3, rng(seed), (x) => {
      const terms = sopOf(x, 3);
      return terms.length >= 2 && terms.length <= 3;
    });
    const { parts, wires } = sopCircuit(sopOf(t, 3), vars, { and: 'AND', or: 'OR' });
    return {
      title: 'SoP מינימלי בשערים עם fan-in 2',
      task: `ממשו f = ${sigma(t)} בשערי AND, OR ו-NOT בלבד, עם 2 כניסות לכל שער ולכל היותר ${parts.length} שערים.`,
      source: 'מפת קרנו ו-SoP מינימלי (WK4), במגבלת fan-in = 2 כמו במבחנים.',
      hint: 'מתחילים במפת קרנו. מכפלה של 3 משתנים עם fan-in 2 היא שני שערי AND בשרשרת.',
      inputs: vars,
      outputs: [{ id: 'F', table: t, expr: sopText(t, vars) }],
      rules: { allowed: ['AND', 'OR', 'NOT'], maxFanIn: 2, maxParts: parts.length, constants: false },
      best: parts.length,
      solution: () => frame(`פתרון: ${sigma(t)}`, vars, ['F'], parts, wires),
    };
  },
};

// ---------------------------------------------------------------- level 3

const fullAdderMux4: Family = {
  id: 'fa-mux4',
  level: 3,
  make: () => {
    const inputs = ['A', 'B', 'Cin'];
    const parts: Part[] = [
      ['n1', 'NOT', 140, 220],
      ['zero', 'CONST0', 140, 300],
      ['one', 'CONST1', 140, 380],
      ['m1', 'MUX4', 320, 0],
      ['m2', 'MUX4', 320, 220],
    ];
    const wires = [
      'Cin>n1.in0',
      'A>m1.S1', 'B>m1.S0', 'Cin>m1.I0', 'n1>m1.I1', 'n1>m1.I2', 'Cin>m1.I3', 'm1.f>S.in',
      'A>m2.S1', 'B>m2.S0', 'zero>m2.I0', 'Cin>m2.I1', 'Cin>m2.I2', 'one>m2.I3', 'm2.f>Cout.in',
    ];
    const sum = (b: number[]) => b[0] ^ b[1] ^ b[2];
    const carry = (b: number[]) => (b[0] & b[1]) | (b[2] & (b[0] ^ b[1]));
    return {
      title: 'מסכם מלא משני MUX 4:1',
      task: 'בנו מסכם מלא: S = A ⊕ B ⊕ Cin ו-Cout = AB + Cin(A ⊕ B), בעזרת שני MUX 4:1 ומהפך אחד לכל היותר. מותר לחבר קבועים.',
      source: '2026 מועד ב 1C.',
      hint: 'מחברים A ו-B לקווי הבחירה של שני המרבבים. לכל צירוף של AB, S הוא Cin או Cin′, ו-Cout הוא 0, Cin או 1.',
      inputs,
      outputs: [
        { id: 'S', table: tableOf(3, sum), expr: 'A ⊕ B ⊕ Cin' },
        { id: 'Cout', table: tableOf(3, carry), expr: 'AB + A·Cin + B·Cin' },
      ],
      rules: { allowed: ['MUX4', 'NOT'], max: { MUX4: 2, NOT: 1 }, constants: true },
      best: 3,
      solution: () => frame('פתרון: מסכם מלא מ-MUX', inputs, ['S', 'Cout'], parts, wires),
    };
  },
};

/** NAND-NAND with fan-in 3 and no complements: inverters are NANDs with their inputs tied. */
const nandFanIn3: Family = {
  id: 'nand3',
  level: 3,
  make: (seed) => {
    const vars = ['A', 'B', 'C', 'D'];
    const t = randomTable(4, rng(seed), (x) => {
      const terms = sopOf(x, 4);
      return terms.length >= 2 && terms.length <= 3 && terms.every((c) => c.size <= 3);
    });
    const terms = sopOf(t, 4);
    const parts: Part[] = [];
    const wires: string[] = [];
    const inv = new Map<string, string>();
    const not = (src: string, y: number) => {
      if (!inv.has(src)) {
        const id = `i${inv.size + 1}`;
        parts.push([id, 'NAND', 160, y, { inputs: 2 }]);
        wires.push(`${src}>${id}.in0`, `${src}>${id}.in1`);
        inv.set(src, id);
      }
      return inv.get(src)!;
    };
    // each term: NAND of its literals; a lone literal x goes in as x' (the final NAND inverts it)
    const termOuts = terms.map((c, i) => {
      const ls = [...c].sort((a, b) => a[0] - b[0]);
      if (ls.length === 1) {
        const [k, v] = ls[0];
        return v === 0 ? vars[k] : not(vars[k], 90 * k + 40);
      }
      const id = `t${i + 1}`;
      parts.push([id, 'NAND', 360, 120 * i, { inputs: ls.length }]);
      ls.forEach(([k, v], j) => wires.push(`${v === 1 ? vars[k] : not(vars[k], 90 * k + 40)}>${id}.in${j}`));
      return id;
    });
    parts.push(['out', 'NAND', 560, 120, { inputs: termOuts.length }]);
    termOuts.forEach((o, j) => wires.push(`${o}>out.in${j}`));
    wires.push('out>F.in');
    return {
      title: 'NAND בלבד, fan-in 3, בלי משלימים',
      task: `ממשו f = ${sigma(t)} בשערי NAND בלבד, עם עד 3 כניסות לשער ולכל היותר ${parts.length} שערים. יש רק A, B, C, D (בלי A′ וכו') ובלי קבועים.`,
      source: 'שאלה 4B (קבוצתית) במבחני 2024–2025: NAND בלבד, fan-in ≤ 3, בלי משלימים.',
      hint: "ממזערים ל-SoP (מפת קרנו) והופכים ל-NAND-NAND. משלים של משתנה = NAND ששתי הכניסות שלו מחוברות אליו.",
      inputs: vars,
      outputs: [{ id: 'F', table: t, expr: sopText(t, vars) }],
      rules: { allowed: ['NAND'], maxFanIn: 3, maxParts: parts.length, constants: false },
      best: parts.length,
      solution: () => frame(`פתרון: ${sigma(t)}`, vars, ['F'], parts, wires),
    };
  },
};

export const FAMILIES: Family[] = [
  fromOneGate('nand-basic', 'NAND'),
  fromOneGate('nor-basic', 'NOR'),
  xorFromNand,
  fromMux2,
  muxWithInverter('mux4-not', 2, 3),
  decoderOr,
  mux4FromMux2,
  sopFanIn2,
  muxWithInverter('mux8-not', 3, 4),
  fullAdderMux4,
  nandFanIn3,
];

export function exerciseFromKey(key: string): Exercise | null {
  const [id, s] = key.split(':');
  const family = FAMILIES.find((f) => f.id === id);
  const seed = Number(s);
  if (!family || !Number.isInteger(seed) || seed < 0) return null;
  const e = family.make(seed);
  return {
    ...e,
    key,
    family: id,
    level: family.level,
    starter: () => frame(e.title, e.inputs, e.outputs.map((o) => o.id), [], []),
  };
}

/** A new exercise at this level, of a different family than the last one when there is a choice. */
export function newExercise(level: Level, previous?: string, random: () => number = Math.random): Exercise {
  const all = FAMILIES.filter((f) => f.level === level);
  const choices = all.length > 1 ? all.filter((f) => f.id !== previous?.split(':')[0]) : all;
  const family = choices[Math.floor(random() * choices.length)];
  return exerciseFromKey(`${family.id}:${Math.floor(random() * 1e6)}`)!;
}
