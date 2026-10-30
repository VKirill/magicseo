import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRpc } from '@get-bb/plugin-sdk/app';
import { toast } from 'sonner';
import type { rpcContract } from '../server';
import { detectLocale } from '../i18n/index.ts';
import { en, ru } from '../i18n/automation.ts';
import type { SiteConfig } from '../lib/config.ts';
import { resolveCity } from '../lib/cities/index.ts';
import type { ActionResult } from '../lib/automation/executor.ts';
import { toJson } from '../lib/json.ts';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import './automation-tab.css';

type Strings = typeof en;

function useAutomationStrings(): Strings {
  const [value, setValue] = useState<Strings>(() => (detectLocale() === 'ru' ? ru : en));
  useEffect(() => {
    const sync = () => setValue(detectLocale() === 'ru' ? ru : en);
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
    return () => observer.disconnect();
  }, []);
  return value;
}

function errorText(error: unknown, t: Strings): string {
  const raw = error instanceof Error ? error.message : String(error);
  if (/fetch|network|timeout|abort/i.test(raw)) return t.networkError;
  return `${t.error}: ${raw}`;
}

function openAlerts(entries: ActionResult[]): ActionResult[] {
  const open = new Map<string, ActionResult>();
  for (const entry of entries) {
    if (entry.outcome === 'alert') open.set(entry.city, entry);
    else if (entry.outcome === 'done') open.delete(entry.city);
  }
  return [...open.values()];
}

function formatNearest(entry: ActionResult, site: SiteConfig, locale: string): string {
  if (!entry.nearestStartUtc) return '—';
  const resolved = resolveCity(entry.city, {
    aliases: site.cityAliases,
    regionOverrides: site.regionOverrides,
    timeZoneOverrides: site.timeZoneOverrides,
  });
  const timeZone = resolved?.timeZone ?? 'UTC';
  try {
    return new Intl.DateTimeFormat(locale === 'ru' ? 'ru-RU' : 'en-US', {
      dateStyle: 'short',
      timeStyle: 'short',
      timeZone,
    }).format(new Date(entry.nearestStartUtc));
  } catch {
    return entry.nearestStartUtc;
  }
}

function aliasesFrom(site: SiteConfig): Array<{ from: string; to: string }> {
  const rows = Object.entries(site.cityAliases).map(([from, to]) => ({ from, to }));
  return rows.length > 0 ? rows : [{ from: '', to: '' }];
}

function buildSite(
  draft: SiteConfig,
  aliases: Array<{ from: string; to: string }>,
  newProject: SiteConfig['newProject'],
): SiteConfig {
  const cityAliases: Record<string, string> = {};
  for (const row of aliases) {
    if (row.from !== '' && row.to !== '') cityAliases[row.from] = row.to;
  }
  return {
    ...draft,
    keywordTemplates: draft.keywordTemplates.filter((s) => s !== ''),
    cityAliases,
    newProject,
  };
}

function ModeButtons({
  mode,
  t,
  disabled,
  onDryRun,
  onOff,
  onLive,
}: {
  mode: SiteConfig['mode'];
  t: Strings;
  disabled: boolean;
  onDryRun: () => void;
  onOff: () => void;
  onLive: () => void;
}) {
  return (
    <div className="ms-seg" role="group" aria-label={t.mode}>
      <Button
        type="button"
        variant="ghost"
        className="ms-seg-item"
        aria-pressed={mode === 'dry-run'}
        disabled={disabled}
        onClick={onDryRun}
      >
        {t.modeDryRun}
      </Button>
      <Button
        type="button"
        variant="ghost"
        className="ms-seg-item"
        data-testid="automation-live"
        aria-pressed={mode === 'live'}
        disabled={disabled}
        onClick={onLive}
      >
        {t.modeLive}
      </Button>
      <Button
        type="button"
        variant="ghost"
        className="ms-seg-item"
        aria-pressed={mode === 'off'}
        disabled={disabled}
        onClick={onOff}
      >
        {t.modeOff}
      </Button>
    </div>
  );
}

export function AutomationTab() {
  const rpc = useRpc<typeof rpcContract>();
  const t = useAutomationStrings();
  const locale = detectLocale();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [sites, setSites] = useState<SiteConfig[]>([]);
  const [siteId, setSiteId] = useState('');
  const [draft, setDraft] = useState<SiteConfig | null>(null);
  const [aliases, setAliases] = useState<Array<{ from: string; to: string }>>([{ from: '', to: '' }]);
  const [provider, setProvider] = useState('');
  const [device, setDevice] = useState('');
  const [parentFolderId, setParentFolderId] = useState('');
  const [autolaunchText, setAutolaunchText] = useState('');
  const [preview, setPreview] = useState<ActionResult[] | null>(null);
  const [log, setLog] = useState<ActionResult[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const config = (await rpc.call('config', null)) as { sites: SiteConfig[] };
    setSites(config.sites);
    const selected = config.sites.find((s) => s.id === siteId) ?? config.sites[0];
    if (!selected) {
      setDraft(null);
      return;
    }
    setSiteId(selected.id);
    setDraft(selected);
    setAliases(aliasesFrom(selected));
    setProvider(selected.newProject?.provider ?? '');
    setDevice(selected.newProject ? String(selected.newProject.device) : '');
    setParentFolderId(
      selected.newProject?.parentFolderId === null || selected.newProject?.parentFolderId === undefined
        ? ''
        : String(selected.newProject.parentFolderId),
    );
    setAutolaunchText(
      selected.newProject?.autolaunch ? JSON.stringify(selected.newProject.autolaunch, null, 2) : '',
    );
    const { entries } = await rpc.call('lifecycle_log', { siteId: selected.id });
    setLog(entries);
  }, [rpc, siteId]);

  useEffect(() => {
    load().catch((e) => setError(errorText(e, t)));
  }, [load, t]);

  const alerts = useMemo(() => openAlerts(log), [log]);

  function parseNewProject(): SiteConfig['newProject'] {
    if (provider === '' && device === '' && parentFolderId === '' && autolaunchText.trim() === '') {
      return null;
    }
    if (device !== '' && !Number.isInteger(Number(device))) {
      throw new Error('device must be an integer');
    }
    let autolaunch: Record<string, unknown> | null = null;
    if (autolaunchText.trim() !== '') {
      const parsed: unknown = JSON.parse(autolaunchText);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('autolaunch must be a JSON object');
      }
      autolaunch = parsed as Record<string, unknown>;
    }
    return {
      provider,
      device: device === '' ? 0 : Number(device),
      parentFolderId: parentFolderId === '' ? null : Number(parentFolderId),
      autolaunch,
    };
  }

  async function persist(next: SiteConfig) {
    setBusy(true);
    setError('');
    try {
      await rpc.call('site_save', { site: toJson(next) });
      setDraft(next);
      setSites((current) => current.map((s) => (s.id === next.id ? next : s)));
    } catch (e) {
      setError(errorText(e, t));
      throw e;
    } finally {
      setBusy(false);
    }
  }

  async function saveRules() {
    if (!draft) return;
    try {
      const next = buildSite(draft, aliases, parseNewProject());
      await persist(next);
      toast.success(t.saved);
    } catch (e) {
      setError(errorText(e, t));
    }
  }

  async function setMode(mode: SiteConfig['mode']) {
    if (!draft) return;
    const next = { ...buildSite(draft, aliases, draft.newProject), mode };
    await persist(next);
  }

  async function onPreview() {
    if (!draft) return;
    setBusy(true);
    setError('');
    try {
      const rows = await rpc.call('automation_preview', { siteId: draft.id });
      setPreview(rows);
      const { entries } = await rpc.call('lifecycle_log', { siteId: draft.id });
      setLog(entries);
    } catch (e) {
      setError(errorText(e, t));
    } finally {
      setBusy(false);
    }
  }

  function onSelectSite(id: string) {
    setSiteId(id);
    setPreview(null);
  }

  if (draft === null && sites.length === 0 && !error) {
    return <p className="ms-card p-6 text-sm text-muted-foreground">{t.loading}</p>;
  }
  if (draft === null) {
    return <p className="ms-card p-6 text-sm text-muted-foreground">{error || t.emptySites}</p>;
  }

  return (
    <div className="ms-auto">
      {alerts.length > 0 && (
        <div className="ms-auto-alerts" role="status">
          {alerts.map((a) => (
            <span key={a.city} className="ms-pill ms-pill-danger">
              {t.alertOpen}: {a.city}
            </span>
          ))}
        </div>
      )}
      {error && (
        <p role="alert" className="ms-card ms-pill-danger p-3 text-sm whitespace-pre-wrap">
          {error}
        </p>
      )}

      <section className="ms-panel">
        <h2 className="ms-panel-head text-sm font-medium">
          <span>{draft.domain}</span>
          <span className="ms-pill ms-pill-info">{t.mode}: {draft.mode === 'live' ? t.modeLive : draft.mode === 'off' ? t.modeOff : t.modeDryRun}</span>
        </h2>
        <div className="ms-panel-body ms-auto-rules">
          <div className="ms-auto-toolbar">
            <label className="ms-auto-field ms-auto-field-grow">
              <span className="ms-auto-label">{t.site}</span>
              <select
                className="ms-auto-select"
                value={draft.id}
                onChange={(e) => onSelectSite(e.target.value)}
              >
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.domain}
                  </option>
                ))}
              </select>
            </label>
            <ModeButtons
              mode={draft.mode}
              t={t}
              disabled={busy}
              onDryRun={() => void setMode('dry-run')}
              onOff={() => void setMode('off')}
              onLive={() => {
                if (draft.mode === 'live') return;
                dialogRef.current?.showModal();
              }}
            />
            <Button
              type="button"
              className="ms-raised"
              variant="outline"
              data-testid="automation-preview"
              disabled={busy}
              onClick={() => void onPreview()}
            >
              {t.preview}
            </Button>
          </div>

          <label className="ms-auto-field">
            <span className="ms-auto-label">{t.stopHours}</span>
            <input className="ms-auto-input" value={String(draft.stopHoursBefore)} readOnly />
          </label>
          <label className="ms-auto-field">
            <span className="ms-auto-label">{t.nameTemplate}</span>
            <input
              className="ms-auto-input"
              value={draft.nameTemplate}
              onChange={(e) => setDraft({ ...draft, nameTemplate: e.target.value })}
            />
          </label>
          <div className="ms-auto-field">
            <span className="ms-auto-label">{t.keywordTemplates}</span>
            <div className="ms-auto-list">
              {draft.keywordTemplates.map((tpl, i) => (
                <input
                  key={i}
                  className="ms-auto-input"
                  value={tpl}
                  onChange={(e) => {
                    const next = draft.keywordTemplates.slice();
                    next[i] = e.target.value;
                    setDraft({ ...draft, keywordTemplates: next });
                  }}
                />
              ))}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setDraft({ ...draft, keywordTemplates: [...draft.keywordTemplates, ''] })}
              >
                {t.addTemplate}
              </Button>
            </div>
          </div>
          <div className="ms-auto-field">
            <span className="ms-auto-label">{t.cityAliases}</span>
            <div className="ms-auto-list">
              {aliases.map((row, i) => (
                <div className="ms-auto-row" key={i}>
                  <input
                    className="ms-auto-input"
                    aria-label={t.aliasFrom}
                    placeholder={t.aliasFrom}
                    value={row.from}
                    onChange={(e) => {
                      const next = aliases.slice();
                      next[i] = { ...row, from: e.target.value };
                      setAliases(next);
                    }}
                  />
                  <input
                    className="ms-auto-input"
                    aria-label={t.aliasTo}
                    placeholder={t.aliasTo}
                    value={row.to}
                    onChange={(e) => {
                      const next = aliases.slice();
                      next[i] = { ...row, to: e.target.value };
                      setAliases(next);
                    }}
                  />
                </div>
              ))}
              <Button type="button" variant="ghost" size="sm" onClick={() => setAliases([...aliases, { from: '', to: '' }])}>
                {t.addAlias}
              </Button>
            </div>
          </div>
          <div className="ms-auto-field">
            <span className="ms-auto-label">{t.newProject}</span>
            {draft.newProject === null && provider === '' && (
              <p className="ms-auto-muted text-sm">{t.newProjectMissing}</p>
            )}
            <div className="ms-auto-list">
              <input className="ms-auto-input" aria-label={t.provider} placeholder={t.provider} value={provider} onChange={(e) => setProvider(e.target.value)} />
              <input className="ms-auto-input" aria-label={t.device} placeholder={t.device} value={device} onChange={(e) => setDevice(e.target.value)} />
              <input
                className="ms-auto-input"
                aria-label={t.parentFolderId}
                placeholder={t.parentFolderId}
                value={parentFolderId}
                onChange={(e) => setParentFolderId(e.target.value)}
              />
              <textarea
                className="ms-auto-textarea"
                aria-label={t.autolaunch}
                placeholder={t.autolaunch}
                value={autolaunchText}
                onChange={(e) => setAutolaunchText(e.target.value)}
              />
            </div>
          </div>
          <Button type="button" variant="outline" className="ms-raised" disabled={busy} onClick={() => void saveRules()}>
            {t.save}
          </Button>
        </div>
      </section>

      <section className="ms-panel">
        <h2 className="ms-panel-head text-sm font-medium">
          <span>{t.preview}</span>
          {preview && (
            <span className="ms-pill ms-pill-neutral">
              {t.previewMode}: {t.modeDryRun}
            </span>
          )}
        </h2>
        <div className="ms-panel-body overflow-x-auto">
          {preview === null ? (
            <p className="ms-auto-muted text-sm">{t.emptyPreview}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.colCity}</TableHead>
                  <TableHead>{t.colNearest}</TableHead>
                  <TableHead>{t.colAction}</TableHead>
                  <TableHead>{t.colReason}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.map((row, i) => (
                  <TableRow key={`${row.city}-${row.kind}-${i}`}>
                    <TableCell className="ms-city">{row.city}</TableCell>
                    <TableCell>{formatNearest(row, draft, locale)}</TableCell>
                    <TableCell>{row.kind}</TableCell>
                    <TableCell>{row.reason}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </section>

      <section className="ms-panel">
        <h2 className="ms-panel-head text-sm font-medium">{t.log}</h2>
        <div className="ms-panel-body">
          {log.length === 0 ? (
            <p className="ms-auto-muted text-sm">{t.emptyLog}</p>
          ) : (
            <ol className="ms-auto-log">
              {[...log].reverse().map((entry, i) => (
                <li key={`${entry.at}-${i}`} className="ms-auto-log-item">
                  <span>
                    {entry.at} · {entry.city} · {entry.kind} · {entry.outcome}
                  </span>
                  <span className="ms-auto-muted">{entry.detail}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>

      <dialog ref={dialogRef} className="ms-auto-dialog" role="alertdialog" aria-labelledby="ms-auto-live-title">
        <h2 id="ms-auto-live-title">{t.liveTitle}</h2>
        <p>{t.liveBody}</p>
        <div className="ms-auto-dialog-actions">
          <Button type="button" variant="outline" className="ms-raised" onClick={() => dialogRef.current?.close()}>
            {t.liveCancel}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => {
              dialogRef.current?.close();
              void setMode('live');
            }}
          >
            {t.liveConfirm}
          </Button>
        </div>
      </dialog>
    </div>
  );
}
