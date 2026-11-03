import { describe, expect, it } from 'vitest';
import { mux2FromGates } from '../examples/mux2FromGates';
import { CATALOG, inputPortsOf, outputPortsOf } from './catalog';
import { createCircuit, createComponent, createWire, nextId } from './factory';
import { parseCircuit, serializeCircuit } from './serialize';
import { delayToTicks, isValidDelay, ticksToDelay } from './time';
import { COMPONENT_TYPES } from './types';
import type { Circuit } from './types';
import { hasErrors, validateCircuit } from './validate';

const clone = (c: Circuit): Circuit => JSON.parse(JSON.stringify(c));
const codes = (c: Circuit) => validateCircuit(c).map((i) => i.code);

describe('time (rule E1)', () => {
  it('accepts delays on the 0.1 grid and rejects the rest', () => {
    for (const d of [0, 0.1, 0.5, 1, 1.5, 2.3, 10]) expect(isValidDelay(d)).toBe(true);
    for (const d of [-1, 0.05, 1.25, Number.NaN, Infinity, '1'])
      expect(isValidDelay(d)).toBe(false);
  });

  it('converts to integer ticks without rounding drift', () => {
    expect(delayToTicks(1.5)).toBe(15);
    expect(delayToTicks(0.1 + 0.2)).toBe(3);
    expect(ticksToDelay(15)).toBe(1.5);
  });
});

describe('catalog (COMPONENT_SPEC §2)', () => {
  it('has an entry for every component type', () => {
    for (const t of COMPONENT_TYPES) expect(CATALOG[t]).toBeDefined();
  });

  it('uses 0-based port names like the 2026 exams', () => {
    expect(inputPortsOf('MUX4', 6)).toEqual(['I0', 'I1', 'I2', 'I3', 'S0', 'S1']);
    expect(inputPortsOf('DEC3x8', 4)).toEqual(['I0', 'I1', 'I2', 'En']);
    expect(outputPortsOf('DEC2x4')).toEqual(['D0', 'D1', 'D2', 'D3']);
    expect(outputPortsOf('PRIORITY_ENC4x2')).toEqual(['X1', 'X0', 'V']);
    expect(inputPortsOf('AND', 3)).toEqual(['in0', 'in1', 'in2']);
    expect(outputPortsOf('JK_FF')).toEqual(['Q', "Q'"]);
  });

  it('marks only latches and flip-flops as stateful', () => {
    expect(CATALOG.D_FF.stateful).toBe(true);
    expect(CATALOG.SR_LATCH.stateful).toBe(true);
    expect(CATALOG.AND.stateful).toBe(false);
    expect(CATALOG.MUX2.stateful).toBe(false);
  });
});

describe('factory', () => {
  it('fills in catalog defaults', () => {
    const g = createComponent('NAND', 'g1');
    expect(g).toMatchObject({ delay: 1, inputs: 2 });
    expect(createComponent('CLOCK', 'c1').props).toEqual({ halfPeriod: 1, startLevel: 0 });
    expect(createComponent('INPUT', 's1').props).toEqual({ value: 0 });
    expect(createComponent('OUTPUT', 'f').delay).toBe(0);
  });

  it('builds a valid circuit from scratch', () => {
    const c = createCircuit('test');
    c.components.push(
      createComponent('INPUT', 'a'),
      createComponent('NOT', 'n'),
      createComponent('OUTPUT', 'f'),
    );
    c.wires.push(
      createWire('w1', ['a', 'out'], ['n', 'in0']),
      createWire('w2', ['n', 'out'], ['f', 'in']),
    );
    expect(validateCircuit(c)).toEqual([]);
  });

  it('finds the next free id', () => {
    expect(nextId('g', [])).toBe('g1');
    expect(nextId('g', ['g1', 'g2', 'g4'])).toBe('g3');
  });
});

describe('validation', () => {
  it('accepts the MUX 2:1 example with no issues', () => {
    expect(validateCircuit(mux2FromGates)).toEqual([]);
  });

  it('rejects duplicate ids', () => {
    const c = clone(mux2FromGates);
    c.components.push({ ...c.components[0] });
    c.wires.push({ ...c.wires[0] });
    expect(codes(c)).toEqual(
      expect.arrayContaining(['DUPLICATE_COMPONENT_ID', 'DUPLICATE_WIRE_ID']),
    );
  });

  it('rejects an unknown type and a bad fan-in', () => {
    const c = clone(mux2FromGates);
    (c.components[3] as { type: string }).type = 'FOO';
    c.components[4].inputs = 5;
    expect(codes(c)).toEqual(expect.arrayContaining(['UNKNOWN_TYPE', 'BAD_INPUT_COUNT']));
  });

  it('rejects delays off the 0.1 grid', () => {
    const c = clone(mux2FromGates);
    c.components[3].delay = 0.25;
    c.components[4].props = { tpLH: -1 };
    expect(codes(c).filter((x) => x === 'BAD_DELAY' || x === 'BAD_PROP')).toHaveLength(2);
  });

  it('checks per-type props', () => {
    const c = createCircuit();
    c.components.push(
      createComponent('CLOCK', 'clk', undefined, { props: { halfPeriod: 0 } }),
      createComponent('AND', 'g', undefined, { props: { init: 1 } }),
      createComponent('D_FF', 'ff', undefined, { props: { init: 'X' } }),
    );
    const props = validateCircuit(c).filter((i) => i.code === 'BAD_PROP');
    expect(props.map((i) => i.componentId).sort()).toEqual(['clk', 'g']);
  });

  it('rejects wires to missing components or ports', () => {
    const c = clone(mux2FromGates);
    c.wires.push(
      { id: 'x1', from: { component: 'nope', port: 'out' }, to: { component: 'F', port: 'in' } },
      { id: 'x2', from: { component: 'a1', port: 'out' }, to: { component: 'o1', port: 'in7' } },
    );
    expect(codes(c)).toEqual(
      expect.arrayContaining(['WIRE_UNKNOWN_COMPONENT', 'WIRE_UNKNOWN_PORT']),
    );
  });

  it('rejects wires in the wrong direction', () => {
    const c = clone(mux2FromGates);
    c.wires.push(
      { id: 'x1', from: { component: 'a1', port: 'in0' }, to: { component: 'F', port: 'in' } },
      { id: 'x2', from: { component: 'a1', port: 'out' }, to: { component: 'o1', port: 'out' } },
    );
    expect(codes(c)).toEqual(expect.arrayContaining(['WIRE_FROM_NOT_OUTPUT', 'WIRE_TO_NOT_INPUT']));
  });

  it('allows fan-out but not two drivers on one input', () => {
    const c = clone(mux2FromGates);
    expect(hasErrors(validateCircuit(c))).toBe(false); // S0 already fans out to n1 and a1
    c.wires.push({
      id: 'x1',
      from: { component: 'I0', port: 'out' },
      to: { component: 'o1', port: 'in0' },
    });
    expect(codes(c)).toContain('INPUT_MULTIPLE_DRIVERS');
  });

  it('warns, but does not fail, on an unconnected input', () => {
    const c = clone(mux2FromGates);
    c.wires = c.wires.filter((w) => w.id !== 'w5');
    const issues = validateCircuit(c);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      severity: 'warning',
      code: 'UNCONNECTED_INPUT',
      componentId: 'a2',
    });
    expect(hasErrors(issues)).toBe(false);
  });
});

describe('JSON save and load', () => {
  it('round-trips a circuit unchanged', () => {
    const result = parseCircuit(serializeCircuit(mux2FromGates));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.circuit).toEqual(mux2FromGates);
  });

  it('explains why a file cannot be loaded', () => {
    expect(parseCircuit('not json')).toEqual({ ok: false, errors: ['הקובץ אינו JSON תקין'] });

    const wrongVersion = parseCircuit(JSON.stringify({ ...mux2FromGates, version: 2 }));
    expect(wrongVersion.ok).toBe(false);

    const missing = parseCircuit(
      JSON.stringify({ version: 1, name: 'x', timeUnit: 'ns', components: [{}], wires: [] }),
    );
    expect(missing).toEqual({ ok: false, errors: ['רכיב מספר 1 חסר שדות חובה'] });

    const bad = clone(mux2FromGates);
    bad.wires.push({ ...bad.wires[0] });
    const dup = parseCircuit(serializeCircuit(bad));
    expect(dup.ok).toBe(false);
  });

  it('loads a circuit with warnings', () => {
    const c = clone(mux2FromGates);
    c.wires.pop();
    const result = parseCircuit(serializeCircuit(c));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.warnings.map((w) => w.code)).toEqual(['UNCONNECTED_INPUT']);
  });
});
