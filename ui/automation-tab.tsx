import { useStrings } from '../i18n/index.ts';

/** Automation rules UI arrives with T5; an empty state until then. */
export function AutomationTab() {
  const t = useStrings();
  return <p className="ms-card p-6 text-sm text-muted-foreground">{t.automationEmpty}</p>;
}
