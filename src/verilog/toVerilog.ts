/**
 * Turns a circuit into a Verilog testbench with the same delays and the same
 * delay model, so Icarus Verilog can simulate it and its waveforms can be
 * compared with ours, change by change (work plan: testing against Icarus).
 *
 * How the course's model maps to Verilog:
 * - Time is in ticks (0.1 unit), so every delay is an integer: `timescale 1ns/1ns`.
 * - Transport delay (E2): every new value of an output is sent on its way in a
 *   process of its own (`fork … join_none`) that waits Tp and then assigns
 *   it, so a pulse shorter than Tp still gets through. A rise uses tpLH, a
 *   fall tpHL. Each value carries a sequence number, and a value lands only if
 *   no newer one has landed already: that is the cancelling rule of E2 for
 *   different rise and fall delays. Needs SystemVerilog (`iverilog -g2012`).
 * - Same-tick batching (E3): every change, including switches and the clock,
 *   is a non-blocking assignment, so all changes due at one tick are applied
 *   together before anything is evaluated. (With plain blocking assignments
 *   Verilog would let a gate see a state halfway through the tick.)
 * - Edge-triggered parts (E4): the block remembers the inputs it saw last
 *   time, so on a clock edge it uses the values from just before the edge,
 *   even when an input changes at that very tick. An edge 0 → X or X → 1 makes
 *   the state X, as in our engine.
 * - The clock (E6) starts at its start level and toggles every half period.
 * - Every net starts at our steady state (E5), so both simulators start alike.
 *
 * Latches and encoders are not exported yet; `unsupported` lists any such part.
 */
import { CATALOG, inputPortsOf, outputPortsOf } from '../model';
import type { Circuit, Component } from '../model';
import { delayToTicks } from '../model/time';
import type { Logic } from '../engine/logic';
import { settle } from '../engine/settle';

export interface VerilogExport {
  source: string;
  /** Net key (`component:port`) of each monitored net, by its index in the output. */
  nets: string[];
  /** Components that could not be exported. */
  unsupported: string[];
}

const bit = (v: Logic) => (v === 'X' ? "1'bx" : `1'b${v}`);

export function toVerilog(circuit: Circuit, untilTicks: number): VerilogExport {
  const start = settle(circuit);
  const driverOf = new Map<string, string>();
  for (const w of circuit.wires) {
    driverOf.set(`${w.to.component}:${w.to.port}`, `${w.from.component}:${w.from.port}`);
  }

  // one Verilog name per net: n0, n1, … (component ids may not be legal identifiers)
  const nets: string[] = [];
  const nameOf = new Map<string, string>();
  for (const c of circuit.components) {
    if (c.type === 'OUTPUT') continue;
    for (const p of outputPortsOf(c.type)) {
      nameOf.set(`${c.id}:${p}`, `n${nets.length}`);
      nets.push(`${c.id}:${p}`);
    }
  }
  /** The Verilog expression an input port reads: its driver, or x when unconnected. */
  const read = (c: Component, port: string) => {
    const net = driverOf.get(`${c.id}:${port}`);
    return net ? nameOf.get(net)! : "1'bx";
  };

  const lines: string[] = ['`timescale 1ns/1ns', 'module tb;'];
  const unsupported: string[] = [];
  let tmp = 0;

  lines.push('  reg go = 0;', '  initial #0 go = 1;');
  for (const [net, name] of nameOf) {
    lines.push(`  reg ${name} = ${bit(start.nets.get(net) ?? 'X')}; // ${net}`);
  }

  /** Schedule `value` on a net after the delay for that value (rise, fall or plain). */
  const assign = (c: Component, target: string, value: string) => {
    const plain = delayToTicks(c.delay);
    const rise = c.props?.tpLH !== undefined ? delayToTicks(c.props.tpLH) : plain;
    const fall = c.props?.tpHL !== undefined ? delayToTicks(c.props.tpHL) : plain;
    const k = tmp++;
    lines.push(
      `  reg t${k}; integer q${k} = 0; integer a${k} = 0;`,
      `  task automatic send${k}(input logic v, input integer s, input integer d);`,
      `    begin #d if (s > a${k}) begin a${k} = s; ${target} <= v; end end`,
      '  endtask',
    );
    const delay = `t${k} === 1'b1 ? ${rise} : t${k} === 1'b0 ? ${fall} : ${plain}`;
    return `t${k} = ${value}; q${k} = q${k} + 1; fork send${k}(t${k}, q${k}, ${delay}); join_none`;
  };

  // Our simulation starts from the steady state and evaluates nothing at t = 0.
  // Verilog would evaluate every block once at t = 0, and with transport delays
  // those evaluations would arrive later as extra events, so blocks wait for `go`
  // (set after the start-up of t = 0) and list their inputs explicitly, so that
  // `go` itself does not wake them.
  const comb = (c: Component, port: string, expr: string) => {
    const inputs = [...new Set(expr.match(/n\d+/g) ?? [])];
    if (inputs.length === 0) return;
    const body = assign(c, nameOf.get(`${c.id}:${port}`)!, expr);
    lines.push(`  always @(${inputs.join(' or ')}) if (go) begin ${body} end`);
  };

  for (const c of circuit.components) {
    const ins = inputPortsOf(c.type, c.inputs).map((p) => read(c, p));
    const out = (p = 'out') => nameOf.get(`${c.id}:${p}`)!;
    const i = (port: string) => read(c, port);
    switch (c.type) {
      case 'CONST0':
      case 'CONST1':
      case 'OUTPUT':
        break;
      case 'INPUT': {
        const steps = (c.props?.schedule ?? []).map((s) => ({
          t: delayToTicks(s.time),
          v: s.value,
        }));
        if (steps.length > 0) {
          let now = 0;
          const body = steps.map((s) => {
            const line = `#${s.t - now} ${out()} <= 1'b${s.v};`;
            now = s.t;
            return line;
          });
          lines.push(`  initial begin ${body.join(' ')} end`);
        }
        break;
      }
      case 'CLOCK': {
        const half = Math.max(1, delayToTicks(c.props?.halfPeriod ?? 1));
        lines.push(`  always #${half} ${out()} <= ~${out()};`);
        break;
      }
      case 'AND':
      case 'OR':
      case 'XOR':
      case 'NAND':
      case 'NOR':
      case 'XNOR': {
        const op = { AND: '&', NAND: '&', OR: '|', NOR: '|', XOR: '^', XNOR: '^' }[c.type];
        const e = ins.join(` ${op} `);
        comb(c, 'out', ['NAND', 'NOR', 'XNOR'].includes(c.type) ? `~(${e})` : `(${e})`);
        break;
      }
      case 'NOT':
        comb(c, 'out', `~${ins[0]}`);
        break;
      case 'BUF':
        comb(c, 'out', ins[0]);
        break;
      case 'HALF_ADDER':
        comb(c, 'S', `${i('A')} ^ ${i('B')}`);
        comb(c, 'C', `${i('A')} & ${i('B')}`);
        break;
      case 'FULL_ADDER':
        comb(c, 'S', `${i('A')} ^ ${i('B')} ^ ${i('Cin')}`);
        comb(c, 'Cout', `(${i('A')} & ${i('B')}) | (${i('Cin')} & (${i('A')} ^ ${i('B')}))`);
        break;
      case 'MUX2':
      case 'MUX4':
      case 'MUX8': {
        // nested ?: — with an X select Verilog merges both sides bit by bit, as rule E7 does
        const n = { MUX2: 1, MUX4: 2, MUX8: 3 }[c.type];
        const pick = (level: number, base: number): string =>
          level < 0
            ? i(`I${base}`)
            : `(${i(`S${level}`)} ? ${pick(level - 1, base + (1 << level))} : ${pick(level - 1, base)})`;
        comb(c, 'f', pick(n - 1, 0));
        break;
      }
      case 'DEC2x4':
      case 'DEC3x8': {
        const n = c.type === 'DEC2x4' ? 2 : 3;
        for (let k = 0; k < 1 << n; k++) {
          const lits = Array.from({ length: n }, (_, b) =>
            (k >> b) & 1 ? i(`I${b}`) : `~${i(`I${b}`)}`,
          );
          comb(c, `D${k}`, [i('En'), ...lits].join(' & '));
        }
        break;
      }
      case 'D_FF':
      case 'T_FF':
      case 'JK_FF':
      case 'SR_FF':
      case 'REGISTER4':
      case 'COUNTER4': {
        const clk = driverOf.get(`${c.id}:CLK`);
        const state = start.states.get(c.id) ?? [];
        const width = state.length;
        const st = `s${tmp++}`;
        lines.push(
          `  reg [${width - 1}:0] ${st} = ${width}'b${[...state]
            .reverse()
            .map((b) => (b === 'X' ? 'x' : b))
            .join('')};`,
        );
        const next = {
          D_FF: `${st} = ${i('D')};`,
          T_FF: `${st} = ${i('T')} ^ ${st};`,
          JK_FF: `${st} = (${i('J')} & ~${st}) | (~${i('K')} & ${st});`,
          SR_FF: `${st} = (${i('S')} & ${i('R')}) ? 1'bx : (${i('S')} | (~${i('R')} & ${st}));`,
          REGISTER4: `${st} = {${i('D3')}, ${i('D2')}, ${i('D1')}, ${i('D0')}};`,
          COUNTER4: `${st} = ${st} + 1;`,
        }[c.type];
        const outs = outputPortsOf(c.type);
        const drive = outs
          .map((p, k) => {
            const value =
              c.type === 'REGISTER4' || c.type === 'COUNTER4'
                ? `${st}[${k}]`
                : p === 'Q'
                  ? st
                  : `~${st}`;
            return assign(c, out(p), value);
          })
          .join(' ');
        const reset = c.type === 'COUNTER4' ? driverOf.get(`${c.id}:RESET`) : undefined;
        if (!clk && !reset) break;
        // remember what this block saw last time: the values from just before this tick
        const watched = inputPortsOf(c.type, c.inputs)
          .map((p) => driverOf.get(`${c.id}:${p}`))
          .filter((n): n is string => n !== undefined)
          .map((n) => nameOf.get(n)!);
        const prev = (name: string) => `p${name}`;
        for (const name of new Set(watched))
          lines.push(
            `  reg ${prev(name)}_${st} = ${bit(start.nets.get(nets[Number(name.slice(1))]) ?? 'X')};`,
          );
        const old = (expr: string) => (expr.startsWith('n') ? `${prev(expr)}_${st}` : expr);
        const nextFromOld = next.replace(/n\d+/g, (m) => old(m));
        const c0 = clk ? old(nameOf.get(clk)!) : "1'b0";
        const c1 = clk ? nameOf.get(clk)! : "1'b0";
        const r = reset ? nameOf.get(reset)! : "1'b0";
        const rOld = reset ? old(r) : "1'b0";
        const body = [
          `if (${c0} === 1'b0 && ${c1} === 1'b1) begin if (${rOld} === 1'b0) begin ${nextFromOld} ${drive} end end`,
          `else if ((${c0} === 1'b0 && ${c1} === 1'bx) || (${c0} === 1'bx && ${c1} === 1'b1)) begin ${st} = {${width}{1'bx}}; ${drive} end`,
          reset ? `if (${r} === 1'b1) begin ${st} = 0; ${drive} end` : '',
          ...[...new Set(watched)].map((name) => `${prev(name)}_${st} = ${name};`),
        ].join(' ');
        lines.push(`  always @(${[...new Set(watched)].join(' or ')}) if (go) begin ${body} end`);
        break;
      }
      default:
        unsupported.push(`${c.id} (${CATALOG[c.type].label})`);
    }
  }

  // print every change of every net: "<tick> <net index> <value>"
  nets.forEach((net, k) => {
    const name = nameOf.get(net)!;
    lines.push(`  always @(${name}) $display("%0t ${k} %b", $time, ${name});`);
  });
  lines.push(`  initial #${untilTicks} $finish;`, 'endmodule', '');
  return { source: lines.join('\n'), nets, unsupported };
}
