import { beforeEach, describe, expect, it } from 'vitest';
import { mux2FromGates } from '../examples/mux2FromGates';
import { canConnect, validateCircuit } from '../model';
import { analyse } from '../analysis/hazards';
import { Simulator } from '../engine/simulator';
import { useAnalysisStore } from './analysisStore';
import { componentNameProblem, useCircuitStore } from './circuitStore';
import { useTimingStore } from './timingStore';

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

  it('renames the circuit and shows messages', () => {
    store().renameCircuit('המונה שלי');
    expect(store().circuit.name).toBe('המונה שלי');
    store().showMessage('שגיאה');
    expect(store().message).toBe('שגיאה');
    store().clearMessage();
    expect(store().message).toBeNull();
  });
});

describe('renaming a component', () => {
  const fresh = () => {
    store().loadCircuit(mux2FromGates);
    useTimingStore.getState().resetProbes();
    useAnalysisStore.getState().setOutput(null);
  };

  it('renames the component and every wire that touches it, and the circuit still works', () => {
    fresh();
    expect(store().renameComponent('S0', 'S')).toBe(true);
    const c = store().circuit;
    expect(c.components.some((x) => x.id === 'S0')).toBe(false);
    expect(c.wires.filter((w) => w.from.component === 'S')).toHaveLength(2);
    expect(validateCircuit(c).filter((i) => i.severity === 'error')).toEqual([]);
    const sim = new Simulator(c);
    sim.setNet('S:out', 0, 0);
    sim.runToEnd();
    expect(sim.trace('o1:out').map((t) => t.time / 10)).toEqual([0, 2, 3]); // the same glitch
    // the analysis uses the new name
    expect(analyse(c, 'o1:out')!.hazards.length).toBe(1);
  });

  it('the timing diagram and the analysed lamp follow the new name', () => {
    fresh();
    const c = store().circuit;
    useTimingStore.getState().setProbe(c, 'a1:out', false); // a user choice, so probes are kept
    useAnalysisStore.getState().setOutput('F');
    store().renameComponent('S0', 'S');
    store().renameComponent('F', 'Y');
    const probes = useTimingStore.getState().probes!;
    expect(probes).toContain('S:out');
    expect(probes.some((n) => n.startsWith('S0:'))).toBe(false);
    expect(useAnalysisStore.getState().output).toBe('Y');
  });

  it('refuses an empty, a taken or an odd name, and says why', () => {
    fresh();
    for (const bad of ['', 'I0', '0X', 'X 1', 'שם', "x'", 'a:b', 'ABCDEFGHIJKLM']) {
      expect(store().renameComponent('S0', bad)).toBe(false);
      expect(store().message).not.toBeNull();
      store().clearMessage();
    }
    expect(store().circuit.components.some((x) => x.id === 'S0')).toBe(true);
    expect(componentNameProblem('Cin', store().circuit)).toBeNull();
    expect(componentNameProblem('X_1', store().circuit)).toBeNull();
    expect(store().renameComponent('S0', 'S0')).toBe(true); // no change
  });
});

describe('undo, redo, copy and paste', () => {
  const fresh = () => {
    store().loadCircuit(mux2FromGates);
    store().clearHistory();
  };
  const ids = () => store().circuit.components.map((c) => c.id);

  it('undo and redo step through edits, and a new edit clears redo', () => {
    fresh();
    const start = store().circuit;
    const id = store().addComponent('AND', { x: 0, y: 0 });
    store().updateComponent(id, { delay: 2 });
    store().undo();
    expect(store().circuit.components.find((c) => c.id === id)!.delay).toBe(1);
    store().undo();
    expect(store().circuit).toBe(start);
    store().undo(); // nothing more to undo
    expect(store().circuit).toBe(start);
    store().redo();
    expect(ids()).toContain(id);
    store().removeComponents(['S0']);
    expect(store().future).toEqual([]);
    store().undo();
    expect(ids()).toContain('S0');
    expect(store().circuit.wires).toHaveLength(mux2FromGates.wires.length);
  });

  it('deleting a component with its wires (as the editor does) is undone in one step', () => {
    fresh();
    store().removeWires(['w1', 'w2']); // the wires of S0 go first
    store().removeComponents(['S0']);
    store().undo();
    expect(store().circuit.components).toHaveLength(mux2FromGates.components.length);
    expect(store().circuit.wires).toHaveLength(mux2FromGates.wires.length);
  });

  it('a whole drag is one step, and flipping a switch is not an edit', () => {
    fresh();
    for (let x = 0; x < 20; x++) store().moveComponents({ S0: { x, y: 0 } });
    store().updateComponent('S0', { props: { value: 0 } });
    expect(store().past).toHaveLength(1);
    store().undo();
    expect(store().circuit.components.find((c) => c.id === 'S0')!.position).toEqual(
      mux2FromGates.components.find((c) => c.id === 'S0')!.position,
    );
  });

  it('loading an example can be undone', () => {
    fresh();
    store().newCircuit();
    expect(store().circuit.components).toHaveLength(0);
    store().undo();
    expect(store().circuit.components).toHaveLength(mux2FromGates.components.length);
  });

  it('paste copies the components and the wires between them, with new names, shifted', () => {
    fresh();
    store().copy(['S0', 'n1', 'a1']); // S0 → n1 and S0 → a1 are inside; n1 → a2 is not
    const created = store().paste();
    expect(created).toHaveLength(3);
    const c = store().circuit;
    const pasted = c.components.filter((x) => created.includes(x.id));
    expect(new Set(pasted.map((x) => x.type))).toEqual(new Set(['INPUT', 'NOT', 'AND']));
    const s0 = mux2FromGates.components.find((x) => x.id === 'S0')!;
    const copyOfS0 = pasted.find((x) => x.type === 'INPUT')!;
    expect(copyOfS0.position).toEqual({ x: s0.position.x + 40, y: s0.position.y + 40 });
    const inner = c.wires.filter((w) => created.includes(w.from.component));
    expect(inner).toHaveLength(2);
    expect(inner.every((w) => created.includes(w.to.component))).toBe(true);
    expect(validateCircuit(c).filter((i) => i.severity === 'error')).toEqual([]);
    // a second paste lands further away, and undo removes it
    store().paste();
    expect(store().circuit.components).toHaveLength(mux2FromGates.components.length + 6);
    store().undo();
    expect(store().circuit.components).toHaveLength(mux2FromGates.components.length + 3);
  });

  it('takes a block apart in one step that undo brings back, and refuses a gate', () => {
    store().newCircuit();
    const id = store().addComponent('FULL_ADDER', { x: 0, y: 0 });
    const lamp = store().addComponent('OUTPUT', { x: 400, y: 0 });
    store().connect({ component: id, port: 'Cout' }, { component: lamp, port: 'in' });
    const parts = store().expand(id);
    expect(parts).toEqual([`${id}_h1`, `${id}_h2`, `${id}_o`]);
    expect(store().circuit.wires.some((w) => w.from.component === `${id}_o` && w.to.component === lamp)).toBe(true);
    expect(store().message).toContain('שני חצאי מסכם');
    store().undo();
    expect(store().circuit.components.map((c) => c.id)).toEqual([id, lamp]);
    const gate = store().addComponent('AND', { x: 0, y: 200 });
    expect(store().expand(gate)).toEqual([]);
  });
});
