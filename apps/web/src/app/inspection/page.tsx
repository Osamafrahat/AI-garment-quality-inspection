'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Home,
  Moon,
  RefreshCw,
  ScanEye,
  Sun,
  Timer,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

const GATEWAY = process.env.NEXT_PUBLIC_GATEWAY_URL ?? 'http://localhost:8000';

type Inspection = {
  id: number;
  seq?: number | null;
  node_id: string;
  capture_ts?: string | null;
  received_at?: string;
  decision: string;
  predicted_class: string;
  confidence: number;
  threshold: number;
  cut_no?: number | null;
  product_line?: string | null;
  sensors?: {
    lux?: number;
    temp_c?: number;
    humidity_pct?: number;
    distance_mm?: number | null;
    light_ok?: boolean;
  };
  latency_ms?: { edge?: number; e2e_est?: number };
  model_version?: string | null;
  backend?: string | null;
};

type Stats = {
  total: number;
  pass: number;
  fail: number;
  pass_rate: number | null;
  by_class: Record<string, number>;
  latency_edge_p95_ms: number | null;
  latency_e2e_p95_ms: number | null;
  threshold: number;
  updated_at?: string;
};

const CLASS_COLORS: Record<string, string> = {
  ok: '#22c55e',
  hole: '#ef4444',
  stain: '#f59e0b',
  broken_thread: '#a855f7',
  shade_variation: '#3b82f6',
  print_misalignment: '#06b6d4',
};

function classColor(cls: string): string {
  if (CLASS_COLORS[cls]) return CLASS_COLORS[cls];
  const palette = ['#64748b', '#ec4899', '#84cc16', '#f97316', '#14b8a6'];
  let hash = 0;
  for (let i = 0; i < cls.length; i++) hash = (hash + cls.charCodeAt(i)) % palette.length;
  return palette[hash];
}

function ageMs(iso?: string | null): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.max(0, Date.now() - t);
}

function formatTime(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(11, 19) || '—';
  return d.toLocaleTimeString([], { hour12: false });
}

function useTheme() {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    const saved = localStorage.getItem('threadsight-theme');
    const next = saved === 'light' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.classList.toggle('dark', next === 'dark');
  }, []);

  const toggle = useCallback(() => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem('threadsight-theme', next);
      document.documentElement.classList.toggle('dark', next === 'dark');
      return next;
    });
  }, []);

  return { theme, toggle };
}

export default function InspectionDashboardPage() {
  const [rows, setRows] = useState<Inspection[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [threshold, setThreshold] = useState(0.7);
  const [online, setOnline] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'pass' | 'fail' | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const thresholdRef = useRef(0.7);
  const { theme, toggle: toggleTheme } = useTheme();

  const refresh = useCallback(async () => {
    try {
      const [listRes, statsRes, thrRes] = await Promise.all([
        fetch(`${GATEWAY}/api/v1/inspections?limit=50`),
        fetch(`${GATEWAY}/api/v1/stats`),
        fetch(`${GATEWAY}/api/v1/threshold`),
      ]);
      if (!listRes.ok || !statsRes.ok) throw new Error('gateway unavailable');
      setRows(await listRes.json());
      setStats(await statsRes.json());
      if (thrRes.ok) {
        const data = await thrRes.json();
        thresholdRef.current = data.value;
        setThreshold(data.value);
      }
      setOnline(true);
      setError(null);
      setLastUpdate(new Date());
    } catch (e) {
      setOnline(false);
      setError(e instanceof Error ? e.message : 'gateway error');
    }
  }, []);

  useEffect(() => {
    refresh();
    const poll = setInterval(refresh, 2500);
    let es: EventSource | null = null;
    try {
      es = new EventSource(`${GATEWAY}/api/v1/stream`);
      es.addEventListener('inspection', () => {
        refresh();
      });
      es.onerror = () => {
        es?.close();
      };
    } catch {
      /* polling remains fallback */
    }
    return () => {
      clearInterval(poll);
      es?.close();
    };
  }, [refresh]);

  const pushThreshold = async (value: number) => {
    setThreshold(value);
    thresholdRef.current = value;
    try {
      await fetch(`${GATEWAY}/api/v1/threshold`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value }),
      });
    } catch {
      setError('failed to set threshold');
    }
  };

  const simulate = async (mode: 'pass' | 'fail') => {
    setBusy(mode);
    try {
      await fetch(`${GATEWAY}/api/v1/simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          mode === 'pass' ? { force_pass: true } : { force_fail: true }
        ),
      });
      await refresh();
    } finally {
      setBusy(null);
    }
  };

  const defectEntries = useMemo(
    () =>
      Object.entries(stats?.by_class ?? {}).sort((a, b) => b[1] - a[1]),
    [stats]
  );
  const defectTotal = useMemo(
    () => defectEntries.reduce((sum, [, n]) => sum + n, 0),
    [defectEntries]
  );

  const kpis = useMemo(() => {
    const latest = rows[0];
    const passRate =
      stats?.pass_rate != null ? `${(stats.pass_rate * 100).toFixed(1)}%` : '—';
    return [
      {
        label: 'Total inspections',
        value: String(stats?.total ?? rows.length),
        hint: 'all time',
        icon: ScanEye,
        tone: 'primary' as const,
      },
      {
        label: 'Pass rate',
        value: passRate,
        hint: `${stats?.pass ?? 0} pass · ${stats?.fail ?? 0} fail`,
        icon: CheckCircle2,
        tone: 'success' as const,
      },
      {
        label: 'Failures',
        value: String(stats?.fail ?? 0),
        hint: 'rejected units',
        icon: XCircle,
        tone: 'destructive' as const,
      },
      {
        label: 'Edge p95',
        value:
          stats?.latency_edge_p95_ms != null
            ? `${stats.latency_edge_p95_ms} ms`
            : '—',
        hint: 'DR-02 response time',
        icon: Timer,
        tone: 'warning' as const,
      },
      {
        label: 'E2E p95',
        value:
          stats?.latency_e2e_p95_ms != null
            ? `${stats.latency_e2e_p95_ms} ms`
            : '—',
        hint: 'gateway estimate',
        icon: Activity,
        tone: 'primary' as const,
      },
      {
        label: 'θ threshold',
        value: threshold.toFixed(2),
        hint: 'decision cutoff',
        icon: AlertTriangle,
        tone: 'accent' as const,
      },
      {
        label: 'Node',
        value: latest?.node_id ?? '—',
        hint: latest?.model_version ?? 'edge node',
        icon: Cpu,
        tone: 'primary' as const,
      },
      {
        label: 'Updated',
        value: lastUpdate
          ? lastUpdate.toLocaleTimeString([], { hour12: false })
          : '—',
        hint: online ? 'live' : 'offline',
        icon: RefreshCw,
        tone: online ? ('success' as const) : ('destructive' as const),
      },
    ];
  }, [rows, stats, threshold, lastUpdate, online]);

  const toneClasses = {
    primary: 'bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400',
    success: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400',
    destructive: 'bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400',
    warning: 'bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400',
    accent: 'bg-violet-50 text-violet-600 dark:bg-violet-950 dark:text-violet-400',
  } as const;

  const sliderFill = ((threshold - 0.5) / (0.95 - 0.5)) * 100;

  return (
    <main className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <ScanEye className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold tracking-tight">ThreadSight</span>
                <span className="text-sm text-muted-foreground">Inspection Console</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-medium ${
                    online
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-400'
                      : 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400'
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      online ? 'bg-emerald-500 animate-live-dot' : 'bg-red-500'
                    }`}
                  />
                  {online ? 'GATEWAY ONLINE' : 'OFFLINE'}
                </span>
                <span className="hidden sm:inline">Pathway A · Industrial Base</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => simulate('pass')}
              disabled={busy !== null}
              className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900 dark:text-emerald-400 dark:hover:bg-emerald-950"
            >
              {busy === 'pass' ? 'Sending…' : 'Demo PASS'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => simulate('fail')}
              disabled={busy !== null}
              className="border-red-200 text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
            >
              {busy === 'fail' ? 'Sending…' : 'Demo FAIL'}
            </Button>
            <Button variant="ghost" size="sm" onClick={refresh} aria-label="Refresh">
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleTheme}
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/">
                <Home className="h-4 w-4" />
                Home
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl space-y-5 px-4 py-5">
        {error && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
            <strong className="font-semibold">{error}</strong> — start the gateway (
            <code className="rounded bg-amber-100 px-1">python capstone/gateway/main.py</code>
            ) and a simulator/edge node. Dashboard:{' '}
            <code className="rounded bg-amber-100 px-1">http://localhost:3000/inspection</code>{' '}
            · Gateway: <code className="rounded bg-amber-100 px-1">{GATEWAY}</code>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {kpis.map((k) => (
            <Card key={k.label} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {k.label}
                    </p>
                    <p className="mt-1 truncate text-2xl font-bold tabular-nums">{k.value}</p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{k.hint}</p>
                  </div>
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${toneClasses[k.tone]}`}
                  >
                    <k.icon className="h-4 w-4" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-5 lg:grid-cols-5">
          <Card className="lg:col-span-3">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-lg">Decision threshold θ</CardTitle>
                  <CardDescription>
                    Input → output demo · raise θ to flip borderline pieces PASS → FAIL
                  </CardDescription>
                </div>
                <div className="rounded-lg border bg-muted/40 px-3 py-1.5 text-right">
                  <div className="text-xs text-muted-foreground">Current θ</div>
                  <div className="text-xl font-bold tabular-nums text-primary">
                    {threshold.toFixed(2)}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <input
                type="range"
                min={0.5}
                max={0.95}
                step={0.01}
                value={threshold}
                onChange={(e) => pushThreshold(Number(e.target.value))}
                className="slider-threadsight w-full"
                style={{ ['--slider-fill' as string]: `${sliderFill}%` }}
                data-testid="threshold-slider"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>0.50 · permissive</span>
                <span>0.72 · default</span>
                <span>0.95 · strict</span>
              </div>
              <p className="rounded-md bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
                DR demonstration (test plan §4.1): change θ and watch new verdicts update in
                the live table below.
              </p>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Defect mix</CardTitle>
              <CardDescription>
                {defectTotal > 0
                  ? `${defectTotal} classified results`
                  : 'No classified results yet'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {defectEntries.length === 0 && (
                <p className="text-sm text-muted-foreground">No data yet</p>
              )}
              {defectEntries.map(([cls, count]) => {
                const pct = defectTotal > 0 ? (count / defectTotal) * 100 : 0;
                return (
                  <div key={cls} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 capitalize">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: classColor(cls) }}
                        />
                        {cls.replace(/_/g, ' ')}
                      </span>
                      <span className="tabular-nums text-muted-foreground">
                        {count} · {pct.toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, backgroundColor: classColor(cls) }}
                      />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle className="text-lg">Live verdicts</CardTitle>
                <CardDescription>
                  Newest first · polling + SSE from gateway · showing {rows.length} rows
                </CardDescription>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" /> PASS
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-red-500" /> FAIL
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40">
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2.5 font-medium">#</th>
                  <th className="px-3 py-2.5 font-medium">Time</th>
                  <th className="px-3 py-2.5 font-medium">Decision</th>
                  <th className="px-3 py-2.5 font-medium">Class</th>
                  <th className="px-3 py-2.5 font-medium">Conf</th>
                  <th className="px-3 py-2.5 font-medium">θ</th>
                  <th className="px-3 py-2.5 font-medium">Cut / Line</th>
                  <th className="px-3 py-2.5 font-medium">Lux</th>
                  <th className="px-3 py-2.5 font-medium">Light</th>
                  <th className="px-3 py-2.5 font-medium">Edge ms</th>
                  <th className="px-3 py-2.5 font-medium">Age</th>
                  <th className="px-3 py-2.5 font-medium">Model</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={12} className="px-3 py-10 text-center text-muted-foreground">
                      No inspections yet. Run the edge node or use Demo PASS / FAIL.
                    </td>
                  </tr>
                )}
                {rows.map((r, idx) => {
                  const age = ageMs(r.received_at ?? r.capture_ts);
                  const isPass = r.decision === 'PASS';
                  return (
                    <tr
                      key={r.id}
                      className={`border-b last:border-0 transition-colors hover:bg-muted/30 ${
                        idx === 0 ? 'animate-row-in' : ''
                      }`}
                    >
                      <td className="px-3 py-2 font-mono text-xs">{r.seq ?? r.id}</td>
                      <td className="px-3 py-2 font-mono text-xs">
                        {formatTime(r.received_at ?? r.capture_ts)}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                            isPass
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                          }`}
                        >
                          {isPass ? (
                            <CheckCircle2 className="h-3 w-3" />
                          ) : (
                            <XCircle className="h-3 w-3" />
                          )}
                          {r.decision}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span className="inline-flex items-center gap-1.5 capitalize">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: classColor(r.predicted_class) }}
                          />
                          {r.predicted_class.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-mono tabular-nums">
                        {r.confidence.toFixed(2)}
                      </td>
                      <td className="px-3 py-2 font-mono tabular-nums">
                        {(r.threshold ?? 0).toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {r.cut_no != null ? `C${r.cut_no}` : '—'} · {r.product_line ?? '—'}
                      </td>
                      <td className="px-3 py-2 font-mono tabular-nums">
                        {r.sensors?.lux ?? '—'}
                      </td>
                      <td className="px-3 py-2">
                        {r.sensors?.light_ok === false ? (
                          <span className="font-semibold text-amber-600 dark:text-amber-400">
                            OUT
                          </span>
                        ) : (
                          <span className="text-emerald-600 dark:text-emerald-400">OK</span>
                        )}
                      </td>
                      <td className="px-3 py-2 font-mono tabular-nums">
                        {r.latency_ms?.edge ?? '—'}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs tabular-nums">
                        {age != null ? `${age} ms` : '—'}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">
                        {r.model_version ?? '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <div className="flex flex-wrap items-center justify-between gap-2 pb-4 text-xs text-muted-foreground">
          <p>
            Capstone · Pathway A Industrial Base · DR-01 accuracy · DR-02 response time ·
            DR-06 telemetry · Docs: <code>capstone/docs/</code>
          </p>
          <p>
            Gateway <code>{GATEWAY}</code>
            {stats?.updated_at ? ` · stats ${formatTime(stats.updated_at)}` : ''}
          </p>
        </div>
      </section>
    </main>
  );
}
