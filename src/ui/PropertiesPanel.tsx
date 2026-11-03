import { useState } from 'react';
import { CATALOG } from '../model';
import type { Component } from '../model';
import { useCircuitStore } from '../store/circuitStore';

interface PropertiesPanelProps {
  component: Component | null;
}

export function PropertiesPanel({ component }: PropertiesPanelProps) {
  return (
    <aside className="properties" aria-label="מאפייני רכיב">
      <h2>מאפיינים</h2>
      {component ? (
        // key resets the draft value when another component is selected
        <ComponentFields key={component.id} component={component} />
      ) : (
        <p className="hint">בחרו רכיב כדי לערוך את ה-Tp ואת מספר הכניסות.</p>
      )}
    </aside>
  );
}

function ComponentFields({ component }: { component: Component }) {
  const updateComponent = useCircuitStore((s) => s.updateComponent);
  const removeComponents = useCircuitStore((s) => s.removeComponents);
  const timeUnit = useCircuitStore((s) => s.circuit.timeUnit);
  const [delayText, setDelayText] = useState(String(component.delay));
  const def = CATALOG[component.type];
  const hasDelay = def.category !== 'io';

  const commitDelay = () => {
    const value = Number(delayText);
    if (!updateComponent(component.id, { delay: value })) setDelayText(String(component.delay));
  };

  return (
    <div className="fields">
      <p className="field-title">
        {def.label} · <bdi>{component.id}</bdi>
      </p>

      {hasDelay && (
        <label className="field">
          <span>Tp {timeUnit !== 'none' && `(${timeUnit})`}</span>
          <input
            type="number"
            min={0}
            step={0.1}
            dir="ltr"
            value={delayText}
            onChange={(e) => setDelayText(e.target.value)}
            onBlur={commitDelay}
            onKeyDown={(e) => e.key === 'Enter' && commitDelay()}
          />
        </label>
      )}

      {def.minInputs !== def.maxInputs && (
        <label className="field">
          <span>מספר כניסות</span>
          <select
            value={component.inputs}
            onChange={(e) => updateComponent(component.id, { inputs: Number(e.target.value) })}
          >
            {Array.from(
              { length: def.maxInputs - def.minInputs + 1 },
              (_, i) => def.minInputs + i,
            ).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      )}

      <button type="button" className="danger" onClick={() => removeComponents([component.id])}>
        מחיקת הרכיב
      </button>
    </div>
  );
}
