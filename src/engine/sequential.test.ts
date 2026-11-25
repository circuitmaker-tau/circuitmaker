/**
 * Flip-flops, latches, the clock, registers and counters, against the exam
 * questions in TEST_CIRCUITS.md (TC-T1 to TC-T3, TC-S1, TC-S2). Every
 * expected waveform was computed by reference_sim.py and checked against the
 * official solutions. Format: "time:value" in time units.
 */
import { describe, expect, it } from 'vitest';
import { createCircuit, createComponent, createWire } from '../model';
import type { Circuit, ComponentProps, ComponentType } from '../model';
import { settle } from './settle';
import { Simulator } from './simulator';

const wave = (sim: Simulator, net: string) =>
  sim
    .trace(net)
    .map((t) => `${t.time / 10}:${t.value}`)
    .join(' ');

/** Value of a net at a given time (in units), read from its trace. */
const at = (sim: Simulator, net: string, time: number) =>
  sim
    .trace(net)
    .filter((t) => t.time <= time * 10)
    .at(-1)?.value;

/** Wires are written "comp.port"; a bare name means the port "out". */
function build(
  parts: [id: string, type: ComponentType, delay?: number, props?: ComponentProps][],
  wires: [from: string, to: string][],
): Circuit {
  const c = createCircuit();
  for (const [id, type, delay, props] of parts) {
    const comp = createComponent(type, id);
    if (delay !== undefined) comp.delay = delay;
    if (props !== undefined) comp.props = { ...comp.props, ...props };
    c.components.push(comp);
  }
  wires.forEach(([from, to], i) => {
    const [fc, fp] = from.split('.');
    const [tc, tp] = to.split('.');
    c.wires.push(createWire(`w${i + 1}`, [fc, fp ?? 'out'], [tc, tp]));
  });
  return c;
}

const run = (c: Circuit, until: number) => {
  const sim = new Simulator(c);
  sim.runUntil(until * 10);
  return sim;
};

describe('clock (E6)', () => {
  it('starts at 0 and toggles every half period: rises at t = 1, 3, 5', () => {
    const sim = run(build([['clk', 'CLOCK']], []), 6);
    expect(wave(sim, 'clk:out')).toBe('0:0 1:1 2:0 3:1 4:0 5:1 6:0');
    expect(sim.idle).toBe(false); // a clock never stops
    expect(sim.quiet).toBe(true); // but nothing else is on its way
  });

  it('honours the start level and a decimal half period', () => {
    const sim = run(build([['clk', 'CLOCK', 0, { halfPeriod: 0.5, startLevel: 1 }]], []), 2);
    expect(wave(sim, 'clk:out')).toBe('0:1 0.5:0 1:1 1.5:0 2:1');
  });
});

describe('TC-T1: T-FF, inverter and AND with Tp = 0.5 (exam 2026A, 2D)', () => {
  // T = 1. Q1 = NOT(Q0), Q2 = AND(Q1, Q0'). Start: Q0 = 0, Q1 = 1, Q2 = 1.
  const circuit = (tpFF: number) =>
    build(
      [
        ['clk', 'CLOCK'],
        ['one', 'CONST1'],
        ['ff', 'T_FF', tpFF, { init: 0 }],
        ['Q1', 'NOT', 0.5],
        ['Q2', 'AND', 0.5],
      ],
      [
        ['one', 'ff.T'],
        ['clk', 'ff.CLK'],
        ['ff.Q', 'Q1.in0'],
        ['Q1', 'Q2.in0'],
        ["ff.Q'", 'Q2.in1'],
      ],
    );

  it('(1) Tp(T-FF) = 0: each Q2 pulse is shortened to 1.5', () => {
    const sim = run(circuit(0), 12);
    expect(wave(sim, 'ff:Q')).toBe('0:0 1:1 3:0 5:1 7:0 9:1 11:0');
    expect(wave(sim, 'Q1:out')).toBe('0:1 1.5:0 3.5:1 5.5:0 7.5:1 9.5:0 11.5:1');
    expect(wave(sim, 'Q2:out')).toBe('0:1 1.5:0 4:1 5.5:0 8:1 9.5:0 12:1');
  });

  it('(2) every Tp = 0.5: the same plot shifted by 0.5', () => {
    const sim = run(circuit(0.5), 10);
    expect(wave(sim, 'ff:Q')).toBe('0:0 1.5:1 3.5:0 5.5:1 7.5:0 9.5:1');
    expect(wave(sim, 'Q1:out')).toBe('0:1 2:0 4:1 6:0 8:1 10:0');
    expect(wave(sim, 'Q2:out')).toBe('0:1 2:0 4.5:1 6:0 8.5:1 10:0');
  });
});

describe('TC-T2: JK-FF with J = K = NOT(CLK) (exam 2026B, 2D)', () => {
  const circuit = (tInv: number, tFF: number) =>
    build(
      [
        ['clk', 'CLOCK'],
        ['J', 'NOT', tInv],
        ['K', 'NOT', tInv],
        ['ff', 'JK_FF', tFF, { init: 0 }],
      ],
      [
        ['clk', 'J.in0'],
        ['clk', 'K.in0'],
        ['J', 'ff.J'],
        ['K', 'ff.K'],
        ['clk', 'ff.CLK'],
      ],
    );

  it('(1) every Tp = 0: Q toggles on every rising edge', () => {
    const sim = run(circuit(0, 0), 8);
    expect(wave(sim, 'J:out')).toBe('0:1 1:0 2:1 3:0 4:1 5:0 6:1 7:0 8:1');
    expect(wave(sim, 'ff:Q')).toBe('0:0 1:1 3:0 5:1 7:0');
  });

  it('(2) Tp(inv) = 0.5, Tp(JK) = 1', () => {
    const sim = run(circuit(0.5, 1), 7);
    expect(wave(sim, 'J:out')).toBe('0:1 1.5:0 2.5:1 3.5:0 4.5:1 5.5:0 6.5:1');
    expect(wave(sim, 'ff:Q')).toBe('0:0 2:1 4:0 6:1');
  });

  it('(3) every Tp = 1: after the first cycle the FF always samples J = K = 0', () => {
    const sim = run(circuit(1, 1), 12);
    expect(wave(sim, 'J:out').startsWith('0:1 2:0 3:1 4:0')).toBe(true);
    expect(wave(sim, 'ff:Q')).toBe('0:0 2:1');
  });
});

describe('TC-T3: D-FF fed back through inverters (exam 2026C, 2D)', () => {
  // D = NOT(NOT(Q')), Q1 = NOT(Q). Start: Q = 1, so Q1 = 0 and D = 0.
  const circuit = (tInv: number, tFF: number) =>
    build(
      [
        ['clk', 'CLOCK'],
        ['ff', 'D_FF', tFF, { init: 1 }],
        ['m', 'NOT', tInv],
        ['D', 'NOT', tInv],
        ['Q1', 'NOT', tInv],
      ],
      [
        ["ff.Q'", 'm.in0'],
        ['m', 'D.in0'],
        ['D', 'ff.D'],
        ['clk', 'ff.CLK'],
        ['ff.Q', 'Q1.in0'],
      ],
    );

  it('(1) every Tp = 0: a divide-by-two', () => {
    const sim = run(circuit(0, 0), 6);
    expect(wave(sim, 'D:out')).toBe('0:0 1:1 3:0 5:1');
    expect(wave(sim, 'Q1:out')).toBe('0:0 1:1 3:0 5:1');
  });

  it('(2) Tp(inv) = 1, Tp(FF) = 0: D changes exactly at the edge and the old value is sampled', () => {
    const sim = run(circuit(1, 0), 16);
    expect(wave(sim, 'D:out')).toBe('0:0 3:1 7:0 11:1 15:0');
    expect(wave(sim, 'Q1:out')).toBe('0:0 2:1 6:0 10:1 14:0');
  });

  it('(3) every Tp = 1', () => {
    const sim = run(circuit(1, 1), 16);
    expect(wave(sim, 'D:out')).toBe('0:0 4:1 8:0 12:1 16:0');
    expect(wave(sim, 'Q1:out')).toBe('0:0 3:1 7:0 11:1 15:0');
  });
});

describe('TC-S1: synchronous down counter from 4 JK-FFs (exam 2025A, 2D)', () => {
  it('counts 1111, 1110, 1101, … from 0000', () => {
    const ff = (id: string): [string, ComponentType, number, ComponentProps] => [
      id,
      'JK_FF',
      0,
      { init: 0 },
    ];
    const c = build(
      [
        ['clk', 'CLOCK'],
        ['one', 'CONST1'],
        ff('j0'),
        ff('j1'),
        ff('j2'),
        ff('j3'),
        ['a1', 'AND', 0],
        ['a2', 'AND', 0],
      ],
      [
        ['one', 'j0.J'],
        ['one', 'j0.K'],
        ["j0.Q'", 'j1.J'],
        ["j0.Q'", 'j1.K'],
        ["j0.Q'", 'a1.in0'],
        ["j1.Q'", 'a1.in1'],
        ['a1', 'j2.J'],
        ['a1', 'j2.K'],
        ['a1', 'a2.in0'],
        ["j2.Q'", 'a2.in1'],
        ['a2', 'j3.J'],
        ['a2', 'j3.K'],
        ...['j0', 'j1', 'j2', 'j3'].map((j): [string, string] => ['clk', `${j}.CLK`]),
      ],
    );
    const sim = run(c, 14);
    const after = (k: number) =>
      ['j3', 'j2', 'j1', 'j0'].map((j) => at(sim, `${j}:Q`, 1 + 2 * k + 0.1)).join('');
    expect([0, 1, 2, 3, 4, 5, 6].map(after)).toEqual([
      '1111',
      '1110',
      '1101',
      '1100',
      '1011',
      '1010',
      '1001',
    ]);
  });
});

describe('TC-S2: homework 7 + 8', () => {
  it('a ripple counter of two JK-FFs counts down 00 → 11 → 10 → 01 → 00', () => {
    const c = build(
      [
        ['clk', 'CLOCK'],
        ['one', 'CONST1'],
        ['j0', 'JK_FF', 0],
        ['j1', 'JK_FF', 0],
      ],
      [
        ['one', 'j0.J'],
        ['one', 'j0.K'],
        ['one', 'j1.J'],
        ['one', 'j1.K'],
        ['clk', 'j0.CLK'],
        ['j0.Q', 'j1.CLK'], // the first stage clocks the second
      ],
    );
    const sim = run(c, 9);
    const state = (t: number) => `${at(sim, 'j1:Q', t)}${at(sim, 'j0:Q', t)}`;
    expect([0, 1.1, 3.1, 5.1, 7.1].map(state)).toEqual(['00', '11', '10', '01', '00']);
  });

  it('an 8-bit ring register starting at 10111110 reads 11101011 after 4 cycles', () => {
    const start = '10111110'; // bit 7 first
    const parts: [string, ComponentType, number, ComponentProps][] = [...start].map((b, i) => [
      `r${7 - i}`,
      'D_FF',
      0,
      { init: Number(b) as 0 | 1 },
    ]);
    const wires: [string, string][] = [];
    for (let i = 0; i < 8; i++) {
      wires.push([`r${i}.Q`, `r${(i + 1) % 8}.D`], ['clk', `r${i}.CLK`]);
    }
    const sim = run(build([['clk', 'CLOCK'], ...parts], wires), 8);
    const read = (t: number) => [7, 6, 5, 4, 3, 2, 1, 0].map((i) => at(sim, `r${i}:Q`, t)).join('');
    expect(read(0)).toBe('10111110');
    expect(read(7.1)).toBe('11101011');
  });
});

describe('flip-flop rules (E4, E7)', () => {
  const single = (type: ComponentType, data: Record<string, 0 | 1>, init: 0 | 1 = 0) =>
    build(
      [
        ['clk', 'CLOCK'],
        ...Object.entries(data).map(([port, v]): [string, ComponentType] => [
          port,
          v === 1 ? 'CONST1' : 'CONST0',
        ]),
        ['ff', type, 0, { init }],
      ],
      [['clk', 'ff.CLK'], ...Object.keys(data).map((p): [string, string] => [p, `ff.${p}`])],
    );

  it('JK: 00 holds, 01 resets, 10 sets, 11 toggles', () => {
    expect(wave(run(single('JK_FF', { J: 0, K: 0 }, 1), 4), 'ff:Q')).toBe('0:1');
    expect(wave(run(single('JK_FF', { J: 0, K: 1 }, 1), 4), 'ff:Q')).toBe('0:1 1:0');
    expect(wave(run(single('JK_FF', { J: 1, K: 0 }), 4), 'ff:Q')).toBe('0:0 1:1');
    expect(wave(run(single('JK_FF', { J: 1, K: 1 }), 4), 'ff:Q')).toBe('0:0 1:1 3:0');
  });

  it('SR: S = R = 1 at an edge is forbidden: Q becomes X with a warning', () => {
    const sim = run(single('SR_FF', { S: 1, R: 1 }), 2);
    expect(wave(sim, 'ff:Q')).toBe('0:0 1:X');
    expect(sim.warnings[0]).toMatchObject({ time: 10, component: 'ff' });
  });

  it('an unconnected data input reads X, so the FF samples X', () => {
    const c = build(
      [
        ['clk', 'CLOCK'],
        ['ff', 'D_FF', 0],
      ],
      [['clk', 'ff.CLK']],
    );
    expect(wave(run(c, 2), "ff:Q'")).toBe('0:1 1:X');
  });

  it('Q and Q’ start from init', () => {
    const { nets } = settle(single('T_FF', { T: 0 }, 1));
    expect(nets.get('ff:Q')).toBe(1);
    expect(nets.get("ff:Q'")).toBe(0);
  });
});

describe('latches', () => {
  /** Drive S and R (or D and En) from switches and flip them at given times. */
  const latch = (type: 'SR_LATCH' | 'D_LATCH', a: string, b: string) =>
    new Simulator(
      build(
        [
          [a, 'INPUT', 0, { value: 0 }],
          [b, 'INPUT', 0, { value: 0 }],
          ['L', type, 1],
        ],
        [
          [a, `L.${a}`],
          [b, `L.${b}`],
        ],
      ),
    );

  it('an SR latch that was never set is X (decision 8)', () => {
    const sim = latch('SR_LATCH', 'S', 'R');
    expect(sim.value('L:Q')).toBe('X');
  });

  it('SR latch: set, hold, reset; S = R = 1 gives Q = Q’ = 0', () => {
    const sim = latch('SR_LATCH', 'S', 'R');
    sim.setNet('S:out', 1, 10);
    sim.setNet('S:out', 0, 30);
    sim.setNet('R:out', 1, 50);
    sim.setNet('S:out', 1, 70);
    sim.runToEnd();
    expect(wave(sim, 'L:Q')).toBe('0:X 2:1 6:0');
    expect(wave(sim, "L:Q'")).toBe('0:X 2:0 6:1 8:0');
  });

  it('SR latch: S and R falling together from 1 is a race, so Q is X', () => {
    const sim = latch('SR_LATCH', 'S', 'R');
    sim.setNet('S:out', 1, 10);
    sim.setNet('R:out', 1, 10);
    sim.setNet('S:out', 0, 30);
    sim.setNet('R:out', 0, 30);
    sim.runToEnd();
    expect(wave(sim, 'L:Q')).toBe('0:X 2:0 4:X');
    expect(sim.warnings).toHaveLength(1);
  });

  it('D latch: transparent while En = 1, holds while En = 0', () => {
    const sim = latch('D_LATCH', 'D', 'En');
    sim.setNet('D:out', 1, 10); // En = 0: nothing happens yet
    sim.setNet('En:out', 1, 20); // Q follows D
    sim.setNet('D:out', 0, 40);
    sim.setNet('En:out', 0, 60); // hold 0
    sim.setNet('D:out', 1, 70);
    sim.runToEnd();
    expect(wave(sim, 'L:Q')).toBe('0:X 3:1 5:0');
  });
});

describe('register and counter', () => {
  it('REGISTER4 loads D0–D3 on each rising edge', () => {
    const c = build(
      [
        ['clk', 'CLOCK'],
        ['d0', 'CONST1'],
        ['d2', 'CONST1'],
        ['zero', 'CONST0'],
        ['r', 'REGISTER4', 0],
      ],
      [
        ['clk', 'r.CLK'],
        ['d0', 'r.D0'],
        ['zero', 'r.D1'],
        ['d2', 'r.D2'],
        ['zero', 'r.D3'],
      ],
    );
    const sim = run(c, 2);
    expect(['r:Q3', 'r:Q2', 'r:Q1', 'r:Q0'].map((n) => sim.value(n)).join('')).toBe('0101');
  });

  it('COUNTER4 counts up and wraps; RESET clears it at once and holds it', () => {
    const c = build(
      [
        ['clk', 'CLOCK'],
        ['rst', 'INPUT', 0, { value: 0 }],
        ['n', 'COUNTER4', 0],
      ],
      [
        ['clk', 'n.CLK'],
        ['rst', 'n.RESET'],
      ],
    );
    const sim = new Simulator(c);
    const count = () =>
      [3, 2, 1, 0].reduce((v, i) => v * 2 + (sim.value(`n:Q${i}`) === 1 ? 1 : 0), 0);
    sim.runUntil(10 * 34); // 17 rising edges: 1, 3, …, 33
    expect(count()).toBe(1); // 17 mod 16
    sim.setNet('rst:out', 1, 345);
    sim.runUntil(10 * 38);
    expect(count()).toBe(0); // cleared at 34.5 and held through the edges at 35 and 37
    sim.setNet('rst:out', 0, 380);
    sim.runUntil(10 * 40);
    expect(count()).toBe(1); // counts again from the edge at 39
  });
});

describe("asynchronous CLR' and PRE' (WK8A, active low)", () => {
  // D = 1 all the time; edges at 1, 3, 5, …; Tp(FF) = 1
  const circuit = (clrAt: [number, 0 | 1][], preAt: [number, 0 | 1][] = []) =>
    build(
      [
        ['CLK', 'CLOCK'],
        ['one', 'CONST1'],
        ['C', 'INPUT', 0, { value: 1, schedule: clrAt.map(([time, value]) => ({ time, value })) }],
        ['P', 'INPUT', 0, { value: 1, schedule: preAt.map(([time, value]) => ({ time, value })) }],
        ['ff', 'D_FF', 1, { async: true, init: 0 }],
      ],
      [
        ['one', 'ff.D'],
        ['CLK', 'ff.CLK'],
        ['C', "ff.CLR'"],
        ['P', "ff.PRE'"],
      ],
    );

  it("CLR' = 0 clears Q at once, between clock edges, and holds it while it stays 0", () => {
    const sim = new Simulator(circuit([[3.6, 0], [8, 1]]));
    sim.runUntil(120);
    // Q rises at 1 + 1, is cleared at 3.6 + 1, ignores the edges at 5 and 7, rises after 9
    expect(wave(sim, 'ff:Q')).toBe('0:0 2:1 4.6:0 10:1');
    expect(wave(sim, "ff:Q'")).toBe('0:1 2:0 4.6:1 10:0');
  });

  it("PRE' = 0 sets Q to 1 at once", () => {
    const c = circuit([], [[0.5, 0], [0.8, 1]]);
    c.components.find((x) => x.id === 'ff')!.props = { async: true, init: 0 };
    c.wires = c.wires.filter((w) => w.to.port !== 'D'); // D unconnected is X, so look only before the first edge
    const sim = new Simulator(c);
    sim.runUntil(18);
    expect(wave(sim, 'ff:Q')).toBe('0:0 1.5:1');
  });

  it('both active together is not allowed: Q is X, with a warning', () => {
    const sim = new Simulator(circuit([[2.2, 0]], [[2.2, 0]]));
    sim.runUntil(40);
    expect(at(sim, 'ff:Q', 3.5)).toBe('X');
    expect(sim.warnings.some((w) => w.message.includes('מצב אסור'))).toBe(true);
  });

  it('unconnected, they are inactive: the flip-flop works as without them', () => {
    const c = circuit([]);
    c.wires = c.wires.filter((w) => !w.to.port.endsWith("'"));
    const sim = new Simulator(c);
    sim.runUntil(40);
    expect(wave(sim, 'ff:Q')).toBe('0:0 2:1');
  });

  it('a held CLR\' at the start is applied before t = 0', () => {
    const c = circuit([]);
    c.components.find((x) => x.id === 'ff')!.props = { async: true, init: 1 };
    c.components.find((x) => x.id === 'C')!.props = { value: 0 };
    expect(settle(c).nets.get('ff:Q')).toBe(0);
  });
});

describe('falling clock edge (a bubble on CLK)', () => {
  it('a T flip-flop with T = 1 toggles on the falling edges 2, 4, 6 instead of the rising 1, 3, 5', () => {
    const tff = (falling: boolean) =>
      build(
        [
          ['clk', 'CLOCK'],
          ['one', 'CONST1'],
          ['f', 'T_FF', 0, { init: 0, ...(falling ? { fallingEdge: true } : {}) }],
        ],
        [
          ['one', 'f.T'],
          ['clk', 'f.CLK'],
        ],
      );
    expect(wave(run(tff(false), 6), 'f:Q')).toBe('0:0 1:1 3:0 5:1');
    expect(wave(run(tff(true), 6), 'f:Q')).toBe('0:0 2:1 4:0 6:1');
  });

  it('is the same as a rising-edge flip-flop behind an inverter with Tp = 0', () => {
    const parts = (falling: boolean) =>
      build(
        [
          ['clk', 'CLOCK', undefined, { halfPeriod: 1.5 }],
          ['d', 'INPUT', undefined, { value: 0, schedule: [{ time: 1, value: 1 }, { time: 4, value: 0 }, { time: 7.2, value: 1 }] }],
          ['n', 'NOT', 0],
          ['f', 'D_FF', 1, { init: 0, ...(falling ? { fallingEdge: true } : {}) }],
        ],
        falling
          ? [
              ['d', 'f.D'],
              ['clk', 'f.CLK'],
            ]
          : [
              ['d', 'f.D'],
              ['clk', 'n.in0'],
              ['n', 'f.CLK'],
            ],
      );
    expect(wave(run(parts(true), 12), 'f:Q')).toBe(wave(run(parts(false), 12), 'f:Q'));
    // falls at 3, 6, 9: D was 1 before 3, 0 before 6, 1 before 9, and Q follows 1 later
    expect(wave(run(parts(true), 12), 'f:Q')).toBe('0:0 4:1 7:0 10:1');
  });

  it('a clock going 1 -> X is not a defined falling edge: Q becomes X', () => {
    const c = build(
      [
        ['k', 'INPUT', undefined, { value: 1 }],
        ['f', 'D_FF', 0, { init: 0, fallingEdge: true }],
        ['one', 'CONST1'],
      ],
      [
        ['one', 'f.D'],
        ['k', 'f.CLK'],
      ],
    );
    const sim = new Simulator(c);
    sim.setNet('k:out', 'X');
    sim.runUntil(10);
    expect(sim.value('f:Q')).toBe('X');
  });

  it('settles like the rising-edge one: before time starts nothing is clocked', () => {
    const c = build(
      [
        ['clk', 'CLOCK', undefined, { startLevel: 1 }],
        ['f', 'D_FF', 0, { init: 1, fallingEdge: true }],
      ],
      [['clk', 'f.CLK']],
    );
    expect(settle(c).nets.get('f:Q')).toBe(1);
  });
});

describe('enable inputs: added En, and active low', () => {
  it('a MUX 2:1 with an added En outputs 0 while En = 0, and the selected input while En = 1', () => {
    for (const [en, low, want] of [
      [1, false, 1],
      [0, false, 0],
      [0, true, 1], // active low: En = 0 enables
      [1, true, 0],
    ] as const) {
      const c = build(
        [
          ['i1', 'INPUT', undefined, { value: 1 }],
          ['s', 'INPUT', undefined, { value: 1 }],
          ['e', 'INPUT', undefined, { value: en }],
          ['m', 'MUX2', 0, { enable: true, ...(low ? { enableLow: true } : {}) }],
        ],
        [
          ['i1', 'm.I1'],
          ['s', 'm.S0'],
          ['e', 'm.En'],
        ],
      );
      expect(settle(c).nets.get('m:f')).toBe(want);
    }
  });

  it('an unconnected added En is X, so a MUX output that would be 1 is X and one that would be 0 stays 0', () => {
    const c = build(
      [
        ['i0', 'INPUT', undefined, { value: 1 }],
        ['s', 'INPUT', undefined, { value: 0 }],
        ['m', 'MUX2', 0, { enable: true }],
        ['n', 'MUX2', 0, { enable: true }],
      ],
      [
        ['i0', 'm.I0'],
        ['s', 'm.S0'],
        ['s', 'n.I0'],
        ['s', 'n.S0'],
      ],
    );
    expect(settle(c).nets.get('m:f')).toBe('X');
    expect(settle(c).nets.get('n:f')).toBe(0);
  });

  it('a decoder with an active-low En: all outputs 0 while En = 1, one output 1 while En = 0', () => {
    const dec = (en: 0 | 1) =>
      build(
        [
          ['a', 'INPUT', undefined, { value: 1 }],
          ['e', 'INPUT', undefined, { value: en }],
          ['d', 'DEC2x4', 0, { enableLow: true }],
        ],
        [
          ['a', 'd.I0'],
          ['a', 'd.I1'],
          ['e', 'd.En'],
        ],
      );
    expect(['D0', 'D1', 'D2', 'D3'].map((p) => settle(dec(1)).nets.get(`d:${p}`))).toEqual([0, 0, 0, 0]);
    expect(['D0', 'D1', 'D2', 'D3'].map((p) => settle(dec(0)).nets.get(`d:${p}`))).toEqual([0, 0, 0, 1]);
  });

  it('a counter with an added En counts only while En = 1, and an active-low one while En = 0', () => {
    const counter = (low: boolean) =>
      build(
        [
          ['clk', 'CLOCK'],
          // enabled for the first two rising edges (t = 1, 3), off for the next two (5, 7)
          ['e', 'INPUT', undefined, { value: low ? 0 : 1, schedule: [{ time: 4, value: low ? 1 : 0 }] }],
          ['c', 'COUNTER4', 0, { init: 0, enable: true, ...(low ? { enableLow: true } : {}) }],
        ],
        [
          ['clk', 'c.CLK'],
          ['e', 'c.En'],
        ],
      );
    for (const low of [false, true]) {
      const sim = run(counter(low), 8);
      expect(wave(sim, 'c:Q0')).toBe('0:0 1:1 3:0');
      expect(wave(sim, 'c:Q1')).toBe('0:0 3:1');
    }
  });

  it('a register with an added En loads only while En = 1', () => {
    const c = build(
      [
        ['clk', 'CLOCK'],
        ['d', 'INPUT', undefined, { value: 1, schedule: [{ time: 4, value: 0 }] }],
        ['e', 'INPUT', undefined, { value: 0, schedule: [{ time: 2, value: 1 }, { time: 6, value: 0 }] }],
        ['r', 'REGISTER4', 0, { init: 0, enable: true }],
      ],
      [
        ['clk', 'r.CLK'],
        ['d', 'r.D0'],
        ['e', 'r.En'],
      ],
    );
    // t = 1: En = 0, keeps 0; t = 3: loads 1; t = 5: loads 0; t = 7: En = 0, keeps 0
    expect(wave(run(c, 8), 'r:Q0')).toBe('0:0 3:1 5:0');
  });
});
