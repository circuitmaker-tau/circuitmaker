import { describe, expect, it } from 'vitest';
import { EXAMPLES } from '../examples';
import { mux2FromGates } from '../examples/mux2FromGates';
import { createCircuit, createComponent } from '../model';
import { toVerilog } from './toVerilog';

describe('Verilog export (for the Icarus comparison in verify/)', () => {
  it('every example can be exported', () => {
    for (const ex of EXAMPLES) expect(toVerilog(ex.circuit, 100).unsupported).toEqual([]);
  });

  it('writes delays in ticks and starts every net at the steady state', () => {
    const { source, nets } = toVerilog(mux2FromGates, 200);
    expect(source).toContain('`timescale 1ns/1ns');
    expect(source).toContain(`reg n${nets.indexOf('o1:out')} = 1'b1;`);
    expect(source).toMatch(/1'b1 \? 10 : t\d+ === 1'b0 \? 10 : 10/);
    expect(source).toContain('initial #200 $finish;');
  });

  it('lists the parts it cannot export', () => {
    const c = createCircuit();
    c.components.push(createComponent('SR_LATCH', 'L'));
    expect(toVerilog(c, 10).unsupported).toEqual(['L (SR latch)']);
  });
});
