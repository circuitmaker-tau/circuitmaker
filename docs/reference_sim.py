"""Reference event-driven simulator for CircuitMaker test cases.

Semantics (match PROJECT_MASTER / COMPONENT_SPEC):
- transport delay: every computed output change is scheduled at t + delay (rise/fall may differ)
- events at the same timestamp are applied together ("delta" step), then affected gates re-evaluated
- edge-triggered FF samples its data inputs with the values they had *just before* the edge
  (i.e. before applying any event of the same timestamp), output changes at t_edge + tp
- time is in ticks (integers); TICKS = 10 per unit, so Tp=0.5 -> 5 ticks
"""
import heapq
from collections import defaultdict

TICKS = 10


class Sim:
    def __init__(self):
        self.val = {}          # net -> 0/1/'X'
        self.gates = []        # (fn, inputs, output, rise, fall)
        self.ffs = []          # dict(kind, clk, ins, q, qn, tp)
        self.fanout = defaultdict(list)
        self.ev = []           # heap (time, seq, net, value)
        self.seq = 0
        self.trace = defaultdict(list)
        self.clocks = []

    def net(self, n, v):
        self.val[n] = v
        self.trace[n].append((0, v))

    def gate(self, fn, ins, out, d, fall=None):
        g = (fn, ins, out, d, d if fall is None else fall)
        self.gates.append(g)
        for i in ins:
            self.fanout[i].append(('g', g))

    def ff(self, kind, clk, ins, q, qn, tp, q0):
        f = dict(kind=kind, clk=clk, ins=ins, q=q, qn=qn, tp=tp, state=q0)
        self.ffs.append(f)
        self.fanout[clk].append(('f', f))
        self.net(q, q0)
        if qn:
            self.net(qn, 1 - q0)

    def clock(self, n, half, until):
        self.net(n, 0)
        t, v = half, 1
        while t <= until:
            self.sched(t, n, v)
            v ^= 1
            t += half

    def sched(self, t, n, v):
        self.seq += 1
        heapq.heappush(self.ev, (t, self.seq, n, v))

    def run(self, until):
        while self.ev and self.ev[0][0] <= until:
            t = self.ev[0][0]
            batch = []
            while self.ev and self.ev[0][0] == t:
                batch.append(heapq.heappop(self.ev))
            before = dict(self.val)               # values just before t
            changed = []
            for _, _, n, v in batch:              # transport: last scheduled wins at same t
                if self.val.get(n) != v:
                    self.val[n] = v
                    changed.append(n)
            changed = list(dict.fromkeys(n for n in changed if self.val[n] != before.get(n)))
            for n in changed:
                self.trace[n].append((t, self.val[n]))
            for n in changed:
                for kind, obj in self.fanout[n]:
                    if kind == 'g':
                        fn, ins, out, rise, fall = obj
                        nv = fn(*[self.val[i] for i in ins])
                        d = rise if nv == 1 else fall
                        self.sched(t + d, out, nv)
                    elif kind == 'f' and before.get(n) == 0 and self.val[n] == 1:
                        f = obj
                        x = [before[i] for i in f['ins']]   # sample just before the edge
                        y = f['state']
                        if f['kind'] == 'D': ny = x[0]
                        elif f['kind'] == 'T': ny = y ^ x[0]
                        elif f['kind'] == 'JK': ny = (x[0] & (1 - y)) | ((1 - x[1]) & y)
                        elif f['kind'] == 'SR': ny = x[0] | ((1 - x[1]) & y)
                        f['state'] = ny
                        self.sched(t + f['tp'], f['q'], ny)
                        if f['qn']:
                            self.sched(t + f['tp'], f['qn'], 1 - ny)

    def wave(self, n):
        return ' '.join(f"{t/TICKS:g}:{v}" for t, v in self.trace[n])


NOT = lambda a: 1 - a
AND = lambda *a: int(all(a))
OR = lambda *a: int(any(a))
XOR = lambda a, b: a ^ b
T = lambda x: int(round(x * TICKS))


# ============================================================
# Test cases (python3 reference_sim.py)
# ============================================================
if __name__ == "__main__":
    
    
    def case(name):
        print(f"\n=== {name}")
    
    
    # TC-H1: WK5 lecture hazard F = X0X1 + X1'X2, all Tp=1, X0=X2=1, X1 1->0 at t=5
    case("TC-H1 WK5 static-1 hazard, Tp=1")
    for fix in (False, True):
        s = Sim()
        s.net('X0', 1); s.net('X2', 1); s.net('X1', 1)
        s.net('nX1', 0); s.net('a1', 1); s.net('a2', 0); s.net('a3', 1); s.net('F', 1)
        s.gate(NOT, ['X1'], 'nX1', T(1))
        s.gate(AND, ['X0', 'X1'], 'a1', T(1))
        s.gate(AND, ['nX1', 'X2'], 'a2', T(1))
        if fix:
            s.gate(AND, ['X0', 'X2'], 'a3', T(1))
            s.gate(OR, ['a1', 'a2', 'a3'], 'F', T(1))
        else:
            s.gate(OR, ['a1', 'a2'], 'F', T(1))
        s.sched(T(5), 'X1', 0)
        s.run(T(20))
        print(' fixed' if fix else ' original', '| F =', s.wave('F'), '| nX1 =', s.wave('nX1'), '| a1 =', s.wave('a1'), '| a2 =', s.wave('a2'))
    
    # TC-H2: HW5 Q4: X = A'+B, Y = B'+C, Z = X*Y, all delays 10; A=1, C=0, B 0->1 at 30
    case("TC-H2 HW5 Q4 static-0 hazard, delay 10")
    s = Sim()
    s.net('A', 1); s.net('B', 0); s.net('C', 0)
    s.net('nA', 0); s.net('nB', 1); s.net('X', 0); s.net('Y', 1); s.net('Z', 0)
    s.gate(NOT, ['A'], 'nA', 100)
    s.gate(NOT, ['B'], 'nB', 100)
    s.gate(OR, ['nA', 'B'], 'X', 100)
    s.gate(OR, ['nB', 'C'], 'Y', 100)
    s.gate(AND, ['X', 'Y'], 'Z', 100)
    s.sched(300, 'B', 1)
    s.run(1000)
    for n in 'BXYZ':
        print(f" {n} =", s.wave(n))
    
    # TC-H3: Rec5: f = AB xor CD, tpHL(AND)=20 tpLH(AND)=10 XOR=5, ABCD 1100 -> 1011 at 60
    case("TC-H3 Rec5 asymmetric delays f = AB xor CD")
    s = Sim()
    for n, v in zip('ABCD', (1, 1, 0, 0)): s.net(n, v)
    s.net('I1', 1); s.net('I2', 0); s.net('f', 1)
    s.gate(AND, ['A', 'B'], 'I1', 100, fall=200)
    s.gate(AND, ['C', 'D'], 'I2', 100, fall=200)
    s.gate(XOR, ['I1', 'I2'], 'f', 50)
    for n, v in zip('ABCD', (1, 0, 1, 1)):
        if s.val[n] != v: s.sched(600, n, v)
    s.run(2000)
    for n in ['I1', 'I2', 'f']:
        print(f" {n} =", s.wave(n))
    
    # TC-T1: 2026A Q2D: T-FF(T=1) Q0 -> NOT -> Q1; Q2 = AND(Q1, Q0'); CLK half-period 1s
    for tpff in (0, 0.5):
        case(f"TC-T1 2026A Q2D, Tp(T-FF)={tpff}, Tp(gates)=0.5")
        s = Sim()
        s.clock('CLK', T(1), T(12))
        s.net('one', 1)
        s.ff('T', 'CLK', ['one'], 'Q0', 'nQ0', T(tpff), 0)
        s.net('Q1', 1); s.net('Q2', 1)
        s.gate(NOT, ['Q0'], 'Q1', T(0.5))
        s.gate(AND, ['Q1', 'nQ0'], 'Q2', T(0.5))
        s.run(T(12))
        for n in ['CLK', 'Q0', 'Q1', 'Q2']:
            print(f" {n} =", s.wave(n))
    
    # TC-T2: 2026B Q2D: J = K = NOT(CLK) via two inverters, JK-FF, Q=0, J=K=1 at start
    for tinv, tff in ((0, 0), (0.5, 1), (1, 1)):
        case(f"TC-T2 2026B Q2D, Tp(inv)={tinv}, Tp(JK)={tff}")
        s = Sim()
        s.clock('CLK', T(1), T(12))
        s.net('J', 1); s.net('K', 1)
        s.gate(NOT, ['CLK'], 'J', T(tinv))
        s.gate(NOT, ['CLK'], 'K', T(tinv))
        s.ff('JK', 'CLK', ['J', 'K'], 'Q', None, T(tff), 0)
        s.run(T(12))
        for n in ['CLK', 'J', 'Q']:
            print(f" {n} =", s.wave(n))
    
    # TC-T3: 2026C Q2D: D-FF; D = NOT(NOT(Q')) (two inverters); Q1 = NOT(Q). Q1=0 (Q=1), D=0 at start
    for tinv, tff in ((0, 0), (1, 0), (1, 1)):
        case(f"TC-T3 2026C Q2D, Tp(inv)={tinv}, Tp(D-FF)={tff}")
        s = Sim()
        s.clock('CLK', T(1), T(16))
        s.ff('D', 'CLK', ['D'], 'Q', 'nQ', T(tff), 1)
        s.net('m', 1); s.net('D', 0); s.net('Q1', 0)
        s.gate(NOT, ['nQ'], 'm', T(tinv))
        s.gate(NOT, ['m'], 'D', T(tinv))
        s.gate(NOT, ['Q'], 'Q1', T(tinv))
        s.run(T(16))
        for n in ['CLK', 'D', 'Q1']:
            print(f" {n} =", s.wave(n))
    
    # TC-S1: 2025A Q2D: 4 JK down counter (J=K chain from Q')
    case("TC-S1 2025A Q2D 4-bit JK down counter, Tp=0")
    s = Sim()
    s.clock('CLK', T(1), T(14))
    s.net('one', 1)
    s.ff('JK', 'CLK', ['one', 'one'], 'Q0', 'n0', 0, 0)
    s.ff('JK', 'CLK', ['n0', 'n0'], 'Q1', 'n1', 0, 0)
    s.net('a1', 1); s.net('a2', 1)
    s.gate(AND, ['n0', 'n1'], 'a1', 0)
    s.ff('JK', 'CLK', ['a1', 'a1'], 'Q2', 'n2', 0, 0)
    s.gate(AND, ['a1', 'n2'], 'a2', 0)
    s.ff('JK', 'CLK', ['a2', 'a2'], 'Q3', 'n3', 0, 0)
    s.run(T(14))
    seq = []
    for k in range(0, 7):
        tt = T(1) + k * T(2) + 1
        v = {}
        for n in ['Q3', 'Q2', 'Q1', 'Q0']:
            last = 0
            for (t, x) in s.trace[n]:
                if t <= tt: last = x
            v[n] = last
        seq.append(''.join(str(v[n]) for n in ['Q3', 'Q2', 'Q1', 'Q0']))
    print(" Q3Q2Q1Q0 after each rising edge:", seq)
    
    # TC-F1: Bamba FSM (WK9B, T-FF): T1 = x'y1 + x y2, T2 = x + y2, z = x'y1 ; HW9 example sequence
    case("TC-F1 Bamba FSM (T-FF) on HW9 sequence")
    X = [0,1,0,1,1,0,0,0,1,1,1,0,0,1,1,1,1,0,0]
    y1 = y2 = 0; Z = []
    for x in X:
        z = (1 - x) & y1
        t1 = ((1 - x) & y1) | (x & y2); t2 = x | y2
        Z.append(z); y1 ^= t1; y2 ^= t2
    print(" X =", X); print(" Z =", Z)
    print(" expected (HW9) =", [0,0,0,0,0,1,0,0,0,0,0,1,0,0,0,0,0,0,0])
    
    # TC-F1b same with JK (HW9 solution): J1 = x y2, K1 = x' + y2, J2 = x, K2 = 1
    y1 = y2 = 0; Z2 = []
    for x in X:
        z = (1 - x) & y1
        j1, k1, j2, k2 = x & y2, (1 - x) | y2, x, 1
        Z2.append(z)
        y1 = (j1 & (1 - y1)) | ((1 - k1) & y1)
        y2 = (j2 & (1 - y2)) | ((1 - k2) & y2)
    print(" JK version Z =", Z2)
    
    # TC-F2: WK9A analysis (JK + D): J = x y2, K = x + y2', D = x'y2' + y1'y2, z = x y1 y2'
    case("TC-F2 WK9A analysis, inputs from lecture")
    for seqs in ([0,0,0,0], [0,0,1,0], [0,1,0,1], [1,1,0,1], [1,1,0,1,0,1]):
        y1 = y2 = 0; zs = []
        for x in seqs:
            z = x & y1 & (1 - y2)
            J, K, D = x & y2, x | (1 - y2), ((1 - x) & (1 - y2)) | ((1 - y1) & y2)
            zs.append(z)
            y1, y2 = (J & (1 - y1)) | ((1 - K) & y1), D
        print(" x =", seqs, "-> z =", zs)
