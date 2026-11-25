/**
 * The user guide in English. The same sections, ids and facts as the Hebrew
 * guide in Help.tsx; when one changes, the other changes with it.
 */
export function HelpBodyEn() {
  return (
    <>
      <h1>User guide</h1>
      <p className="lead">
        CircuitMaker simulates digital circuits with a delay for every component, by the rules of
        the course Introduction to Hardware. Build a circuit, set the Tp, and watch the change
        travel through the wires, the timing diagram and the hazards.
      </p>

      <section id="start">
        <h2>Quick start</h2>
        <ol>
          <li>
            Open the editor and pick &quot;MUX 2:1 from gates&quot; in the <b>Course examples</b>{' '}
            menu. The properties panel shows &quot;What to learn here&quot;.
          </li>
          <li>
            Click the switch <b>S0</b>. The change moves on gate after gate, and at t = 2 the lamp F
            goes out for a moment.
          </li>
          <li>In the timing diagram, at the bottom, the glitch is framed and measured: 1 ns.</li>
          <li>
            The <b>Hazard analysis</b> tab shows why it happened on a Karnaugh map. Click &quot;Add
            the term&quot;, run it again, and the glitch is gone.
          </li>
        </ol>
      </section>

      <section id="build">
        <h2>Building a circuit</h2>
        <ul>
          <li>
            <b>Adding:</b> drag a component from the list to the canvas, or click it and it goes
            into a free spot.
          </li>
          <li>
            <b>Wiring:</b> drag from an output point (on the right of a component) to an input point
            (on the left). Wires are straight with 90° turns, and where two wires cross without a
            connection there is a small hop.
          </li>
          <li>
            <b>Deleting:</b> select a component or a wire and press Delete, or click &quot;Delete
            the component&quot; in the properties.
          </li>
          <li>
            <b>Undo and redo:</b> ↶ and ↷ in the top bar, or Ctrl+Z and Ctrl+Shift+Z (Cmd on a Mac).
            Every edit can be undone, loading an example over a circuit too. Flipping a switch is
            running, not editing, so it does not go into the history.
          </li>
          <li>
            <b>Several components at once:</b> Shift and a drag on the background select a
            rectangle, and Ctrl+A selects everything. Ctrl+C and Ctrl+V copy and paste, and Ctrl+D
            duplicates. The wires between the selected components are copied with them.
          </li>
          <li>
            <b>Image:</b> the button with the arrow next to the zoom buttons saves the whole circuit
            as a PNG, and &quot;Image&quot; in the timing diagram saves the whole diagram. Handy for
            homework and reports.
          </li>
          <li>
            <b>Properties</b> (click a component):
            <ul>
              <li>
                A name, as in the question: X0, Cin, S. A Latin letter followed by letters, digits
                or _. The wires, the timing diagram and the analysis follow the new name.
              </li>
              <li>Tp, in steps of 0.1, and the number of inputs of a gate (2–4).</li>
              <li>
                The initial value of Q for a flip-flop (default 0) and a latch (default X, unknown).
              </li>
              <li>
                A flip-flop can get the asynchronous inputs CLR&apos; and PRE&apos;, active at 0 as
                on the slides: 0 on CLR&apos; clears Q at once, without waiting for the clock, and 0
                on PRE&apos; sets it to 1. Such an input with nothing connected to it is inactive.
              </li>
              <li>
                A flip-flop, register or counter responds to the <b>rising clock edge</b> (0 → 1) or
                to the <b>falling clock edge</b> (1 → 0). With a falling edge there is a circle
                before the CLK triangle, as on the slides.
              </li>
              <li>
                <b>Enable:</b> a MUX, register or counter can get an En input. When it is 0, the MUX
                gives 0, the register does not load and the counter does not count. Any En (of a
                decoder and an encoder too) can be made active at 0, and then it gets a circle.
              </li>
              <li>
                For a clock: the half period and the level at the start. With the defaults the clock
                rises at t = 1, 3, 5, as in the exams.
              </li>
              <li>
                For a switch: <b>scheduled changes</b>, e.g. <code>5:0 10:1</code> (falls to 0 at t
                = 5, rises at 10). That is how to rebuild a question like &quot;B rises at t =
                30&quot;.
              </li>
              <li>Which outputs of the component appear in the timing diagram.</li>
            </ul>
          </li>
          <li>
            The <b>circuit name</b> is edited in the top bar. The <b>time unit</b> is saved with the
            circuit.
          </li>
        </ul>
      </section>

      <section id="run">
        <h2>Running</h2>
        <ul>
          <li>
            <b>Clicking a switch</b> starts a run. At speed ×1 a typical Tp lasts 0.6 seconds, so
            you see every gate respond.
          </li>
          <li>
            <b>The delay is inside the component:</b> a wire passes its value on at once, and the
            delay happens in the component. During the Tp a bar at the bottom of the component fills
            in the color of the new value, and only when it is full does the output (and the wire
            after it) change.
          </li>
          <li>
            <b>Pause and resume</b>; <b>Step</b> jumps to the next change; <b>Skip to end</b> runs
            until every change on its way has arrived; <b>Cycle</b> (when there is a clock) moves
            one clock cycle ahead; <b>Reset time</b> goes back to t = 0.
          </li>
          <li>
            <b>Breakpoints:</b> write a time in &quot;Stop at t =&quot;, and the run (and &quot;Skip
            to end&quot; too) stops exactly there, with every change of that moment. &quot;At the
            end of every cycle&quot; stops at the end of every clock cycle. That way you can freeze
            a moment and check every value.
          </li>
          <li>
            Any change to the structure (a component, a wire, a Tp) starts the run again from the
            steady state. Clicking a switch does not.
          </li>
          <li>
            <b>Messages:</b> oscillation, the forbidden state of an SR flip-flop (S = R = 1) and a
            race in an SR latch are shown at the bottom of the canvas.
          </li>
        </ul>
      </section>

      <section id="timing">
        <h2>Timing diagram</h2>
        <ul>
          <li>
            Time runs from left to right. Every signal has its own color; an unknown value (X) is a
            grey band.
          </li>
          <li>
            A circuit with up to 10 signals shows them all. In a bigger one: clocks, switches, Q and
            lamps. Add another signal from the properties of its component.
          </li>
          <li>
            <b>A click</b> sets a cursor and shows the value of every signal at that time.{' '}
            <b>Shift + click</b> sets a second cursor and shows Δt.
          </li>
          <li>
            <b>Zoom</b> with the + and − buttons, or Ctrl + wheel. &quot;All&quot; shows the whole
            run.
          </li>
          <li>
            <b>A glitch</b> is marked with a dashed frame and its width: a pulse whose two edges
            were caused by the same input change. A pulse that is only copied from an input is not
            marked.
          </li>
          <li>Change the height of the panel by dragging its top edge.</li>
        </ul>
      </section>

      <section id="truth">
        <h2>Truth table and circuit from an expression</h2>
        <ul>
          <li>
            <b>Truth table</b> (a tab in the bottom panel): every combination of the switches and
            the value of every lamp. The row of the switches right now is highlighted, and clicking
            a row sets the switches to it, so the change runs in the circuit and in the diagram.
          </li>
          <li>
            For every lamp: the list of minterms (Σm), a minimal sum of products and a minimal
            product of sums, as a Karnaugh map gives them. That is the shortest expression, not
            necessarily what is built in the circuit.
          </li>
          <li>
            <b>From expression</b> (in the top bar): write a function as in the course, e.g. F =
            X0X1 + X1&apos;X2, Z = (A&apos; + B)(B&apos; + C) or F(A,B,C,D) = Σ(2,3,4,5,10,11,15) +
            d(14). A prime is NOT, juxtaposition is AND, + is OR, ⊕ or ^ is XOR. Π(…) for maxterms
            and a range like d(10–15) work too.
          </li>
          <li>
            Choose how to build it: as written (a gate for every operation, so the hazards are those
            of the expression you wrote), a minimal sum of products or product of sums, or a sum of
            minterms. A gate wider than 4 inputs is built as a tree. The new circuit replaces the
            current one, and Ctrl+Z brings it back.
          </li>
          <li>
            <b>Request a circuit</b> (in the top bar): fill in a sentence, &quot;Build [a full
            adder, a half adder, majority of 3, a comparison, or a function of your own] with
            [AND/OR/NOT, NAND only, NOR only, a MUX and an inverter, MUX 2:1 only, a decoder and OR]
            with fan-in up to [2, 3, 4]&quot;. The circuit is built by the course&apos;s method
            (NAND-NAND, NOR-NOR, the last variable on the MUX inputs, Shannon expansion with MUX
            2:1, the minterms of the decoder), a product used by several outputs is built once, and
            the circuit is checked in simulation on every row before it loads.
          </li>
        </ul>
      </section>

      <section id="expressions">
        <h2>The Boolean expressions world</h2>
        <ul>
          <li>
            The worlds row under the top bar switches between <b>Circuits</b> (the editor) and{' '}
            <b>Boolean expressions</b>, <b>Karnaugh maps</b>, <b>State machines</b> and{' '}
            <b>ROM and PLA</b>.
          </li>
          <li>
            Write the same function in two ways, e.g. A + BC and (A + B)(A + C), and see at once
            whether they are equivalent. The check goes over every row of the truth table of the
            variables of both expressions together.
          </li>
          <li>
            When they are not equivalent, a counterexample appears: a combination of the variables
            on which the expressions give different values. Every row that differs is marked in the
            truth table. A row where one of the expressions is d does not count as a difference.
          </li>
          <li>
            A list without variables, like Σ(1,2,3), is numbered over the variables of the other
            expression. For every expression its list of minterms and a minimal sum of products are
            shown, and &quot;Open as a circuit&quot; builds it in the editor (Ctrl+Z brings the
            previous circuit back).
          </li>
        </ul>
      </section>

      <section id="karnaugh">
        <h2>The Karnaugh maps world</h2>
        <ul>
          <li>
            Pick a new question (3 or 4 variables, with d or without) or write a function of your
            own, e.g. F(A,B,C,D) = Σ(0,2,5,7,8,10,13,15).
          </li>
          <li>
            <b>Filling the map:</b> clicking a cell cycles through 1, 0 and d, or type 1, 0 or d.
            The rows and columns are in the course&apos;s order: 00, 01, 11, 10. &quot;Check&quot;
            marks in red every cell that is wrong, and &quot;Cell numbers&quot; shows the number of
            the minterm in every cell.
          </li>
          <li>
            <b>Groups:</b> choose whether you group 1s (sum of products) or 0s (product of sums),
            select cells and click &quot;Add group&quot;. A group that is not a rectangle of 1, 2, 4
            or 8 cells, or that holds another value, is refused with an explanation. A group can
            wrap around the edge of the map, and the four corners are one group.
          </li>
          <li>
            &quot;Check&quot; says which cells are not covered yet, which group can grow (and why),
            which one is redundant, and whether the cover is right but a shorter one exists.
            &quot;Show a solution&quot; shows a minimal cover.
          </li>
        </ul>
      </section>

      <section id="fsm">
        <h2>The state machines world</h2>
        <ul>
          <li>
            Pick a machine: the bamba (WK9B), the 0101 detector (WK9A), the airplane machine (2026,
            A), or <b>the circuit in the editor</b> (up to 3 flip-flops of type D, T, JK or SR and
            up to 2 switches). The equations of the machine are shown, and &quot;Open the circuit in
            the editor&quot; shows it.
          </li>
          <li>
            <b>A state table</b> as in the lecture: a row for every present state (PS), and for
            every value of the input, the next state (NS) and the output. &quot;Check&quot; marks
            every wrong cell in red. The answers are computed from the circuit itself, so they are
            right for a circuit you built too.
          </li>
          <li>
            <b>A state diagram:</b> click the source state and then the target state (the same state
            twice: a loop), choose an input and an output and add an arrow, written x/z as in the
            course. &quot;Check&quot; says which arrow goes to the wrong state, which one has a
            wrong output, which is doubled and which are missing.
          </li>
        </ul>
      </section>

      <section id="rom">
        <h2>The ROM and PLA world</h2>
        <ul>
          <li>
            Pick a question from the course (f and g from the lecture, a 2-bit adder, a full adder,
            2022 B, 2024 B, slide 25 of WK11A) or write functions of your own, one per line (up to 4
            variables and 4 functions).
          </li>
          <li>
            <b>ROM:</b> the decoder is fixed, and in the OR array you burn (●) a connection in every
            row where the output is 1. Write the size of the ROM too (words × bits).
            &quot;Check&quot; marks a wrong connection and checks the size.
          </li>
          <li>
            <b>PLA:</b> every row is a product. Clicking a variable cycles through not connected,
            the variable and its complement; in the OR plane, connect a product to outputs.
            &quot;Check&quot; says which output is wrong and on which combination, which product is
            redundant or doubled, and whether fewer products (p) would do. The smallest p is found
            by a full search, so it includes products shared between the functions.
          </li>
        </ul>
      </section>

      <section id="inside">
        <h2>What&apos;s inside a component</h2>
        <ul>
          <li>
            Select a ready-made component and click <b>Take apart</b> in the properties panel. The
            component is replaced by the components it is built from in the course, with the same
            connections, and every part can be taken apart again down to gates:
          </li>
          <li>
            A full adder ← two half adders and an OR ← XOR and AND (WK6A). MUX 4:1 ← three MUX 2:1,
            MUX 8:1 ← two MUX 4:1 and a MUX 2:1 (the recursive implementation, WK6B), and MUX 2:1 ←
            NOT, two AND and an OR. A decoder ← an inverter for every input and an AND for every
            output (WK7A). A priority encoder ← gates. A register ← four D-FFs, and a counter ← four
            T-FFs and AND gates (WK8B).
          </li>
          <li>
            Every part gets the Tp of the original component, so after taking it apart you can see
            why the whole component takes longer (in the Critical path tab, for example). Ctrl+Z
            brings the whole component back.
          </li>
        </ul>
      </section>

      <section id="blocks">
        <h2>Your own blocks</h2>
        <ul>
          <li>
            Build something from gates, with <b>switches for inputs</b> and <b>lamps for outputs</b>
            . Select them all (drag a frame or Ctrl+A), write a name in the properties panel and
            click <b>Save as block</b>. The inputs and outputs are named after the switches and
            lamps, in order from top to bottom, so give them names as in the course (I0, I1, S0, f).
          </li>
          <li>
            The block appears in the components bar under <b>My blocks</b>, and is used like any
            other component. For example: a MUX 2:1 from gates, and three of them for a MUX 4:1 (the
            recursive implementation, WK6B); a half adder, and two of them with an OR for a full
            adder (WK6A). A block can hold blocks.
          </li>
          <li>
            Inside the block every gate keeps its own Tp, so the block takes exactly the time of its
            gates, and glitches inside come out too. The Critical path tab shows the path through
            the blocks.
          </li>
          <li>
            <b>Take apart</b> on a block brings back what is inside it. Blocks are saved with the
            circuit, in the JSON file and in a share link, and stay in the bar when you open a new
            circuit.
          </li>
        </ul>
      </section>

      <section id="critical">
        <h2>Critical path</h2>
        <ul>
          <li>
            As in WK5: the <b>Critical path</b> tab finds the longest path from an input to an
            output and marks it in orange in the circuit. The sum of the delays along it is the
            delay of the circuit, and the number of components on the way is the number of levels.
          </li>
          <li>
            Every component counts with the larger of tpLH and tpHL, since that is the worst case. A
            path starts at a switch, a clock or a flip-flop output (after its Tp), and ends at a
            lamp or a flip-flop input.
          </li>
          <li>
            The table shows the longest path to every lamp and every flip-flop input, and clicking a
            row marks it. In a circuit with a clock, the shortest cycle the circuit can work at is
            shown too.
          </li>
          <li>
            A loop of gates without a flip-flop (a latch from gates, for example) has no defined
            critical path.
          </li>
        </ul>
      </section>

      <section id="practice">
        <h2>Practice: guess the timing diagram</h2>
        <ul>
          <li>
            Like the question in every exam: in the <b>Practice</b> tab the clock and the switches
            are given, and you draw the other signals of the timing diagram yourself. Time is split
            into equal slots, so every change falls on the edge of a slot (0.5, for example, when
            the Tp is 0.5).
          </li>
          <li>
            Clicking a slot makes it 0 or 1, and dragging paints several slots. Every signal starts
            at its value at t = 0, as the exam gives it. Clicking the name of a signal switches it
            between &quot;given&quot; and &quot;to draw&quot;.
          </li>
          <li>
            <b>Check</b> marks the wrong slots in red. <b>Show the answer</b> adds the right wave as
            a dashed line, and <b>Run in the diagram</b> runs the circuit and moves to the timing
            diagram so you can see why.
          </li>
          <li>
            With a clock, choose how many cycles to draw. Without a clock you need a switch with
            scheduled changes, and then the practice lasts until the circuit settles.
          </li>
        </ul>
      </section>

      <section id="exercise">
        <h2>Self-practice: build within the limits</h2>
        <ul>
          <li>
            In the <b>Self-practice</b> tab, pick a level (Easy, Medium or Hard) and click{' '}
            <b>New question</b>. The questions are of the kind in the exams: &quot;XOR from NAND
            gates only&quot;, &quot;f with a MUX 4:1 and one inverter&quot;, &quot;a full adder from
            two MUX 4:1&quot;. In most questions the function is drawn at random, so you can
            practise the same question again and again.
          </li>
          <li>
            Switches and a lamp are loaded, and you build between them. Only the components the
            question allows may be used, and there are only the inputs themselves, no complements.
            Your own blocks are allowed, and the parts inside them count.
          </li>
          <li>
            <b>Submit</b> gives a score out of 100: 60 for correctness (by the right rows of the
            truth table), 25 for keeping the limits and 15 for saving components. The notes say on
            which row the circuit is wrong and which limit was broken.
          </li>
          <li>
            <b>Hint</b> gives a direction, and <b>Show a solution</b> loads one possible solution
            (Ctrl+Z brings your circuit back).
          </li>
        </ul>
      </section>

      <section id="analysis">
        <h2>Hazard analysis</h2>
        <ul>
          <li>
            Pick a lamp. The analysis shows the function (Σm) and its structure, and if the circuit
            is two-level, also a Karnaugh map (2–4 variables) with a group for every term.
          </li>
          <li>
            <b>By the structure:</b> in a sum-of-products circuit, two adjacent minterms that no
            term covers together are a static-1 hazard. In a product of sums, the same with zeros:
            static-0. The consensus term is offered.
          </li>
          <li>
            <b>In simulation:</b> every change of one input, at every value of the other inputs,
            with the Tp of the circuit. Hover over a finding, and the two racing paths are
            highlighted in the circuit (blue and fast, yellow and slow).
          </li>
          <li>
            <b>Demo</b> sets the switches and runs the transition in the timing diagram.{' '}
            <b>Add the term</b> adds the gate to the circuit.
          </li>
          <li>
            The analysis is for combinational circuits with up to 6 switches. The map variables are
            ordered as in the course: A is the MSB, and with numbered names the highest number is
            the MSB (X2X1X0).
          </li>
        </ul>
      </section>

      <section id="rules">
        <h2>How the simulation works</h2>
        <p>
          These are the rules the engine keeps, and they match the official solutions of the course:
        </p>
        <dl>
          <dt>Time</dt>
          <dd>
            Tp is entered in steps of 0.1. Inside, time is counted in whole ticks (a tick = 0.1),
            with no rounding errors.
          </dd>
          <dt>Delay (transport)</dt>
          <dd>
            Every change at an input of a component is computed again, and the new output arrives Tp
            later. A pulse shorter than Tp passes too. With different tpLH and tpHL, a rise takes
            tpLH and a fall tpHL; a new value that arrives before an old one cancels it.
          </dd>
          <dt>The same time</dt>
          <dd>
            All the changes that arrive at the same time are applied together, and only then are the
            components computed.
          </dd>
          <dt>flip-flop</dt>
          <dd>
            Responds to the rising clock edge (0 → 1), and samples its inputs{' '}
            <b>just before the edge</b>, as in the solution of exam 2026 B. The output changes at t
            + Tp. The equations are as on the formula sheet: D-FF <code>Q(t+1) = D</code>, T-FF{' '}
            <code>T ⊕ y</code>, JK-FF <code>J·y&apos; + K&apos;·y</code>, SR-FF{' '}
            <code>S + R&apos;·y</code>.
          </dd>
          <dt>latch</dt>
          <dd>
            Responds at once (after Tp). SR latch: S = R = 1 gives Q = Q&apos; = 0, and if both fall
            together Q is unknown. A D latch is transparent when En = 1.
          </dd>
          <dt>Start</dt>
          <dd>
            A run starts from the steady state of the circuit: switches and constants at their
            values, flip-flops at their initial value, and everything else computed without delays.
          </dd>
          <dt>X</dt>
          <dd>
            An unconnected input or a latch that was never set is X. 0 at an AND input gives 0 even
            with an X, and 1 at an OR input gives 1. In an XOR any X gives X. A MUX with an X select
            gives a value only if all the inputs it could pick are equal.
          </dd>
          <dt>Oscillation</dt>
          <dd>
            A loop without delay (over 1000 rounds at the same time) stops the run. A wire that
            changes more than 50 times with no change at the inputs gets a warning, and the run goes
            on.
          </dd>
        </dl>
        <p className="note">
          The engine was checked against Icarus Verilog on 525 circuits (56,789 transitions, all
          identical) and against the official solutions of the exam questions.
        </p>
      </section>

      <section id="marks">
        <h2>Notation</h2>
        <ul>
          <li>
            On the canvas: <span className="sig1">1 green</span>,{' '}
            <span className="sig0">0 red</span>, <span className="sigx">X orange</span>. The lamp is
            lit at 1.
          </li>
          <li>
            Port names as in the 2026 exams: indexed from 0, and 0 is the LSB (S0, I0, D0, Q0). On
            the slides the index starts at 1.
          </li>
          <li>A triangle at the CLK input marks a component that responds to an edge.</li>
          <li>Under every gate: its formula (x·y, x+y, x&apos;), its name and its Tp.</li>
        </ul>
      </section>

      <section id="save">
        <h2>Saving and sharing</h2>
        <ul>
          <li>
            The circuit is saved automatically in this browser. The next time you open it, it comes
            back, with the speed and the bottom panel as you left them.
          </li>
          <li>
            Browser data can be cleared. To keep a circuit for good, or to move it to another
            computer, use <b>Export JSON</b> and <b>Import JSON</b>.
          </li>
          <li>
            <b>Share</b> gives a link with the circuit inside it, and you can add an explanation or
            a task that whoever opens it will see. They get a copy; if they had another circuit
            open, Ctrl+Z brings it back.
          </li>
          <li>
            The app can be installed: on a phone, &quot;Add to Home Screen&quot; in the
            browser&apos;s share menu; on a computer, the install icon in the address bar. After the
            first visit it opens without internet too.
          </li>
          <li>
            There is no server and there are no accounts: the circuit does not leave your computer,
            unless you send a share link or a JSON file.
          </li>
        </ul>
      </section>

      <section id="keys">
        <h2>Keys</h2>
        <ul>
          <li>Delete or Backspace: delete the selection.</li>
          <li>Wheel or two fingers: move and zoom the canvas.</li>
          <li>Ctrl + wheel on the diagram: zoom in time.</li>
          <li>Shift + click on the diagram: a second cursor.</li>
          <li>Enter in the Tp field or in the scheduled changes: save.</li>
        </ul>
      </section>
    </>
  );
}
