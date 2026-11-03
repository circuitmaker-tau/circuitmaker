import { beforeEach, describe, expect, it } from 'vitest';
import { mux2FromGates } from '../examples/mux2FromGates';
import { useCircuitStore } from './circuitStore';
import { MS_PER_TYPICAL_TP, structureSignature, typicalTpTicks, useSimStore } from './simStore';

const wave = (net: string) =>
  useSimStore
    .getState()
    .sim!.trace(net)
    .map((t) => `${t.time / 10}:${t.value}`)
    .join(' ');

beforeEach(() => {
  useCircuitStore.getState().loadCircuit(structuredClone(mux2FromGates));
  useSimStore.getState().setSpeed(1);
  useSimStore.getState().reset(useCircuitStore.getState().circuit);
});

describe('playback', () => {
  it('starts at rest at t = 0', () => {
    const { sim, playing } = useSimStore.getState();
    expect(sim!.now).toBe(0);
    expect(sim!.idle).toBe(true);
    expect(playing).toBe(false);
  });

  it('flipping a switch changes the saved circuit and starts playing', () => {
    useSimStore.getState().flip('S0');
    const s0 = useCircuitStore.getState().circuit.components.find((c) => c.id === 'S0');
    expect(s0!.props!.value).toBe(0);
    expect(useSimStore.getState().playing).toBe(true);
  });

  it('shows the static-1 hazard of TC-H1 one Tp at a time', () => {
    useSimStore.getState().flip('S0'); // at t = 0
    const tp = MS_PER_TYPICAL_TP; // real ms for one Tp at ×1
    useSimStore.getState().advance(tp); // t = 1
    expect(useSimStore.getState().sim!.value('n1:out')).toBe(1);
    expect(useSimStore.getState().sim!.value('o1:out')).toBe(1);
    useSimStore.getState().advance(tp); // t = 2: the glitch
    expect(useSimStore.getState().sim!.value('o1:out')).toBe(0);
    useSimStore.getState().advance(tp); // t = 3: back to 1
    expect(useSimStore.getState().sim!.value('o1:out')).toBe(1);
    expect(useSimStore.getState().playing).toBe(false); // at rest, so the clock stops
    expect(wave('o1:out')).toBe('0:1 2:0 3:1');
  });

  it('faster speed covers more simulated time per real ms', () => {
    useSimStore.getState().setSpeed(4);
    useSimStore.getState().flip('S0');
    useSimStore.getState().advance(MS_PER_TYPICAL_TP / 2); // 2 Tp at ×4
    expect(useSimStore.getState().sim!.now).toBe(20);
  });

  it('keeps real time across many short frames', () => {
    useSimStore.getState().flip('S0');
    for (let i = 0; i < 36; i++) useSimStore.getState().advance(1000 / 60); // 600 ms at 60 fps
    expect(useSimStore.getState().sim!.now).toBe(10); // exactly one Tp
  });

  it('pause stops time and step jumps to the next change', () => {
    useSimStore.getState().flip('S0');
    useSimStore.getState().pause();
    useSimStore.getState().advance(10_000);
    expect(useSimStore.getState().sim!.now).toBe(0);
    const times: number[] = [];
    while (!useSimStore.getState().sim!.idle) {
      useSimStore.getState().step();
      times.push(useSimStore.getState().sim!.now / 10);
    }
    expect(times).toEqual([0, 1, 2, 3]);
  });

  it('skip to end runs until the circuit is at rest', () => {
    useSimStore.getState().flip('S0');
    useSimStore.getState().skipToEnd();
    const { sim, playing } = useSimStore.getState();
    expect(sim!.idle).toBe(true);
    expect(playing).toBe(false);
    expect(sim!.value('o1:out')).toBe(1);
    expect(wave('o1:out')).toBe('0:1 2:0 3:1');
  });
});

describe('structure signature', () => {
  it('ignores switch values and positions', () => {
    const a = structuredClone(mux2FromGates);
    const b = structuredClone(mux2FromGates);
    b.components[0].props = { value: 0 };
    b.components[3].position = { x: 999, y: 999 };
    expect(structureSignature(a)).toBe(structureSignature(b));
  });

  it('changes when a Tp or a wire changes', () => {
    const a = structuredClone(mux2FromGates);
    const b = structuredClone(mux2FromGates);
    b.components.find((c) => c.id === 'n1')!.delay = 2;
    expect(structureSignature(a)).not.toBe(structureSignature(b));
    const c = structuredClone(mux2FromGates);
    c.wires.pop();
    expect(structureSignature(a)).not.toBe(structureSignature(c));
  });

  it('typical Tp is the median gate delay', () => {
    expect(typicalTpTicks(mux2FromGates)).toBe(10);
  });
});
