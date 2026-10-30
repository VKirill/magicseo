import { useCallback, useEffect, useState } from 'react';
import { definePluginApp, useRpc } from '@get-bb/plugin-sdk/app';
import { toast } from 'sonner';
import type { rpcContract } from './server';
import { detectLocale, errorText, strings, useStrings } from './i18n/index.ts';
import type { ProjectRow, SiteNode } from './lib/hierarchy.ts';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AutomationTab } from './ui/automation-tab.tsx';
import { ReportsTab } from './ui/reports-tab.tsx';
import './app.css';

type Tree = { balanceRub: number; sites: SiteNode[] };
type KeywordRow = {
  id: number;
  text: string;
  pcPosition: number | null;
  mobilePosition: number | null;
  foundUrl: string | null;
};

function numberLocale(): string {
  return detectLocale() === 'ru' ? 'ru-RU' : 'en-US';
}

function rub(value: number): string {
  return `${value.toLocaleString(numberLocale(), { maximumFractionDigits: 2 })} ₽`;
}

function positionLabel(position: number | null): string {
  return position === null ? '—' : String(position);
}

function ProjectKeywords({ projectId }: { projectId: number }) {
  const rpc = useRpc<typeof rpcContract>();
  const [rows, setRows] = useState<KeywordRow[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let alive = true;
    rpc
      .call('project_keywords', { id: projectId })
      .then((data) => {
        if (alive) setRows(data.keywords);
      })
      .catch((e) => {
        if (alive) setError(String(e instanceof Error ? e.message : e));
      });
    return () => {
      alive = false;
    };
  }, [rpc, projectId]);
  const t = useStrings();
  if (error) return <p className="ms-keyword-error">{errorText(new Error(error), t)}</p>;
  if (rows === null) return <p className="ms-keyword-note">{t.loading}</p>;
  if (rows.length === 0) return <p className="ms-keyword-note">{t.emptyKeywords}</p>;
  return (
    <ul className="ms-keywords">
      {rows.map((k) => (
        <li key={k.id} className="ms-keyword">
          <span className="ms-keyword-text">{k.text}</span>
          <span className="ms-pill ms-pill-neutral font-mono tabular-nums">
            {t.pc}: {positionLabel(k.pcPosition)}
          </span>
          <span className="ms-pill ms-pill-neutral font-mono tabular-nums">
            {t.mobile}: {positionLabel(k.mobilePosition)}
          </span>
          {k.foundUrl && (
            <span className="ms-keyword-url font-mono" title={k.foundUrl}>
              {k.foundUrl}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

function ProjectRowView({
  project,
  busy,
  expanded,
  onToggleExpand,
  onAction,
}: {
  project: ProjectRow & { city: string };
  busy: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  onAction: (action: 'start' | 'stop' | 'check') => void;
}) {
  const t = useStrings();
  return (
    <>
      <TableRow data-expanded={expanded ? '1' : undefined} className="ms-project-row">
        <TableCell className="ms-city font-medium">{project.city}</TableCell>
        <TableCell className="min-w-48 whitespace-normal">
          <span className="ms-title">{project.name}</span>
          <span className="ms-id font-mono tabular-nums">#{project.id}</span>
        </TableCell>
        <TableCell>
          <span
            className={`ms-pill ${project.active ? 'ms-pill-success' : 'ms-pill-muted'}`}
          >
            {project.active ? t.stateRunning : t.stateStopped}
          </span>
        </TableCell>
        <TableCell className="font-mono tabular-nums">
          <button
            type="button"
            className="ms-expand"
            aria-expanded={expanded}
            onClick={onToggleExpand}
          >
            {project.keywords}
          </button>
        </TableCell>
        <TableCell className="font-mono tabular-nums">{rub(project.periodSpent)}</TableCell>
        <TableCell className="font-mono tabular-nums">{rub(project.totalSpent)}</TableCell>
        <TableCell>
          <div className="ms-actions">
            {project.active ? (
              <Button
                size="sm"
                variant="outline"
                className="ms-raised"
                disabled={busy}
                onClick={() => onAction('stop')}
              >
                {t.stop}
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="ms-raised"
                disabled={busy}
                onClick={() => onAction('start')}
              >
                {t.start}
              </Button>
            )}
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => onAction('check')}>
              {t.checkPositions}
            </Button>
          </div>
        </TableCell>
      </TableRow>
      {expanded && (
        <TableRow className="ms-keywords-row">
          <TableCell colSpan={7}>
            <ProjectKeywords projectId={project.id} />
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function ProjectsTab() {
  const rpc = useRpc<typeof rpcContract>();
  const [data, setData] = useState<Tree | null>(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const t = useStrings();

  const reload = useCallback(() => {
    rpc.call('tree').then(setData, (e) => setError(errorText(e, t)));
  }, [rpc, t]);
  useEffect(reload, [reload]);

  async function act(project: ProjectRow, run: () => Promise<string>) {
    setBusyId(project.id);
    setError('');
    try {
      toast.success(await run());
      reload();
    } catch (e) {
      setError(errorText(e, t));
    } finally {
      setBusyId(null);
    }
  }

  const onAction = (project: ProjectRow, action: 'start' | 'stop' | 'check') => {
    const { id } = project;
    const runs = {
      start: () => rpc.call('project_start', { id }).then(() => t.started),
      stop: () => rpc.call('project_stop', { id }).then(() => t.stopped),
      check: () => rpc.call('positions_check', { id }).then(() => t.checkQueued),
    } as const;
    void act(project, runs[action]);
  };

  return (
    <div className="space-y-5">
      {error && (
        <p role="alert" className="ms-card ms-pill-danger p-3 text-sm whitespace-pre-wrap">
          {error}
        </p>
      )}
      {data === null ? (
        !error && <p className="text-sm text-muted-foreground">{t.loading}</p>
      ) : data.sites.length === 0 ? (
        <p className="ms-card p-6 text-sm text-muted-foreground">{t.emptyTree}</p>
      ) : (
        data.sites.map((site) => (
          <section className="ms-panel" key={site.domain}>
            <h2 className="ms-panel-head text-sm font-medium">
              <span className="ms-domain font-mono">{site.domain}</span>
              <span className={`ms-pill ${site.configured ? 'ms-pill-info' : 'ms-pill-muted'}`}>
                {site.configured ? t.configured : t.notConfigured}
              </span>
              <span className="ms-pill ms-pill-neutral font-mono tabular-nums">
                {site.projects.length} {t.projectsWord}
              </span>
            </h2>
            <div className="ms-panel-body overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="ms-col-city">{t.colCity}</TableHead>
                    <TableHead>{t.colProject}</TableHead>
                    <TableHead>{t.colState}</TableHead>
                    <TableHead>{t.colKeywords}</TableHead>
                    <TableHead>{t.colPeriodSpend}</TableHead>
                    <TableHead>{t.colTotalSpend}</TableHead>
                    <TableHead>{t.colActions}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {site.projects.map((project) => (
                    <ProjectRowView
                      key={project.id}
                      project={project}
                      busy={busyId === project.id}
                      expanded={expandedId === project.id}
                      onToggleExpand={() =>
                        setExpandedId((current) => (current === project.id ? null : project.id))
                      }
                      onAction={(action) => onAction(project, action)}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>
        ))
      )}
    </div>
  );
}

function Page() {
  const rpc = useRpc<typeof rpcContract>();
  const [balanceRub, setBalanceRub] = useState<number | null>(null);
  const [tab, setTab] = useState<'projects' | 'automation' | 'reports'>('projects');
  const t = useStrings();

  useEffect(() => {
    let alive = true;
    rpc
      .call('tree')
      .then((data) => {
        if (alive) setBalanceRub(data.balanceRub);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [rpc]);

  return (
    <div data-ms-content className="h-full min-h-0 overflow-y-auto">
      <div className="mx-auto w-full max-w-5xl space-y-5 p-4">
        <div className="ms-strip flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-medium">{t.title}</h1>
          <span
            className="ms-pill ms-pill-warning font-mono tabular-nums"
            aria-label={t.balance}
            data-testid="ms-balance"
          >
            {t.balance}: {balanceRub === null ? '…' : rub(balanceRub)}
          </span>
          <div className="ms-seg ml-auto" role="tablist">
            {(
              [
                ['projects', t.tabProjects],
                ['automation', t.tabAutomation],
                ['reports', t.tabReports],
              ] as const
            ).map(([key, label]) => (
              <Button
                key={key}
                variant="ghost"
                className="ms-seg-item"
                role="tab"
                aria-selected={tab === key}
                onClick={() => setTab(key)}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>
        <div role="tabpanel">
          {tab === 'projects' && <ProjectsTab />}
          {tab === 'automation' && <AutomationTab />}
          {tab === 'reports' && <ReportsTab />}
        </div>
      </div>
    </div>
  );
}

export default definePluginApp((app) => {
  app.slots.navPanel({
    id: 'magicseo',
    title: strings().title,
    icon: 'Globe',
    path: 'magicseo',
    component: Page,
  });
});
