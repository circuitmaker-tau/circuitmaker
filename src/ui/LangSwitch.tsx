/** Hebrew or English for the whole site, at the top of every page. */
import { setLang } from '../i18n/lang';
import './worlds.css';
import type { Lang } from '../i18n/lang';
import { useLang } from '../i18n/useLang';

const OPTIONS: { id: Lang; label: string; name: string }[] = [
  { id: 'he', label: 'עב', name: 'עברית' },
  { id: 'en', label: 'EN', name: 'English' },
];

export function LangSwitch() {
  const lang = useLang();
  return (
    <span className="lang-switch" role="group" aria-label="שפה / Language">
      {OPTIONS.map((o) => (
        <button
          key={o.id}
          type="button"
          lang={o.id}
          aria-pressed={lang === o.id}
          aria-label={o.name}
          title={o.name}
          onClick={() => setLang(o.id)}
        >
          {o.label}
        </button>
      ))}
    </span>
  );
}
