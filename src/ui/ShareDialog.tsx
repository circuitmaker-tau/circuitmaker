/**
 * Share the circuit as a link (the circuit is inside the address). An optional
 * note is shown to whoever opens it, in the "what you learn here" box: handy
 * for a usability task or an exercise.
 */
import { useEffect, useRef, useState } from 'react';
import { encodeShare, shareUrl } from '../persistence/shareLink';
import { useCircuitStore } from '../store/circuitStore';
import { textDir, tr } from '../i18n/lang';

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
      dir={textDir()}
      aria-labelledby="share-title"
      onClose={() => {
        setCopied(false);
        onClose();
      }}
      onClick={(e) => e.target === dialog.current && onClose()}
    >
      <form method="dialog" onSubmit={(e) => e.preventDefault()}>
        <h2 id="share-title">{tr('שיתוף בקישור', 'Share as a link')}</h2>
        <p className="hint">
          {tr(
            'המעגל נמצא בתוך הקישור עצמו, בלי שרת. מי שפותח אותו מקבל עותק של המעגל כמו שהוא עכשיו, ושינויים שלו לא משפיעים אצלך.',
            'The circuit is inside the link itself, with no server. Whoever opens it gets a copy of the circuit as it is now, and their changes do not affect yours.',
          )}
        </p>
        <label className="field">
          <span>{tr('הסבר או משימה למי שפותח (לא חובה)', 'An explanation or a task for whoever opens it (optional)')}</span>
          <textarea
            rows={3}
            value={note}
            placeholder={
              lesson
                ? tr('אפשר להעתיק לכאן את ההסבר של הדוגמה', "You can copy the example's explanation here")
                : tr('למשל: שנו את S0 ומדדו את משך הריצוד', 'e.g. change S0 and measure how long the glitch is')
            }
            onChange={(e) => {
              setNote(e.target.value);
              setCopied(false);
            }}
          />
        </label>
        {lesson && !note && (
          <button type="button" className="share-use-lesson" onClick={() => setNote(lesson)}>
            {tr('להוסיף את ההסבר של הדוגמה', "Add the example's explanation")}
          </button>
        )}
        <label className="field">
          <span>{tr('הקישור', 'The link')}</span>
          <input
            ref={field}
            type="text"
            dir="ltr"
            readOnly
            value={url}
            onFocus={(e) => e.target.select()}
            aria-label={tr('הקישור', 'The link')}
          />
        </label>
        {url.length > LONG_LINK && (
          <p className="hint">
            {tr(
              `הקישור ארוך (${url.length.toLocaleString('he-IL')} תווים), וחלק מאפליקציות ההודעות עלולות לקצר אותו. למעגל גדול עדיף ייצוא JSON.`,
              `The link is long (${url.length.toLocaleString('en-US')} characters), and some messaging apps may cut it. For a big circuit, export JSON instead.`,
            )}
          </p>
        )}
        <div className="from-actions">
          <button type="button" className="primary" onClick={() => void copy()} disabled={!url}>
            {copied ? tr('הועתק ✓', 'Copied ✓') : tr('העתקת הקישור', 'Copy the link')}
          </button>
          <button type="button" onClick={onClose}>
            {tr('סגירה', 'Close')}
          </button>
        </div>
      </form>
    </dialog>
  );
}
