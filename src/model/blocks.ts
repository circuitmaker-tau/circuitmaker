/**
 * The student's own blocks: select part of a circuit, with switches for its
 * inputs and lamps for its outputs, and save it as a block (for example a
 * MUX 2:1 built from gates, then three of them for a MUX 4:1, as in WK6B).
 *
 * For the engine, a block is replaced by what is inside it (flattening): the
 * parts are named "B1/x", the switch of an input is replaced by whatever
 * drives that input outside, and each output of the block (net "B1:f") is the
 * net that fed the lamp inside. So every inner gate keeps its own Tp, and the
 * block takes exactly as long as the gates it is made of.
 */
import { outputsOfComponent } from './catalog';
import type { BlockDef, Circuit, Component, Position, Wire } from './types';

export const BLOCK_NAME_MAX = 16;

/** Why a name cannot be used for a new block, or null. */
export function blockNameProblem(name: string, circuit: Circuit): string | null {
  const n = name.trim();
  if (!n) return 'כותבים שם לבלוק, למשל MUX2.';
  if (n.length > BLOCK_NAME_MAX) return `השם ארוך מדי (עד ${BLOCK_NAME_MAX} תווים).`;
  if (/[:/#]/.test(n)) return 'בשם של בלוק אי אפשר להשתמש ב-: / #.';
  if ((circuit.blocks ?? []).some((b) => b.name === n)) return `כבר יש בלוק בשם ${n}.`;
  return null;
}

export type BlockResult = { ok: true; block: BlockDef } | { ok: false; error: string };

const byPlace = (a: Component, b: Component) => a.position.y - b.position.y || a.position.x - b.position.x;

/** A block from the selected components: switches are its inputs, lamps its outputs. */
export function blockFromSelection(circuit: Circuit, ids: readonly string[], name: string): BlockResult {
  const problem = blockNameProblem(name, circuit);
  if (problem) return { ok: false, error: problem };
  const keep = new Set(ids);
  const parts = circuit.components.filter((c) => keep.has(c.id));
  const inputs = parts.filter((c) => c.type === 'INPUT').sort(byPlace);
  const outputs = parts.filter((c) => c.type === 'OUTPUT').sort(byPlace);
  if (inputs.length === 0 || outputs.length === 0) {
    return {
      ok: false,
      error: 'בבלוק צריכים להיות מתגים (הכניסות שלו) ונורות (היציאות שלו). בוחרים גם אותם.',
    };
  }
  if (parts.length === inputs.length + outputs.length) {
    return { ok: false, error: 'בבלוק צריך להיות גם משהו בין המתגים לנורות.' };
  }
  // positions from the top left corner, for when the block is taken apart again
  const x0 = Math.min(...parts.map((c) => c.position.x));
  const y0 = Math.min(...parts.map((c) => c.position.y));
  return {
    ok: true,
    block: {
      name: name.trim(),
      inputs: inputs.map((c) => c.id),
      outputs: outputs.map((c) => c.id),
      components: structuredClone(parts).map((c) => ({
        ...c,
        position: { x: c.position.x - x0, y: c.position.y - y0 },
      })),
      wires: structuredClone(
        circuit.wires.filter((w) => keep.has(w.from.component) && keep.has(w.to.component)),
      ),
    },
  };
}

/** A component that uses a saved block. */
export function blockInstance(def: BlockDef, id: string, position: Position): Component {
  return {
    id,
    type: 'BLOCK',
    position,
    delay: 0,
    inputs: def.inputs.length,
    props: { block: def.name, pins: { in: [...def.inputs], out: [...def.outputs] } },
  };
}

export const blockOf = (circuit: Circuit, c: Component): BlockDef | undefined =>
  c.type === 'BLOCK' ? (circuit.blocks ?? []).find((b) => b.name === c.props?.block) : undefined;

/** How deep blocks may sit inside blocks (a block cannot hold itself). */
const MAX_DEPTH = 16;

export interface Flat {
  /** The circuit with every block replaced by its parts. */
  circuit: Circuit;
  /** Each output of a block ("B1:f"), and the net inside that drives it ('' when nothing does). */
  aliases: [string, string][];
}

/** Replace every block with its parts (see the comment at the top). */
export function flattenBlocks(circuit: Circuit): Flat {
  if (!circuit.components.some((c) => c.type === 'BLOCK')) return { circuit, aliases: [] };
  let components = circuit.components;
  let wires = circuit.wires;
  const aliases: [string, string][] = [];
  const defs = new Map((circuit.blocks ?? []).map((b) => [b.name, b]));

  for (let round = 0; round < MAX_DEPTH; round++) {
    const blocks = components.filter((c) => c.type === 'BLOCK');
    if (blocks.length === 0) break;
    const gone = new Set(blocks.map((b) => b.id));
    const nextComponents = components.filter((c) => !gone.has(c.id));
    // wires into a block are replaced by the block's insides; wires out of it read its output nets
    const nextWires = wires.filter((w) => !gone.has(w.to.component));

    for (const inst of blocks) {
      const def = defs.get(inst.props?.block ?? '');
      const outsideNet = new Map(
        wires
          .filter((w) => w.to.component === inst.id)
          .map((w) => [w.to.port, [w.from.component, w.from.port] as [string, string]]),
      );
      if (!def) {
        // a missing definition: its outputs are unknown
        for (const o of outputsOfComponent(inst)) aliases.push([`${inst.id}:${o}`, '']);
        continue;
      }
      const pinIn = new Set(def.inputs);
      const pinOut = new Set(def.outputs);
      const p = (id: string) => `${inst.id}/${id}`;
      for (const c of def.components) {
        if (pinIn.has(c.id) || pinOut.has(c.id)) continue;
        nextComponents.push({ ...c, id: p(c.id) });
      }
      /** Where an inner output really comes from, outside names included. */
      const source = (component: string, port: string): [string, string] | null =>
        pinIn.has(component) ? (outsideNet.get(component) ?? null) : [p(component), port];
      for (const w of def.wires) {
        if (pinOut.has(w.to.component)) continue;
        const from = source(w.from.component, w.from.port);
        if (!from) continue; // an input of the block that is not connected: X inside
        nextWires.push({
          id: p(w.id),
          from: { component: from[0], port: from[1] },
          to: { component: p(w.to.component), port: w.to.port },
        });
      }
      for (const o of def.outputs) {
        const w = def.wires.find((x) => x.to.component === o);
        const from = w ? source(w.from.component, w.from.port) : null;
        aliases.push([`${inst.id}:${o}`, from ? `${from[0]}:${from[1]}` : '']);
      }
    }
    components = nextComponents;
    wires = nextWires;
  }
  return { circuit: { ...circuit, components, wires }, aliases };
}

/**
 * The flat circuit with every wire that reads a block output moved to the
 * part that really drives it, for analyses that follow wires (critical path).
 */
export function flattenForAnalysis(circuit: Circuit): Circuit {
  const { circuit: flat, aliases } = flattenBlocks(circuit);
  if (aliases.length === 0) return flat;
  const alias = new Map(aliases);
  const resolve = (net: string): string => {
    for (let i = 0; i < MAX_DEPTH && alias.has(net); i++) net = alias.get(net)!;
    return alias.has(net) ? '' : net;
  };
  const wires: Wire[] = [];
  for (const w of flat.wires) {
    const net = resolve(`${w.from.component}:${w.from.port}`);
    if (!net) continue;
    const cut = net.lastIndexOf(':');
    wires.push({ ...w, from: { component: net.slice(0, cut), port: net.slice(cut + 1) } });
  }
  return { ...flat, wires };
}

/** Blocks used by these components, and by the blocks inside them. */
export function blocksUsedBy(circuit: Circuit, components: readonly Component[]): BlockDef[] {
  const defs = new Map((circuit.blocks ?? []).map((b) => [b.name, b]));
  const used = new Map<string, BlockDef>();
  const visit = (list: readonly Component[], depth: number) => {
    if (depth > MAX_DEPTH) return;
    for (const c of list) {
      const def = c.type === 'BLOCK' ? defs.get(c.props?.block ?? '') : undefined;
      if (def && !used.has(def.name)) {
        used.set(def.name, def);
        visit(def.components, depth + 1);
      }
    }
  };
  visit(components, 0);
  return [...used.values()];
}

