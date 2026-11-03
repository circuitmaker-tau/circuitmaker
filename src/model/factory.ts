import { CATALOG } from './catalog';
import { CIRCUIT_VERSION } from './types';
import type { Circuit, Component, ComponentType, Position, TimeUnit, Wire } from './types';

export function createCircuit(name = 'מעגל חדש', timeUnit: TimeUnit = 'ns'): Circuit {
  return { version: CIRCUIT_VERSION, name, timeUnit, components: [], wires: [] };
}

/** A component of the given type with the catalog defaults filled in. */
export function createComponent(
  type: ComponentType,
  id: string,
  position: Position = { x: 0, y: 0 },
  overrides: Partial<Omit<Component, 'id' | 'type'>> = {},
): Component {
  const def = CATALOG[type];
  const component: Component = {
    id,
    type,
    position,
    delay: def.defaultDelay,
    inputs: def.minInputs,
    ...overrides,
  };
  if (type === 'CLOCK' && component.props === undefined) {
    component.props = { halfPeriod: 1, startLevel: 0 };
  }
  if (type === 'INPUT' && component.props === undefined) {
    component.props = { value: 0 };
  }
  return component;
}

export function createWire(
  id: string,
  from: [component: string, port: string],
  to: [component: string, port: string],
): Wire {
  return {
    id,
    from: { component: from[0], port: from[1] },
    to: { component: to[0], port: to[1] },
  };
}

/** The smallest unused id of the form `<prefix><n>`, e.g. g1, g2, w7. */
export function nextId(prefix: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  let n = 1;
  while (used.has(`${prefix}${n}`)) n++;
  return `${prefix}${n}`;
}
