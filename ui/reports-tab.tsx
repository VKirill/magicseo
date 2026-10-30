import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRpc } from '@get-bb/plugin-sdk/app';
import { toast } from 'sonner';
import type { rpcContract } from '../server';
import { detectLocale } from '../i18n/index.ts';
import { en, ru } from '../i18n/reports.ts';
import type { SiteNode } from '../lib/hierarchy.ts';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import './reports-tab.css';

type ReportStrings = typeof en;
type TreeData = { balanceRub: number; sites: SiteNode[] };
type ReportRow = {
  site: string;
  city: string;
  keyword: string;
  date: string;
  pcPosition: number | null;
  mobilePosition: number | null;
  foundUrl: string;
};

/** Same locale watch as useStrings in i18n/index.ts, but with the reports strings. */
function useReportStrings(): ReportStrings {
  const [value, setValue] = useState<ReportStrings>(() => (detectLocale() === 'ru' ? ru : en));
  useEffect(() => {
    const sync = () => setValue(detectLocale() === 'ru' ? ru : en);
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
    return () => observer.disconnect();
  }, []);
  return value;
}

function errorMessage(e: unknown, t: ReportStrings): string {
  const raw = e instanceof Error ? e.message : String(e);
  return /fetch|network|timeout|abort/i.test(raw) ? t.networkError : `${t.error}: ${raw}`;
}

function localDate(daysFromToday: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function reportFilter(
  domain: string,
  from: string,
  to: string,
  region: number | undefined,
  keywordQuery: string,
): { domain: string; from: string; to: string; region?: number; keyword?: string } {
  return {
    domain,
    from,
    to,
    ...(region !== undefined ? { region } : {}),
    ...(keywordQuery !== '' ? { keyword: keywordQuery } : {}),
  };
}

export function ReportsTab() {
  const rpc = useRpc<typeof rpcContract>();
  const t = useReportStrings();
  const [tree, setTree] = useState<TreeData | null>(null);
  const [domain, setDomain] = useState('');
  const [region, setRegion] = useState<number | undefined>(undefined);
  const [keywordQuery, setKeywordQuery] = useState('');
  const [from, setFrom] = useState(localDate(-6));
  const [to, setTo] = useState(localDate(0));
  const [rows, setRows] = useState<ReportRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    rpc
      .call('tree')
      .then((data) => {
        if (alive) setTree(data);
      })
      .catch(() => {
        if (alive) setTree({ balanceRub: 0, sites: [] });
      });
    return () => {
      alive = false;
    };
  }, [rpc]);

  useEffect(() => {
    if (tree !== null && domain === '' && tree.sites.length > 0) setDomain(tree.sites[0].domain);
  }, [tree, domain]);

  const load = useCallback(() => {
    if (domain === '') return;
    let alive = true;
    setError('');
    rpc
      .call('positions_report', reportFilter(domain, from, to, region, keywordQuery))
      .then((data) => {
        if (alive) setRows(data);
      })
      .catch((e) => {
        if (alive) setError(errorMessage(e, t));
      });
    return () => {
      alive = false;
    };
  }, [rpc, domain, region, keywordQuery, from, to, t]);
  useEffect(() => load(), [load]);

  const site = useMemo(() => tree?.sites.find((s) => s.domain === domain) ?? null, [tree, domain]);
  const cityOptions = useMemo(() => {
    const byRegion = new Map<number, string>();
    for (const p of site?.projects ?? []) byRegion.set(p.region, p.city);
    return [...byRegion.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [site]);

  const pivot = useMemo(() => {
    const dates: string[] = [];
    const byKeyword = new Map<string, Map<string, ReportRow>>();
    const urls = new Map<string, string>();
    for (const row of rows ?? []) {
      let byDate = byKeyword.get(row.keyword);
      if (!byDate) {
        byDate = new Map();
        byKeyword.set(row.keyword, byDate);
      }
      byDate.set(row.date, row);
      if (row.foundUrl) urls.set(row.keyword, row.foundUrl);
      if (!dates.includes(row.date)) dates.push(row.date);
    }
    dates.sort();
    return {
      dates,
      byKeyword,
      urls,
      keywords: [...byKeyword.keys()].sort((a, b) => a.localeCompare(b)),
    };
  }, [rows]);

  const positionText = (position: number | null): string =>
    position === null ? '—' : position === 101 ? t.beyond100 : String(position);

  async function harvestNow() {
    setBusy(true);
    setError('');
    try {
      const result = await rpc.call('positions_harvest_now', null);
      toast.success(`${t.harvestDone} ${result.projects} ${t.projectsWord}, ${result.checks} ${t.checksWord}`);
      load();
    } catch (e) {
      setError(errorMessage(e, t));
    } finally {
      setBusy(false);
    }
  }

  async function exportCsv() {
    try {
      const csv = await rpc.call('positions_csv', reportFilter(domain, from, to, region, keywordQuery));
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `positions-${domain}-${from}-${to}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(errorMessage(e, t));
    }
  }

  return (
    <section className="ms-panel">
      <h2 className="ms-panel-head text-sm font-medium">
        <span>
          {t.colKeyword}: {pivot.byKeyword.size}
        </span>
        <span className="ms-pill ms-pill-neutral font-mono tabular-nums">{t.pcMobile}</span>
      </h2>
      <div className="ms-panel-body space-y-4">
        <div className="ms-rep-filters">
          <label className="ms-rep-field">
            <span className="ms-rep-label">{t.site}</span>
            <select
              className="ms-rep-control"
              value={domain}
              onChange={(e) => {
                setDomain(e.target.value);
                setRegion(undefined);
              }}
            >
              {(tree?.sites ?? []).map((s) => (
                <option key={s.domain} value={s.domain}>
                  {s.domain}
                </option>
              ))}
            </select>
          </label>
          <label className="ms-rep-field">
            <span className="ms-rep-label">{t.city}</span>
            <select
              className="ms-rep-control"
              value={region ?? ''}
              onChange={(e) => setRegion(e.target.value === '' ? undefined : Number(e.target.value))}
            >
              <option value="">{t.cityAll}</option>
              {cityOptions.map(([r, city]) => (
                <option key={r} value={r}>
                  {city}
                </option>
              ))}
            </select>
          </label>
          <label className="ms-rep-field">
            <span className="ms-rep-label">{t.keyword}</span>
            <input
              type="search"
              className="ms-rep-control"
              placeholder={t.keywordPlaceholder}
              value={keywordQuery}
              onChange={(e) => setKeywordQuery(e.target.value)}
            />
          </label>
          <label className="ms-rep-field">
            <span className="ms-rep-label">{t.dateFrom}</span>
            <input type="date" className="ms-rep-control" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="ms-rep-field">
            <span className="ms-rep-label">{t.dateTo}</span>
            <input type="date" className="ms-rep-control" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
          <div className="ms-rep-actions">
            <Button size="sm" className="ms-rep-accent" disabled={busy} onClick={() => void harvestNow()}>
              {t.harvestNow}
            </Button>
            <Button size="sm" variant="outline" className="ms-raised" onClick={() => void exportCsv()}>
              {t.exportCsv}
            </Button>
          </div>
        </div>
        {error && (
          <p role="alert" className="ms-error p-3 text-sm whitespace-pre-wrap">
            {error}
          </p>
        )}
        {domain === '' ? (
          <p className="ms-rep-note">{t.pickSite}</p>
        ) : rows === null ? (
          !error && <p className="ms-rep-note">{t.loading}</p>
        ) : pivot.keywords.length === 0 ? (
          <div className="ms-card p-6">
            <p className="text-sm">{t.empty}</p>
            <p className="ms-rep-note">{t.emptyHint}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="ms-rep-kw">{t.colKeyword}</TableHead>
                  {pivot.dates.map((date) => (
                    <TableHead key={date} className="ms-rep-cell font-mono tabular-nums">
                      {date}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {pivot.keywords.map((keyword) => (
                  <TableRow key={keyword}>
                    <TableCell className="ms-rep-kw" title={pivot.urls.get(keyword)}>
                      {keyword}
                    </TableCell>
                    {pivot.dates.map((date) => {
                      const row = pivot.byKeyword.get(keyword)!.get(date);
                      return (
                        <TableCell key={date} className="ms-rep-cell font-mono tabular-nums">
                          {row
                            ? `${positionText(row.pcPosition)} / ${positionText(row.mobilePosition)}`
                            : '—'}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </section>
  );
}
