/**
 * The examples in English: menu group, menu label and "What to learn here",
 * by example id. The Hebrew texts stay in index.ts, next to the circuits.
 */
export const GROUP_EN: Record<string, string> = {
  'השהיות ו-hazards': 'Delays and hazards',
  'רכיבים צירופיים': 'Combinational components',
  'רכיבים עקיבים': 'Sequential components',
  'דיאגרמות זמנים ממבחנים': 'Timing diagrams from exams',
  'מכונות מצבים (FSM)': 'State machines (FSM)',
};

const PRACTISE =
  ' Before running it, you can try on your own: in the "Practice" tab, draw the diagram and check it.';

export const EXAMPLE_EN: Record<string, { label: string; lesson: string }> = {
  levels: {
    label: "Levels and delays: f = X1'X3 + X2(X3 + X1X0) (WK5, slide 11)",
    lesson:
      'The circuit from slide 11 of lecture 5, with a Tp of 1 for NOT, 2.5 for AND and 2 for OR, in nanoseconds. The "Critical path" tab shows the long path: from X0 or X1 through AND, OR, AND and OR, 2.5 + 2 + 2.5 + 2 = 9 ns, as on the slide. The path through the inverter (path 5 on the slide) is shorter: 1 + 2.5 + 2 = 5.5. Change the Tp of one of the gates and see which path becomes critical.',
  },
  mux2: {
    label: 'MUX 2:1 from gates: a glitch (WK5)',
    lesson:
      "The demonstration from WK5: f = S0'·I0 + S0·I1 from gates, every Tp = 1. Click S0 (from 1 to 0): the inverter lags by one Tp, and meanwhile both AND gates give 0, so F drops to 0 for a moment although the function should stay 1. The timing diagram marks the glitch and measures it.",
  },
  mux2fix: {
    label: 'MUX 2:1 with a consensus term',
    lesson:
      'The same MUX with the consensus term I0·I1 (a third AND gate, a3). Click S0: F stays 1 all the time, because a3 holds the OR while the inverter catches up. That is how a static-1 hazard is fixed.',
  },
  static0: {
    label: 'A static-0 hazard (homework 5)',
    lesson:
      "Z = (A' + B)(B' + C), every delay 10. B rises by itself at t = 30 (a scheduled change, which you can edit in B's properties). Click \"Play\" or \"Skip to end\": Z jumps to 1 from t = 50 to 60 and comes back to 0. That is a static-0 hazard 10 wide, as in the solution.",
  },
  asym: {
    label: 'Different rise and fall delays (recitation 5)',
    lesson:
      'f = AB ⊕ CD. The AND gates rise in 10 and fall in 20, the XOR has a delay of 5. At t = 60 the inputs ABCD go from 1100 to 1011. I2 rises (10) before I1 falls (20), so f drops to 0 from t = 75 to 85. Give the AND gates one delay for both: the glitch is gone.',
  },
  ripple: {
    label: 'A 4-bit ripple-carry adder',
    lesson:
      'Four full adders in a chain: 0011 + 1011 = 1110. Change A0 and see in the timing diagram that each adder settles only after the carry from the one before it has arrived, one Tp per stage. That is the critical path of the adder. What is inside a full adder? Select an FA and click "Take apart": two half adders and an OR, and those can be taken apart into gates too.',
  },
  encoders: {
    label: 'A plain encoder against a priority encoder (WK7A)',
    lesson:
      "The same four switches go into a plain encoder and a priority encoder. With D2 alone on, both give 10. Turn D1 on as well: the plain encoder gives X, because it is defined only when exactly one input is on, and the priority encoder keeps giving 10, the code of the highest input (X1 = D3 + D2, X0 = D3 + D1D2'). Turn everything off: V falls to 0, since no input is on. That is the difference question 2C of exam 2026 A asks about.",
  },
  latch: {
    label: 'An SR latch from two NOR gates (WK7)',
    lesson:
      "At first Q is unknown (X), since nothing has set it. S = 1 sets it to 1, R = 1 resets it, S = R = 0 keeps the value. S = R = 1 gives Q = Q' = 0. To see what happens when both fall together, write the same scheduled changes for S and for R, e.g. 2:1 6:0, and run: the gates start to oscillate.",
  },
  counter: {
    label: 'A 4-bit counter with a clock',
    lesson:
      'The counter counts from 0 to 15, one step at every rising clock edge, then back to 0. "Cycle" moves one clock cycle ahead. RESET = 1 clears it at once, without waiting for the clock (asynchronous), and while it is 1 the counter does not count.',
  },
  ripplecount: {
    label: 'A ripple counter from 4 T-FFs (WK8B)',
    lesson:
      "T = 1 in every T-FF, the clock goes only into the first, and the Q' of each stage is the clock of the next, so the counter counts up. Each stage waits for the one before: click \"Cycle\" up to the step from 7 (0111) to 8 (1000), and see in the diagram that the outputs pass through 6, 4 and 0 before they settle, 4 Tp after the clock edge. That is the drawback of a ripple counter: the delay grows with the number of bits. In the modulo 6 counter, which is synchronous, all the bits change together.",
  },
  mod6: {
    label: "A modulo 6 counter with an asynchronous CLR' (WK8B)",
    lesson:
      "A synchronous 4-bit counter from T-FFs (T0 = 1, T1 = Q0, T2 = Q0Q1, T3 = Q0Q1Q2), with an asynchronous CLR' input that is active low. CLR' = NAND(Q2, Q1): as soon as the counter reaches 6 (0110), the NAND falls to 0 and clears every FF without waiting for the clock. So the counter counts 0 to 5. The diagram shows state 6 for a moment, between the clock edge and the end of the delays of the NAND and of the clearing. CLR' and PRE' can be added to any flip-flop in the properties panel.",
  },
  tff: {
    label: 'A T-FF with Tp = 0.5 (2026 A, 2D)',
    lesson:
      "Without delays Q2 = Q1·Q0' would be the same as Q0'. With Tp = 0.5 for the gates, Q1 lags behind Q0, so Q2 falls early and rises late: every pulse shrinks to 1.5 seconds. Part 2: give the T-FF a delay of 0.5 too, and get the same graph shifted by 0.5." +
      PRACTISE,
  },
  jk: {
    label: "JK with J = K = CLK' (2026 B, 2D)",
    lesson:
      'J and K are the clock through an inverter (Tp 0.5), and the JK has a Tp of 1. The FF samples J and K just before the rising clock edge, so Q toggles at t = 2, 4, 6. Part 3: give every component Tp = 1, and after the first cycle the FF always samples J = K = 0 and Q stays 1.' +
      PRACTISE,
  },
  dff: {
    label: 'A D-FF with feedback (2026 C, 2D)',
    lesson:
      "D = Q' through two inverters with Tp = 1, and the FF has no delay. At t = 3 and at t = 7, D changes exactly at the clock edge, and the FF samples the old value (just before the edge). Part 1: give the inverters Tp = 0 and get a divide-by-2 counter." +
      PRACTISE,
  },
  ffchain: {
    label: 'JK, D and T on one clock (2024 B, 2E)',
    lesson:
      'A JK with J = K = 1 (Q0), a D with D = Q0 (Q1) and a T with T = Q0 (Q2), all on the same clock, starting from 000 with negligible Tp. Click "Cycle" and see in the diagram that Q2Q1Q0 goes 001, 110, 101, 010 and around again: the number repeats, and the sum over one round is 1 + 6 + 5 + 2 = 14, as in the solution. Every FF samples the Q0 of just before the edge, so Q1 is the Q0 of the cycle before.' +
      PRACTISE,
  },
  nandglitch: {
    label: 'An inverter, two NANDs and a NOR (2025 B, 2D)',
    lesson:
      "Q0 = NAND(X, X'), Q1 = NAND(X, X) = X' and Q2 = NOR(Q0, Q1). X toggles every second. Part 1, with every Tp = 0: give the inverter nX a delay of 0, and then Q0 = 1 always and Q2 = 0. Part 2 (as corrected in the solution): only the inverter has Tp = 0.5, which is how the example loads. At every rise of X, both X and X' are 1 for 0.5 seconds, so Q0 falls to 0, and since Q1 = 0 at that time, Q2 has a pulse of 0.5. There is no glitch when X falls." +
      PRACTISE,
  },
  tdt: {
    label: 'T, D and T in a chain (2024 A, 2E)',
    lesson:
      'A T-FF with T = 1 (Q0), a D-FF with D = Q0 (Q1) and a T-FF with T = Q1 (Q2), all on the same clock, starting from 000 with negligible Tp. Click "Cycle": Q2Q1Q0 goes 001, 010, 101, 110 and back to 001. So the smallest number the circuit gives is 1 and the largest 6, as in the solution (000 appears only at the start).' +
      PRACTISE,
  },
  down: {
    label: 'A down counter from 4 JKs (2025 A, 2D)',
    lesson:
      "A synchronous down counter: J0 = K0 = 1, and the J and K of each stage are the AND of the Q' of the stages before it. From 0000 it counts 1111, 1110, 1101 and so on. \"Cycle\" moves one edge ahead, and the diagram shows every Q." +
      PRACTISE,
  },
  bamba: {
    label: 'The bamba machine with two T-FFs (WK9B)',
    lesson:
      "The design from the lecture: a good bamba is 2 or 3 cycles of X = 1, and then Z = 1 for one cycle. a = 00 no bamba, b = 01, c = 10, d = 11. From the maps: T1 = x'y1 + xy2, T2 = x + y2, z = x'y1 (a Mealy machine, and the AND gate of z is used in T1 too). X changes by itself in the middle of every cycle, by the sequence of homework 9: bambas of 1, 2, 3 and 4 cycles. Click \"Cycle\" again and again and see in the diagram that Z jumps only after the bamba of 2 and the one of 3, as in the solution, and y1 y2 go a → b → c → a.",
  },
  plane: {
    label: 'The 737-MAX airplane machine with two SR-FFs (2026 A)',
    lesson:
      "Question 3 of exam 2026 A, with the equations of the solution: S1 = XL'XR' + y2XL' + y2XR', R1 = XLXR + y2'XR + y2'XL, S2 = y2'XR' + y2'XL', R2 = y2XR + y2XL, Z = y2'XR' + y2'XL' + XL'XR'. Both sensors working (11): Z = 0. One sensor faulty: Z alternates 1010…. Both faulty (00): Z = 1. XL and XR change by themselves every cycle, by the sequence in the question, and reading Z just before every rising clock edge gives the output sequence of the exam. Note that y1 is in no equation, so (part 3D) a single T-FF is enough.",
  },
  detector: {
    label: 'The 0101 sequence detector with JK and D (WK9A)',
    lesson:
      "The analysis from the lecture: J = xy2, K = x + y2', D = x'y2' + y1'y2, z = xy1y2'. Run the sequence (X changes by itself every cycle) and follow y1 y2 in the diagram: a → b → d → c, and Z = 1 when the last 1 of 0101 arrives, also after arbitrary input. After detecting, the machine goes back to a, so in 010101 it detects only once. You can edit the sequence in the scheduled changes of X and check.",
  },
};
