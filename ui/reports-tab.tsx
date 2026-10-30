import { useStrings } from '../i18n/index.ts';

/** Position reports UI arrives with T6; an empty state until then. */
export function ReportsTab() {
  const t = useStrings();
  return <p className="ms-card p-6 text-sm text-muted-foreground">{t.reportsEmpty}</p>;
}
