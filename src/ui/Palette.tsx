import type { DragEvent } from 'react';
import { CATALOG } from '../model';
import type { BlockDef, ComponentType } from '../model';
import { useCircuitStore } from '../store/circuitStore';
import { labelOf } from '../i18n/components';
import { tr } from '../i18n/lang';
import { paletteLabel } from './labels';

/** MIME type used to carry a component type from the palette to the canvas. */
export const DRAG_MIME = 'application/x-circuitmaker-component';
/** The same for one of the student's own blocks (carries its name). */
export const BLOCK_MIME = 'application/x-circuitmaker-block';

const GROUPS: { title: [string, string]; types: ComponentType[] }[] = [
  { title: ['כניסות ויציאות', 'Inputs and outputs'], types: ['INPUT', 'OUTPUT', 'CONST0', 'CONST1', 'CLOCK'] },
  { title: ['שערים', 'Gates'], types: ['AND', 'OR', 'NOT', 'NAND', 'NOR', 'XOR', 'XNOR', 'BUF'] },
  {
    title: ['רכיבים צירופיים', 'Combinational'],
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
    title: ['רכיבים עקיבים', 'Sequential'],
    types: ['D_FF', 'T_FF', 'JK_FF', 'SR_FF', 'SR_LATCH', 'D_LATCH', 'REGISTER4', 'COUNTER4'],
  },
];

const buttonLabel = (type: ComponentType) =>
  CATALOG[type].category === 'gate' ? type : (paletteLabel(type) ?? labelOf(type));

interface PaletteProps {
  onAdd: (type: ComponentType) => void;
  onAddBlock?: (name: string) => void;
  blocks?: readonly BlockDef[];
}

export function Palette({ onAdd, onAddBlock, blocks = [] }: PaletteProps) {
  const onDragStart = (event: DragEvent, type: ComponentType) => {
    event.dataTransfer.setData(DRAG_MIME, type);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <aside className="palette" aria-label={tr('ספריית רכיבים', 'Component library')}>
      <h2>{tr('רכיבים', 'Components')}</h2>
      <p className="hint">{tr('גוררים למשטח, או לוחצים כדי להוסיף.', 'Drag onto the canvas, or click to add.')}</p>
      {GROUPS.map((group) => (
        <section key={group.title[1]}>
          <h3>{tr(...group.title)}</h3>
          <div className="palette-grid">
            {group.types.map((type) => (
              <button
                key={type}
                type="button"
                className="palette-item"
                draggable
                onDragStart={(e) => onDragStart(e, type)}
                onClick={() => onAdd(type)}
                title={labelOf(type)}
              >
                {buttonLabel(type)}
              </button>
            ))}
          </div>
        </section>
      ))}
      <section className="palette-mine">
        <h3>{tr('הבלוקים שלי', 'My blocks')}</h3>
        {blocks.length === 0 ? (
          <p className="hint">
            {tr(
              'בונים משהו משערים, עם מתגים לכניסות ונורות ליציאות, בוחרים את כולם ולוחצים ״שמירה כבלוק״.',
              'Build something from gates, with switches for inputs and lamps for outputs, select it all and click "Save as block".',
            )}
          </p>
        ) : (
          <div className="palette-grid">
            {blocks.map((b) => (
              <span key={b.name} className="palette-block">
                <button
                  type="button"
                  className="palette-item"
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData(BLOCK_MIME, b.name);
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                  onClick={() => onAddBlock?.(b.name)}
                  title={tr(
                    `${b.name}: כניסות ${b.inputs.join(', ')}, יציאות ${b.outputs.join(', ')}`,
                    `${b.name}: inputs ${b.inputs.join(', ')}, outputs ${b.outputs.join(', ')}`,
                  )}
                >
                  <bdi>{b.name}</bdi>
                </button>
                <button
                  type="button"
                  className="palette-remove"
                  aria-label={tr(`מחיקת הבלוק ${b.name}`, `Delete the block ${b.name}`)}
                  title={tr('מחיקת הבלוק מהרשימה', 'Delete the block from the list')}
                  onClick={() => useCircuitStore.getState().deleteBlock(b.name)}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </section>
    </aside>
  );
}
