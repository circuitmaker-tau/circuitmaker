/**
 * Share the circuit as a link (the circuit is inside the address). An optional
 * note is shown to whoever opens it, in the "what you learn here" box: handy
 * for a usability task or an exercise.
 */
import { useEffect, useRef, useState } from 'react';
import { encodeShare, shareUrl } from '../persistence/shareLink';
import { useCircuitStore } from '../store/circuitStore';

/** Longer than this, some chat apps may cut the link. */
const LONG_LINK = 8000;

export function ShareDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const circuit = useCircuitStore((s) => s.circuit);
  const lesson = useCircuitStore((s) => s.lesson);
  const [note, setNote] = useState('');
  const [link, setLink] = useState<{ for: string; url: string } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  // the link follows the circuit and the note; it is built in the background
  const key = open ? JSON.stringify([circuit, note]) : '';
  useEffect(() => {
    if (!open) return;
    let live = true;
    void encodeShare(circuit, note).then((data) => {
      if (live) setLink({ for: key, url: shareUrl(data) });
    });
    return () => {
      live = false;
    };
  }, [open, key, circuit, note]);

  const url = link?.for === key ? link.url : '';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      // no clipboard (an old browser or no permission): select it for Ctrl+C
      field.current?.select();
    }
  };

  return (
    <dialog
      ref={dialog}
      className="share-dialog"
      dir="rtl"
      aria-labelledby="share-title"
      onClose={() => {
        setCopied(false);
        onClose();
      }}
      onClick={(e) => e.target === dialog.current && onClose()}
    >
      <form method="dialog" onSubmit={(e) => e.preventDefault()}>
        <h2 id="share-title">שיתוף בקישור</h2>
        <p className="hint">
          המעגל נמצא בתוך הקישור עצמו, בלי שרת. מי שפותח אותו מקבל עותק של המעגל כמו שהוא עכשיו, ושינויים
          שלו לא משפיעים אצלך.
        </p>
        <label className="field">
          <span>הסבר או משימה למי שפותח (לא חובה)</span>
          <textarea
            rows={3}
            value={note}
            placeholder={lesson ? 'אפשר להעתיק לכאן את ההסבר של הדוגמה' : 'למשל: שנו את S0 ומדדו את משך הריצוד'}
            onChange={(e) => {
              setNote(e.target.value);
              setCopied(false);
            }}
          />
        </label>
        {lesson && !note && (
          <button type="button" className="share-use-lesson" onClick={() => setNote(lesson)}>
            להוסיף את ההסבר של הדוגמה
          </button>
        )}
        <label className="field">
          <span>הקישור</span>
          <input ref={field} type="text" dir="ltr" readOnly value={url} onFocus={(e) => e.target.select()} aria-label="הקישור" />
        </label>
        {url.length > LONG_LINK && (
          <p className="hint">
            הקישור ארוך ({url.length.toLocaleString('he-IL')} תווים), וחלק מאפליקציות ההודעות עלולות לקצר
            אותו. למעגל גדול עדיף ייצוא JSON.
          </p>
        )}
        <div className="from-actions">
          <button type="button" className="primary" onClick={() => void copy()} disabled={!url}>
            {copied ? 'הועתק ✓' : 'העתקת הקישור'}
          </button>
          <button type="button" onClick={onClose}>
            סגירה
          </button>
        </div>
      </form>
    </dialog>
  );
}
