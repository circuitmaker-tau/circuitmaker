import { createComponent, createWire } from '../model/factory';
import type { Circuit, Component, ComponentType, TimeUnit } from '../model/types';

type Options = Partial<Omit<Component, 'id' | 'type' | 'position'>>;
export type Part = [id: string, type: ComponentType, x: number, y: number, options?: Options];

/**
 * A compact way to write an example: parts with positions, and wires as
 * "from>to.port", where a bare `from` means its port "out" ("A>nA.in0",
 * "ff.Q'>m.in0").
 */
export function buildCircuit(
  name: string,
  timeUnit: TimeUnit,
  parts: Part[],
  wires: string[],
): Circuit {
  return {
    version: 1,
    name,
    timeUnit,
    components: parts.map(([id, type, x, y, options]) =>
      createComponent(type, id, { x, y }, options),
    ),
    wires: wires.map((spec, i) => {
      const [from, to] = spec.split('>');
      const [fc, fp] = from.split('.');
      const [tc, tp] = to.split('.');
      return createWire(`w${i + 1}`, [fc, fp ?? 'out'], [tc, tp]);
    }),
  };
}
