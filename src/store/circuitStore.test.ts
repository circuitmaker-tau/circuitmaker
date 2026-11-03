import { beforeEach, describe, expect, it } from 'vitest';
import { mux2FromGates } from '../examples/mux2FromGates';
import { canConnect, validateCircuit } from '../model';
import { useCircuitStore } from './circuitStore';

const store = () => useCircuitStore.getState();

describe('connect rules', () => {
  it('accepts output to free input', () => {
    const c = structuredClone(mux2FromGates);
    c.wires = c.wires.filter((w) => w.id !== 'w8');
    expect(canConnect(c, { component: 'o1', port: 'out' }, { component: 'F', port: 'in' })).toEqual(
      { ok: true },
    );
  });

  it('refuses a taken input, a wrong direction and a missing component', () => {
    const c = mux2FromGates;
    expect(canConnect(c, { component: 'I0', port: 'out' }, { component: 'F', port: 'in' }).ok).toBe(
      false,
    );
    expect(canConnect(c, { component: 'a1', port: 'in0' }, { component: 'F', port: 'in' }).ok).toBe(
      false,
    );
    expect(
      canConnect(c, { component: 'a1', port: 'out' }, { component: 'o1', port: 'out' }).ok,
    ).toBe(false);
    expect(canConnect(c, { component: 'zz', port: 'out' }, { component: 'F', port: 'in' }).ok).toBe(
      false,
    );
  });
});

describe('circuit store', () => {
  beforeEach(() => store().newCircuit());

  it('starts from the MUX example and can start empty', () => {
    store().loadCircuit(mux2FromGates);
    expect(store().circuit.components).toHaveLength(8);
    store().newCircuit();
    expect(store().circuit.components).toEqual([]);
  });

  it('loads a copy, so edits never touch the example', () => {
    store().loadCircuit(mux2FromGates);
    store().moveComponents({ a1: { x: 999, y: 999 } });
    expect(mux2FromGates.components.find((c) => c.id === 'a1')?.position).toEqual({
      x: 280,
      y: 80,
    });
  });

  it('adds components with readable ids and catalog defaults', () => {
    expect(store().addComponent('AND', { x: 10.4, y: 20.6 })).toBe('g1');
    expect(store().addComponent('OR', { x: 0, y: 0 })).toBe('g2');
    expect(store().addComponent('INPUT', { x: 0, y: 0 })).toBe('sw1');
    expect(store().addComponent('OUTPUT', { x: 0, y: 0 })).toBe('led1');
    const g1 = store().circuit.components[0];
    expect(g1).toMatchObject({ type: 'AND', inputs: 2, delay: 1, position: { x: 10, y: 21 } });
  });

  it('builds a valid circuit by connecting wires', () => {
    store().addComponent('INPUT', { x: 0, y: 0 });
    store().addComponent('NOT', { x: 0, y: 0 });
    store().addComponent('OUTPUT', { x: 0, y: 0 });
    expect(
      store().connect({ component: 'sw1', port: 'out' }, { component: 'g1', port: 'in0' }),
    ).toBe(true);
    expect(
      store().connect({ component: 'g1', port: 'out' }, { component: 'led1', port: 'in' }),
    ).toBe(true);
    expect(store().circuit.wires.map((w) => w.id)).toEqual(['w1', 'w2']);
    expect(validateCircuit(store().circuit)).toEqual([]);
  });

  it('refuses a second wire into the same input and explains why', () => {
    store().addComponent('INPUT', { x: 0, y: 0 });
    store().addComponent('INPUT', { x: 0, y: 0 });
    store().addComponent('NOT', { x: 0, y: 0 });
    store().connect({ component: 'sw1', port: 'out' }, { component: 'g1', port: 'in0' });
    expect(
      store().connect({ component: 'sw2', port: 'out' }, { component: 'g1', port: 'in0' }),
    ).toBe(false);
    expect(store().message).toContain('כבר מחוברת');
    expect(store().circuit.wires).toHaveLength(1);
  });

  it('removes a component together with its wires', () => {
    store().loadCircuit(mux2FromGates);
    store().removeComponents(['n1']);
    const { components, wires } = store().circuit;
    expect(components.some((c) => c.id === 'n1')).toBe(false);
    expect(wires.map((w) => w.id)).not.toContain('w1');
    expect(wires.map((w) => w.id)).not.toContain('w4');
    expect(wires).toHaveLength(6);
  });

  it('updates Tp on the 0.1 grid and rejects the rest', () => {
    store().loadCircuit(mux2FromGates);
    expect(store().updateComponent('n1', { delay: 1.5 })).toBe(true);
    expect(store().circuit.components.find((c) => c.id === 'n1')?.delay).toBe(1.5);
    expect(store().updateComponent('n1', { delay: 0.25 })).toBe(false);
    expect(store().message).toContain('Tp');
    expect(store().circuit.components.find((c) => c.id === 'n1')?.delay).toBe(1.5);
  });

  it('drops wires into inputs that disappear when fan-in shrinks', () => {
    store().addComponent('INPUT', { x: 0, y: 0 });
    store().addComponent('AND', { x: 0, y: 0 });
    expect(store().updateComponent('g1', { inputs: 3 })).toBe(true);
    store().connect({ component: 'sw1', port: 'out' }, { component: 'g1', port: 'in2' });
    expect(store().updateComponent('g1', { inputs: 2 })).toBe(true);
    expect(store().circuit.wires).toEqual([]);
    expect(store().updateComponent('g1', { inputs: 5 })).toBe(false);
  });

  it('toggles a switch between 0 and 1', () => {
    store().addComponent('INPUT', { x: 0, y: 0 });
    store().toggleInput('sw1');
    expect(store().circuit.components[0].props?.value).toBe(1);
    store().toggleInput('sw1');
    expect(store().circuit.components[0].props?.value).toBe(0);
  });

  it('removes wires by id', () => {
    store().loadCircuit(mux2FromGates);
    store().removeWires(['w8']);
    expect(store().circuit.wires).toHaveLength(7);
  });
});
