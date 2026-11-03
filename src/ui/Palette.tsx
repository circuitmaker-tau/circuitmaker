import type { DragEvent } from 'react';
import { CATALOG } from '../model';
import type { ComponentType } from '../model';

/** MIME type used to carry a component type from the palette to the canvas. */
export const DRAG_MIME = 'application/x-circuitmaker-component';

/** Milestone 3: basic gates, inputs and outputs. The rest of the library comes in milestone 5. */
const GROUPS: { title: string; types: ComponentType[] }[] = [
  { title: 'כניסות ויציאות', types: ['INPUT', 'OUTPUT', 'CONST0', 'CONST1'] },
  { title: 'שערים', types: ['AND', 'OR', 'NOT', 'NAND', 'NOR', 'XOR', 'XNOR', 'BUF'] },
];

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
                {CATALOG[type].category === 'gate' ? type : CATALOG[type].label}
              </button>
            ))}
          </div>
        </section>
      ))}
    </aside>
  );
}
