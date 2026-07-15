import { SYSTEM_RULES } from '../constants/rules';
import { useT } from '../i18n/LocaleContext';

const RULE_ICONS = ['📚', '📅', '🔄', '💰', '📄', '📦', '🔖', '⏳'];

export default function SystemRulesCard({ title, compact = false }) {
  const t = useT();
  const heading = title || t('rules.title');
  const items = [
    { icon: RULE_ICONS[0], text: t('rules.r1', { n: SYSTEM_RULES.maxKitap }) },
    { icon: RULE_ICONS[1], text: t('rules.r2', { n: SYSTEM_RULES.oduncSuresiGun }) },
    { icon: RULE_ICONS[2], text: t('rules.r3', { max: SYSTEM_RULES.maxUzatma, days: SYSTEM_RULES.uzatmaGun }) },
    { icon: RULE_ICONS[3], text: t('rules.r4', { n: SYSTEM_RULES.gecikmeCezasiGunluk }) },
    { icon: RULE_ICONS[4], text: t('rules.r5') },
    { icon: RULE_ICONS[5], text: t('rules.r6') },
    { icon: RULE_ICONS[6], text: t('rules.r7') },
    { icon: RULE_ICONS[7], text: t('rules.r8', { n: SYSTEM_RULES.rezervasyonAlmaSaati }) },
  ];

  if (compact) {
    return (
      <div className="flex flex-wrap gap-2">
        {items.map((r, i) => (
          <span key={i} className="text-xs text-gray-500 bg-dark-700/50 px-2.5 py-1 rounded-full border border-dark-600">
            {r.text}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className="card border-dark-600/80">
      <h3 className="text-sm font-semibold text-gray-300 mb-3">{heading}</h3>
      <ul className="space-y-2">
        {items.map((r, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-gray-400">
            <span className="shrink-0">{r.icon}</span>
            <span>{r.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
