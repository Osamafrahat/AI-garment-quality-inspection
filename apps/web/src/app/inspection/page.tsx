'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Cpu,
  Download,
  Home,
  Moon,
  RefreshCw,
  ScanEye,
  Search,
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
import { cn } from '@/lib/utils';

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
  by_class: Record<string, string | number> | Record<string, number>;
  latency_edge_p95_ms: number | null;
  latency_e2e_p95_ms: number | null;
  threshold: number;
  updated_at?: string;
};

type DecisionFilter = 'all' | 'PASS' | 'FAIL';

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
  return palette[hash % palette.length];
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
  if (Number.isNaN(d.getTime())) return (iso.slice(11, 19) || iso) as string;
  return d.toLocaleTimeString([], { hour12: false });
}

function normalizeClassCount(v: string | number): number {
  return typeof v === 'number' ? v : Number(v) || 0;
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

function Sparkline({
  values,
  stroke = 'currentColor',
  height = 36,
}: {
  values: number[];
  stroke?: string;
  height?: number;
}) {
  if (values.length < 2) {
    return (
      <div className="text-xs text-muted-foreground" style={{ height }}>
        collecting samples…
      </div>
    );
  }
  const w = 120;
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 1);
  const span = max - min || 1;
  const pts = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = height - ((v - min) / span) * (height - 4) - 2;
      return `${x},${y}`;
    })
    .join(' ');
  const area = `0,${height} ${pts} ${w},${height}`;
  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="h-9 w-full" preserveAspectRatio="none" aria-hidden>
      <polygon points={area} fill={stroke} opacity="0.12" />
      <polyline points={pts} fill="none" stroke={stroke} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

function GaugeRing({
  value,
  label,
  sub,
  color,
}: {
  value: number;
  label: string;
  sub?: string;
  color: string;
}) {
  const clamped = Math.max(0, Math.min(1, value));
  const r = 42;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - clamped);
  return (
    <div className="flex items-center gap-4">
      <div className="relative h-24 w-24 shrink-0">
        <svg viewBox="0 0 100 100" className="h-24 w-24 -rotate-90">
          <circle cx="50" cy="50" r={r} fill="none" strokeWidth="10" className="stroke-muted" />
          <circle
            cx="50"
            cy="50"
            r={r}
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={offset}
            className="transition-all duration-700"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-bold tabular-nums leading-none">
            {(clamped * 100).toFixed(1)}%
          </span>
          <span className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
            rate
          </span>
        </div>
      </div>
      <div className="min-w-0">
        <div className="text-sm font-semibold">{label}</div>
        {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
      </div>
    </div>
  );
}

export default function InspectionDashboardPage() {
  const [rows, setRows] = useState<Inspection[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [threshold, setThreshold] = useState(0.7);
  const [online, setOnline] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'pass' | 'fail' | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [decisionFilter, setDecisionFilter] = useState<DecisionFilter>('all');
  const [classFilter, setClassFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [toast, setToast] = useState<{ id: number; text: string; tone: 'ok' | 'bad' } | null>(null);
  const thresholdRef = useRef(0.7);
  const searchRef = useRef<HTMLInputElement>(null);
  const { theme, toggle: toggleTheme } = useTheme();

  const showToast = useCallback((text: string, tone: 'ok' | 'bad' = 'ok') => {
    const id = Date.now();
    setToast({ id, text, tone });
    window.setTimeout(() => setToast((t) => (t && t.id === id ? null : t)), 2200);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [listRes, statsRes, thrRes] = await Promise.all([
        fetch(`${GATEWAY}/api/v1/inspections?limit=80`),
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
    const poll = setInterval(refresh, 2000);
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
      /* polling fallback */
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
      const res = await fetch(`${GATEWAY}/api/v1/threshold`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value }),
      });
      if (!res.ok) throw new Error('threshold rejected');
      showToast(`θ set to ${value.toFixed(2)}`, 'ok');
    } catch {
      setError('failed to set threshold');
      showToast('θ update failed', 'bad');
    }
  };

  const simulate = async (mode: 'pass' | 'fail') => {
    setBusy(mode);
    try {
      const res = await fetch(`${GATEWAY}/api/v1/simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mode === 'pass' ? { force_pass: true } : { force_fail: true }),
      });
      if (!res.ok) throw new Error('simulate failed');
      await refresh();
      showToast(mode === 'pass' ? 'Demo PASS published' : 'Demo FAIL published', mode === 'pass' ? 'ok' : 'bad');
    } catch {
      showToast('Demo failed — gateway offline', 'bad');
    } finally {
      setBusy(null);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);
      if (typing) {
        if (e.key === 'Escape') (target as HTMLInputElement).blur();
        return;
      }
      if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        void simulate('pass');
      }
      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        void simulate('fail');
      }
      if (e.key === '/') {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        void refresh();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [refresh, simulate]);

  const classOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) set.add(r.predicted_class);
    for (const k of Object.keys(stats?.by_class ?? {})) set.add(k);
    return Array.from(set).sort();
  }, [rows, stats]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (decisionFilter !== 'all' && r.decision !== decisionFilter) return false;
      if (classFilter !== 'all' && r.predicted_class !== classFilter) return false;
      if (!q) return true;
      const hay = [
        String(r.seq ?? r.id),
        r.node_id,
        r.decision,
        r.predicted_class,
        r.product_line ?? '',
        r.model_version ?? '',
        r.cut_no != null ? String(r.cut_no) : '',
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, decisionFilter, classFilter, query]);

  const recentTrend = useMemo(() => {
    const chronological = [...rows].slice(0, 40).reverse();
    let pass = 0;
    let total = 0;
    return chronological.map((r) => {
      total += 1;
      if (r.decision === 'PASS') pass += 1;
      return pass / total;
    });
  }, [rows]);

  const recentLatency = useMemo(() => {
    return [...rows]
      .slice(0, 40)
      .reverse()
      .map((r) => r.latency_ms?.edge ?? 0)
      .filter((n) => n > 0);
  }, [rows]);

  const confidences = useMemo(() => rows.map((r) => r.confidence), [rows]);
  const avgConfidence = confidences.length
    ? confidences.reduce((a, b) => a + b, 0) / confidences.length
    : 0;

  const defectEntries = useMemo(() => {
    return Object.entries(stats?.by_class ?? {})
      .map(([k, v]) => [k, normalizeClassCount(v)] as [string, number])
      .sort((a, b) => b[1] - a[1]);
  }, [stats]);
  const defectTotal = defectEntries.reduce((s, [, n]) => s + n, 0);

  const latest = rows[0];
  const latestPass = latest?.decision === 'PASS';
  const passRate = stats?.pass_rate ?? 0;
  const sliderFill = ((threshold - 0.5) / (0.95 - 0.5)) * 100;

  const exportCsv = () => {
    const header = [
      'id',
      'seq',
      'time',
      'decision',
      'predicted_class',
      'confidence',
      'threshold',
      'cut_no',
      'product_line',
      'lux',
      'light_ok',
      'edge_ms',
      'node_id',
      'model_version',
    ];
    const lines = filteredRows.map((r) =>
      [
        r.id,
        r.seq ?? '',
        r.received_at ?? r.capture_ts ?? '',
        r.decision,
        r.predicted_class,
        r.confidence,
        r.threshold,
        r.cut_no ?? '',
        r.product_line ?? '',
        r.sensors?.lux ?? '',
        r.sensors?.light_ok ?? '',
        r.latency_ms?.edge ?? '',
        r.node_id,
        r.model_version ?? '',
      ]
        .map((cell) => {
          const s = String(cell);
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(',')
    );
    const csv = [header.join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `threadsight-inspections-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Exported ${filteredRows.length} rows`, 'ok');
  };

  const kpis = [
    {
      label: 'Throughput',
      value: String(stats?.total ?? rows.length),
      hint: 'inspections all-time',
      icon: ScanEye,
      tone: 'primary' as const,
      spark: recentTrend,
      sparkColor: '#3b82f6',
    },
    {
      label: 'Pass / Fail',
      value: `${stats?.pass ?? 0} / ${stats?.fail ?? 0}`,
      hint: `${(passRate * 100).toFixed(1)}% pass rate`,
      icon: latestPass ? CheckCircle2 : XCircle,
      tone: latestPass ? ('success' as const) : ('destructive' as const),
      spark: recentTrend,
      sparkColor: '#22c55e',
    },
    {
      label: 'Edge p95',
      value: stats?.latency_edge_p95_ms != null ? `${stats.latency_edge_p95_ms} ms` : '—',
      hint: 'DR-02 response time',
      icon: Timer,
      tone: 'warning' as const,
      spark: recentLatency,
      sparkColor: '#f59e0b',
    },
    {
      label: 'E2E p95',
      value: stats?.latency_e2e_p95_ms != null ? `${stats.latency_e2e_p95_ms} ms` : '—',
      hint: 'gateway path',
      icon: Activity,
      tone: 'primary' as const,
      spark: recentLatency,
      sparkColor: '#60a5fa',
    },
  ];

  const toneClasses = {
    primary: 'bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400',
    success: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400',
    destructive: 'bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400',
    warning: 'bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400',
    accent: 'bg-violet-50 text-violet-600 dark:bg-violet-950 dark:text-violet-400',
  };

  return (
    <main className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <ScanEye className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold tracking-tight">ThreadSight</span>
                <span className="hidden text-sm text-muted-foreground sm:inline">
                  Inspection Console
                </span>
                <span
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold',
                    online
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-400'
                      : 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400'
                  )}
                >
                  <span
                    className={cn(
                      'h-1.5 w-1.5 rounded-full',
                      online ? 'animate-live-dot bg-emerald-500' : 'bg-red-500'
                    )}
                  />
                  {online ? 'LIVE' : 'OFFLINE'}
                </span>
              </div>
              <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                <span>Pathway A · Industrial Base</span>
                <span aria-hidden>·</span>
                <span className="tabular-nums">
                  {lastUpdate ? `sync ${formatTime(lastUpdate.toISOString())}` : 'connecting…'}
                </span>
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
              title="Shortcut: P"
            >
              {busy === 'pass' ? 'Sending…' : 'Demo PASS'}
              <kbd className="hidden rounded border bg-muted px-1 text-[10px] font-mono sm:inline">
                P
              </kbd>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => simulate('fail')}
              disabled={busy !== null}
              className="border-red-200 text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
              title="Shortcut: F"
            >
              {busy === 'fail' ? 'Sending…' : 'Demo FAIL'}
              <kbd className="hidden rounded border bg-muted px-1 text-[10px] font-mono sm:inline">
                F
              </kbd>
            </Button>
            <Button variant="ghost" size="sm" onClick={exportCsv} title="Export filtered CSV">
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Export</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={refresh} title="Shortcut: R">
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={toggleTheme} aria-label="Toggle theme">
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/">
                <Home className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-[1400px] space-y-4 px-4 py-4">
        {error && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
            <strong className="font-semibold">{error}</strong> — start gateway with{' '}
            <code className="rounded bg-amber-100 px-1 dark:bg-amber-900">
              python capstone/gateway/main.py
            </code>
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-12">
          <Card className={cn('lg:col-span-4 overflow-hidden', latestPass ? 'border-emerald-300/60' : 'border-red-300/60')}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Station status
                  </p>
                  <div
                    className={cn(
                      'mt-2 inline-flex items-center gap-2 rounded-xl px-4 py-3 text-2xl font-extrabold tracking-tight',
                      latestPass
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                    )}
                  >
                    {latestPass ? <CheckCircle2 className="h-7 w-7" /> : <XCircle className="h-7 w-7" />}
                    {latest?.decision ?? 'NO DATA'}
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {latest
                      ? `${latest.predicted_class.replace(/_/g, ' ')} · conf ${latest.confidence.toFixed(2)} · θ ${(latest.threshold ?? threshold).toFixed(2)}`
                      : 'Waiting for first inspection…'}
                  </p>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <div className="font-mono">{latest?.node_id ?? '—'}</div>
                  <div className="font-mono">{latest ? formatTime(latest.received_at ?? latest.capture_ts) : '—'}</div>
                  <div className="mt-2 rounded-md border px-2 py-1">
                    avg conf{' '}
                    <strong className="tabular-nums text-foreground">
                      {avgConfidence.toFixed(2)}
                    </strong>
                  </div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-muted/50 p-2">
                  <div className="text-[10px] uppercase text-muted-foreground">Temp</div>
                  <div className="text-sm font-semibold tabular-nums">
                    {latest?.sensors?.temp_c != null ? `${latest.sensors.temp_c}°` : '—'}
                  </div>
                </div>
                <div className="rounded-lg bg-muted/50 p-2">
                  <div className="text-[10px] uppercase text-muted-foreground">RH</div>
                  <div className="text-sm font-semibold tabular-nums">
                    {latest?.sensors?.humidity_pct != null ? `${latest.sensors.humidity_pct}%` : '—'}
                  </div>
                </div>
                <div className="rounded-lg bg-muted/50 p-2">
                  <div className="text-[10px] uppercase text-muted-foreground">Light</div>
                  <div
                    className={cn(
                      'text-sm font-semibold',
                      latest?.sensors?.light_ok === false ? 'text-amber-600' : 'text-emerald-600'
                    )}
                  >
                    {latest?.sensors?.light_ok === false ? 'OUT' : latest ? 'OK' : '—'}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-4">
            <CardContent className="p-5">
              <GaugeRing
                value={passRate}
                label="Pass rate"
                sub={`${stats?.pass ?? 0} pass · ${stats?.fail ?? 0} fail · ${stats?.total ?? 0} total`}
                color="#22c55e"
              />
              <div className="mt-4 grid grid-cols-3 gap-2 border-t pt-4 text-center text-xs">
                <div>
                  <div className="text-muted-foreground">θ</div>
                  <div className="text-base font-bold tabular-nums text-primary">
                    {threshold.toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Edge p95</div>
                  <div className="text-base font-bold tabular-nums">
                    {stats?.latency_edge_p95_ms != null ? `${stats.latency_edge_p95_ms}` : '—'}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Model</div>
                  <div className="truncate font-mono text-[11px] font-semibold">
                    {latest?.model_version ?? '—'}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-4">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-base">Threshold θ</CardTitle>
                  <CardDescription>Input → output DR demo</CardDescription>
                </div>
                <div className="rounded-lg border bg-muted/40 px-3 py-1 text-right">
                  <div className="text-xl font-bold tabular-nums text-primary">
                    {threshold.toFixed(2)}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
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
                aria-label="Decision threshold"
              />
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span>0.50 permissive</span>
                <span>0.72 default</span>
                <span>0.95 strict</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-md bg-muted/50 px-2 py-1.5">
                  Pass-rate trend
                  <Sparkline values={recentTrend} stroke="#22c55e" />
                </div>
                <div className="rounded-md bg-muted/50 px-2 py-1.5">
                  Edge latency
                  <Sparkline values={recentLatency} stroke="#f59e0b" />
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Raise θ to flip borderline units PASS → FAIL (test plan §4.1).
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {kpis.map((k) => (
            <Card key={k.label} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {k.label}
                    </p>
                    <p className="mt-1 truncate text-2xl font-bold tabular-nums">{k.value}</p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{k.hint}</p>
                    <div className="mt-2 text-muted-foreground">
                      <Sparkline values={k.spark} stroke={k.sparkColor} height={28} />
                    </div>
                  </div>
                  <div
                    className={cn(
                      'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                      toneClasses[k.tone]
                    )}
                  >
                    <k.icon className="h-4 w-4" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <CardTitle className="text-lg">Live verdicts</CardTitle>
                  <CardDescription>
                    {filteredRows.length} / {rows.length} shown · shortcuts P / F / R / /
                  </CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex rounded-lg border p-0.5">
                    {(['all', 'PASS', 'FAIL'] as DecisionFilter[]).map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setDecisionFilter(f)}
                        className={cn(
                          'rounded-md px-2.5 py-1 text-xs font-semibold transition-colors',
                          decisionFilter === f
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:text-foreground'
                        )}
                      >
                        {f === 'all' ? 'All' : f}
                      </button>
                    ))}
                  </div>

                  <div className="relative">
                    <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <input
                      ref={searchRef}
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search  /"
                      className="h-8 w-36 rounded-md border bg-background pl-7 pr-2 text-xs outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>

                  <div className="relative">
                    <select
                      value={classFilter}
                      onChange={(e) => setClassFilter(e.target.value)}
                      className="h-8 appearance-none rounded-md border bg-background pl-2 pr-7 text-xs outline-none focus:ring-2 focus:ring-ring"
                      aria-label="Filter by class"
                    >
                      <option value="all">All classes</option>
                      {classOptions.map((c) => (
                        <option key={c} value={c}>
                          {c.replace(/_/g, ' ')}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="max-h-[520px] overflow-auto p-0">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 border-b bg-muted/95 backdrop-blur">
                  <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-2.5 font-semibold">#</th>
                    <th className="px-3 py-2.5 font-semibold">Time</th>
                    <th className="px-3 py-2.5 font-semibold">Decision</th>
                    <th className="px-3 py-2.5 font-semibold">Class</th>
                    <th className="px-3 py-2.5 font-semibold">Conf</th>
                    <th className="px-3 py-2.5 font-semibold">θ</th>
                    <th className="px-3 py-2.5 font-semibold">Cut / Line</th>
                    <th className="px-3 py-2.5 font-semibold">Light</th>
                    <th className="px-3 py-2.5 font-semibold">Edge</th>
                    <th className="px-3 py-2.5 font-semibold">Age</th>
                    <th className="px-3 py-2.5 font-semibold">Model</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.length === 0 && (
                    <tr>
                      <td colSpan={11} className="px-3 py-10 text-center text-muted-foreground">
                        No matching inspections. Try Demo PASS/FAIL or clear filters.
                      </td>
                    </tr>
                  )}
                  {filteredRows.map((r, idx) => {
                    const age = ageMs(r.received_at ?? r.capture_ts);
                    const isPass = r.decision === 'PASS';
                    const conf = r.confidence;
                    return (
                      <tr
                        key={r.id}
                        className={cn(
                          'border-b last:border-0 transition-colors hover:bg-muted/40',
                          idx === 0 && 'animate-row-in',
                          idx % 2 === 1 && 'bg-muted/20'
                        )}
                      >
                        <td className="px-3 py-2 font-mono text-xs">{r.seq ?? r.id}</td>
                        <td className="px-3 py-2 font-mono text-xs">
                          {formatTime(r.received_at ?? r.capture_ts)}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={cn(
                              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold',
                              isPass
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                : 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                            )}
                          >
                            {isPass ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
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
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <span className="w-9 font-mono tabular-nums">{conf.toFixed(2)}</span>
                            <div className="h-1.5 w-12 overflow-hidden rounded-full bg-muted">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${Math.round(conf * 100)}%`,
                                  backgroundColor: conf >= threshold ? '#22c55e' : '#f59e0b',
                                }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2 font-mono tabular-nums">
                          {(r.threshold ?? 0).toFixed(2)}
                        </td>
                        <td className="px-3 py-2 text-xs">
                          {r.cut_no != null ? `C${r.cut_no}` : '—'} · {r.product_line ?? '—'}
                        </td>
                        <td className="px-3 py-2">
                          {r.sensors?.light_ok === false ? (
                            <span className="font-semibold text-amber-600 dark:text-amber-400">OUT</span>
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
                        <td className="px-3 py-2 font-mono text-[11px]">
                          {r.model_version ?? '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Defect mix</CardTitle>
                <CardDescription>
                  {defectTotal > 0 ? `${defectTotal} classified` : 'No data yet'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
                  {defectEntries.map(([cls, count]) => (
                    <div
                      key={cls}
                      title={`${cls}: ${count}`}
                      style={{
                        width: `${defectTotal ? (count / defectTotal) * 100 : 0}%`,
                        backgroundColor: classColor(cls),
                      }}
                    />
                  ))}
                </div>
                {defectEntries.length === 0 && (
                  <p className="text-sm text-muted-foreground">No data yet</p>
                )}
                {defectEntries.map(([cls, count]) => {
                  const pct = defectTotal ? (count / defectTotal) * 100 : 0;
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
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
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

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Operator cheatsheet
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs text-muted-foreground">
                <div className="flex justify-between"><span>Demo PASS</span><kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono">P</kbd></div>
                <div className="flex justify-between"><span>Demo FAIL</span><kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono">F</kbd></div>
                <div className="flex justify-between"><span>Refresh</span><kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono">R</kbd></div>
                <div className="flex justify-between"><span>Search</span><kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono">/</kbd></div>
                <div className="flex justify-between"><span>Clear focus</span><kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono">Esc</kbd></div>
                <div className="mt-3 rounded-md bg-muted/50 p-2 leading-relaxed">
                  Node <span className="font-mono text-foreground">{latest?.node_id ?? '—'}</span>
                  <br />
                  Gateway <span className="font-mono text-foreground">{GATEWAY}</span>
                  <br />
                  Stats{' '}
                  <span className="font-mono text-foreground">
                    {stats?.updated_at ? formatTime(stats.updated_at) : '—'}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pb-6 text-xs text-muted-foreground">
          <p>
            DR-01 accuracy · DR-02 response time · DR-06 telemetry · docs{' '}
            <code>capstone/docs/</code>
          </p>
          <p className="font-mono">{GATEWAY}</p>
        </div>
      </section>

      {toast && (
        <div
          role="status"
          className={cn(
            'fixed bottom-5 right-5 z-50 rounded-lg border px-4 py-2.5 text-sm font-medium shadow-lg',
            toast.tone === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300'
              : 'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300'
          )}
        >
          {toast.text}
        </div>
      )}
    </main>
  );
}
