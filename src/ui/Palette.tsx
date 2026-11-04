import type { DragEvent } from 'react';
import { CATALOG } from '../model';
import type { ComponentType } from '../model';
import { PALETTE_LABEL } from './labels';

/** MIME type used to carry a component type from the palette to the canvas. */
export const DRAG_MIME = 'application/x-circuitmaker-component';

const GROUPS: { title: string; types: ComponentType[] }[] = [
  { title: 'כניסות ויציאות', types: ['INPUT', 'OUTPUT', 'CONST0', 'CONST1', 'CLOCK'] },
  { title: 'שערים', types: ['AND', 'OR', 'NOT', 'NAND', 'NOR', 'XOR', 'XNOR', 'BUF'] },
  {
    title: 'רכיבים צירופיים',
    types: [
      'HALF_ADDER',
      'FULL_ADDER',
      'MUX2',
      'MUX4',
      'MUX8',
      'MUX16',
      'DEC2x4',
      'DEC3x8',
      'ENC4x2',
      'PRIORITY_ENC4x2',
    ],
  },
  {
    title: 'רכיבים עקיבים',
    types: ['D_FF', 'T_FF', 'JK_FF', 'SR_FF', 'SR_LATCH', 'D_LATCH', 'REGISTER4', 'COUNTER4'],
  },
];

const buttonLabel = (type: ComponentType) =>
  CATALOG[type].category === 'gate' ? type : (PALETTE_LABEL[type] ?? CATALOG[type].label);

interface PaletteProps {
  onAdd: (type: ComponentType) => void;
}

export function Palette({ onAdd }: PaletteProps) {
  const onDragStart = (event: DragEvent, type: ComponentType) => {
    event.dataTransfer.setData(DRAG_MIME, type);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <aside className="palette" aria-label="ספריית רכיבים">
      <h2>רכיבים</h2>
      <p className="hint">גוררים למשטח, או לוחצים כדי להוסיף.</p>
      {GROUPS.map((group) => (
        <section key={group.title}>
          <h3>{group.title}</h3>
          <div className="palette-grid">
            {group.types.map((type) => (
              <button
                key={type}
                type="button"
                className="palette-item"
                draggable
                onDragStart={(e) => onDragStart(e, type)}
                onClick={() => onAdd(type)}
                title={CATALOG[type].label}
              >
                {buttonLabel(type)}
              </button>
            ))}
          </div>
        </section>
      ))}
    </aside>
  );
}
