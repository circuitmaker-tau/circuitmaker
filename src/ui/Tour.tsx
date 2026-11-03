/**
 * A short guided tour of the editor, shown once on the first visit and again
 * from the guide. Each step lights up one part of the screen and says what it
 * is for. Steps whose part is hidden (on a phone) are skipped.
 */
import { useEffect, useState } from 'react';
import { TOUR_STEPS as STEPS, useTourStore } from '../store/tourStore';

function visibleBox(selector: string): DOMRect | null {
  const el = document.querySelector(selector);
  if (!el) return null;
  const box = el.getBoundingClientRect();
  return box.width > 0 && box.height > 0 ? box : null;
}

export function Tour() {
  const step = useTourStore((s) => s.step);
  const { next, stop } = useTourStore.getState();
  const [box, setBox] = useState<DOMRect | null>(null);

  // find the part to light up; skip steps whose part is not on screen
  useEffect(() => {
    if (step === null) return;
    const found = visibleBox(STEPS[step].target);
    if (!found) {
      next();
      return;
    }
    const update = () => setBox(visibleBox(STEPS[step].target));
    const frame = requestAnimationFrame(update);
    window.addEventListener('resize', update);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', update);
    };
  }, [step, next]);

  useEffect(() => {
    if (step === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') stop();
      if (e.key === 'Enter' || e.key === 'ArrowLeft') next();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step, next, stop]);

  if (step === null || !box) return null;
  const s = STEPS[step];
  const pad = 6;
  // the card goes below the part if there is room, otherwise above it
  const below = box.bottom + 180 < window.innerHeight;
  const cardTop = below ? box.bottom + 12 : Math.max(12, box.top - 172);
  const cardLeft = Math.min(Math.max(12, box.left + box.width / 2 - 160), window.innerWidth - 332);

  return (
    <div className="tour" role="dialog" aria-modal="true" aria-label={`סיור: ${s.title}`}>
      <div
        className="tour-spot"
        style={{
          top: box.top - pad,
          left: box.left - pad,
          width: box.width + 2 * pad,
          height: box.height + 2 * pad,
        }}
      />
      <div className="tour-card" style={{ top: cardTop, left: cardLeft }} dir="rtl">
        <p className="tour-count">
          {step + 1} מתוך {STEPS.length}
        </p>
        <h2>{s.title}</h2>
        <p>{s.text}</p>
        <div className="tour-actions">
          <button type="button" onClick={stop}>
            סיום
          </button>
          <button type="button" className="tour-next" onClick={next} autoFocus>
            {step + 1 === STEPS.length ? 'בואו נתחיל' : 'הבא'}
          </button>
        </div>
      </div>
    </div>
  );
}
