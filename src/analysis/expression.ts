/**
 * Read a Boolean function the way the course writes it:
 *   F = X0X1 + X1'X2        products by juxtaposition, ' for NOT, + for OR
 *   f = (A' + B)(B' + C)    parentheses, also · * & for AND and ⊕ ^ for XOR
 *   F(A,B,C) = Σ(3,4,5,7)   minterms (also Σm, m, sum), with + d(…) for don't cares
 *   F = Π(0,2)              maxterms (also ΠM, M)
 * A variable is a letter and the digits after it (A, X0, x12), so AB is A·B.
 * The variables are ordered as in the rest of the analysis: A, B, C, D with A
 * as the MSB, and for numbered names the highest number first (X2X1X0).
 */
import type { Value } from './minimize';

export type Expr =
  | { kind: 'var'; name: string }
  | { kind: 'const'; value: 0 | 1 }
  | { kind: 'not'; arg: Expr }
  | { kind: 'and' | 'or' | 'xor'; args: Expr[] };

export interface ParsedFunction {
  /** Name of the output (F if none was written). */
  name: string;
  /** Variables, MSB first. */
  vars: string[];
  /** The expression as written, or null for a list of minterms or maxterms. */
  expr: Expr | null;
  /** Value for every minterm. */
  table: Value[];
}

export type ParseResult = { ok: true; fn: ParsedFunction } | { ok: false; error: string };

/** The most variables a function may have here (as in the analysis). */
export const MAX_FUNCTION_VARS = 6;

class Fail extends Error {}

const natural = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });

/** The course's order: highest number first when every name is numbered, else alphabetical. */
export function orderVariables(names: Iterable<string>): string[] {
  const sorted = [...new Set(names)].sort(natural);
  return sorted.length > 1 && sorted.every((v) => /\d$/.test(v)) ? sorted.reverse() : sorted;
}

export function parseFunction(input: string): ParseResult {
  try {
    return { ok: true, fn: parse(input) };
  } catch (e) {
    if (e instanceof Fail) return { ok: false, error: e.message };
    throw e;
  }
}

function parse(input: string): ParsedFunction {
  const text = input.replace(/[’`´]/g, "'").replace(/\s+/g, ' ').trim();
  if (!text) throw new Fail('כותבים פונקציה, למשל F = X0X1 + X1\'X2 או F = Σ(3,4,5,7).');

  // optional "F =" or "F(A,B,C) ="
  let name = 'F';
  let declared: string[] | null = null;
  let body = text;
  const head = /^([A-Za-z][A-Za-z0-9_]*)\s*(?:\(([^)]*)\))?\s*=\s*(.*)$/.exec(text);
  if (head) {
    name = head[1];
    if (head[2] !== undefined) {
      declared = head[2].split(',').map((s) => s.trim()).filter(Boolean);
      for (const v of declared) {
        if (!/^[A-Za-z][0-9]*$/.test(v)) throw new Fail(`"${v}" לא יכול להיות שם של משתנה. משתנה הוא אות ואחריה ספרות, כמו A או X0.`);
      }
    }
    body = head[3];
  }

  const list = /^(Σ|Σm|m|sum|Π|ΠM|M|prod)\s*\(([^)]*)\)\s*(?:\+\s*(?:d|Σd)\s*\(([^)]*)\))?$/.exec(body);
  if (list) return fromList(name, declared, list);

  const expr = new Parser(body).parseAll();
  const used = new Set<string>();
  collect(expr, used);
  const vars = declared ?? orderVariables(used);
  for (const v of used) if (!vars.includes(v)) throw new Fail(`המשתנה ${v} לא מופיע ברשימה ${name}(${vars.join(', ')}).`);
  if (vars.length > MAX_FUNCTION_VARS) throw new Fail(`יש ${vars.length} משתנים. אפשר עד ${MAX_FUNCTION_VARS}.`);
  const n = vars.length;
  const table = Array.from({ length: 1 << n }, (_, m): Value => {
    const env = new Map(vars.map((v, k) => [v, ((m >> (n - 1 - k)) & 1) as 0 | 1]));
    return evaluate(expr, env);
  });
  return { name, vars, expr, table };
}

function fromList(name: string, declared: string[] | null, match: RegExpExecArray): ParsedFunction {
  const numbers = (s: string | undefined) =>
    (s ?? '')
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean)
      .flatMap((x) => {
        // a range such as 10–15 or 10-15 (homework 4: d(10–15))
        const range = /^(\d+)\s*[–-]\s*(\d+)$/.exec(x);
        if (range) {
          const [a, b] = [Number(range[1]), Number(range[2])];
          if (b < a) throw new Fail(`הטווח ${x} הפוך.`);
          return Array.from({ length: b - a + 1 }, (_, i) => a + i);
        }
        if (!/^\d+$/.test(x)) throw new Fail(`"${x}" הוא לא מספר של מינטרם.`);
        return [Number(x)];
      });
  const maxterms = /^(Π|ΠM|M|prod)$/.test(match[1]);
  const listed = numbers(match[2]);
  const dc = numbers(match[3]);
  const highest = Math.max(0, ...listed, ...dc);
  const needed = Math.max(1, Math.ceil(Math.log2(highest + 1)));
  const vars = declared ?? 'ABCDEF'.slice(0, Math.max(needed, 2)).split('');
  const n = vars.length;
  if (n > MAX_FUNCTION_VARS) throw new Fail(`יש ${n} משתנים. אפשר עד ${MAX_FUNCTION_VARS}.`);
  if (highest >= 1 << n) throw new Fail(`עם ${n} משתנים המספרים הם 0 עד ${(1 << n) - 1}, ו-${highest} גדול מדי.`);
  const both = listed.filter((m) => dc.includes(m));
  if (both.length) throw new Fail(`${both.join(', ')} מופיע גם ברשימה וגם ב-d.`);
  const table = Array.from({ length: 1 << n }, (_, m): Value => {
    if (dc.includes(m)) return 'd';
    const inList = listed.includes(m);
    return maxterms ? (inList ? 0 : 1) : inList ? 1 : 0;
  });
  return { name, vars, expr: null, table };
}

function collect(e: Expr, into: Set<string>) {
  if (e.kind === 'var') into.add(e.name);
  else if (e.kind === 'not') collect(e.arg, into);
  else if (e.kind !== 'const') e.args.forEach((a) => collect(a, into));
}

function evaluate(e: Expr, env: Map<string, 0 | 1>): 0 | 1 {
  switch (e.kind) {
    case 'var':
      return env.get(e.name)!;
    case 'const':
      return e.value;
    case 'not':
      return evaluate(e.arg, env) === 1 ? 0 : 1;
    case 'and':
      return e.args.every((a) => evaluate(a, env) === 1) ? 1 : 0;
    case 'or':
      return e.args.some((a) => evaluate(a, env) === 1) ? 1 : 0;
    case 'xor':
      return (e.args.reduce<number>((s, a) => s ^ evaluate(a, env), 0) as 0 | 1);
  }
}

/** Recursive descent: OR (+) < XOR (⊕ ^) < AND (· * & or nothing) < NOT (' after, ! ¬ ~ before). */
class Parser {
  private i = 0;
  constructor(private readonly s: string) {}

  parseAll(): Expr {
    const e = this.or();
    this.space();
    if (this.i < this.s.length) this.fail(`לא ברור מה זה "${this.s.slice(this.i)}"`);
    return e;
  }

  private fail(message: string): never {
    throw new Fail(message);
  }

  private space() {
    while (this.s[this.i] === ' ') this.i++;
  }

  private peek() {
    this.space();
    return this.s[this.i];
  }

  private or(): Expr {
    const args = [this.xor()];
    while (this.peek() === '+' || this.peek() === '|') {
      this.i++;
      args.push(this.xor());
    }
    return args.length === 1 ? args[0] : { kind: 'or', args };
  }

  private xor(): Expr {
    const args = [this.and()];
    while (this.peek() === '⊕' || this.peek() === '^') {
      this.i++;
      args.push(this.and());
    }
    return args.length === 1 ? args[0] : { kind: 'xor', args };
  }

  private and(): Expr {
    const args = [this.not()];
    for (;;) {
      const c = this.peek();
      if (c === '·' || c === '*' || c === '&' || c === '∙' || c === '.') {
        this.i++;
        args.push(this.not());
      } else if (c !== undefined && /[A-Za-z0-9(!¬~]/.test(c)) {
        args.push(this.not()); // juxtaposition: AB, X0X1, A(B + C)
      } else break;
    }
    return args.length === 1 ? args[0] : { kind: 'and', args };
  }

  private not(): Expr {
    const c = this.peek();
    if (c === '!' || c === '¬' || c === '~') {
      this.i++;
      return { kind: 'not', arg: this.not() };
    }
    let e = this.atom();
    while (this.s[this.i] === "'" || this.peek() === "'") {
      this.space();
      this.i++;
      e = { kind: 'not', arg: e };
    }
    return e;
  }

  private atom(): Expr {
    const c = this.peek();
    if (c === undefined) this.fail('הביטוי נגמר באמצע. אולי חסר משתנה אחרי + או ·?');
    if (c === '(') {
      this.i++;
      const e = this.or();
      if (this.peek() !== ')') this.fail('חסר ")".');
      this.i++;
      return e;
    }
    if (c === '0' || c === '1') {
      this.i++;
      return { kind: 'const', value: c === '1' ? 1 : 0 };
    }
    const m = /^[A-Za-z][0-9]*/.exec(this.s.slice(this.i));
    if (!m) this.fail(`לא ברור מה זה "${c}" במקום ${this.i + 1}.`);
    this.i += m[0].length;
    return { kind: 'var', name: m[0] };
  }
}
