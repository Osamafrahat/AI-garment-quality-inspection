'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

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

function ageMs(iso?: string | null): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.max(0, Date.now() - t);
}

export default function InspectionDashboardPage() {
  const [rows, setRows] = useState<Inspection[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [threshold, setThreshold] = useState(0.7);
  const [online, setOnline] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const thresholdRef = useRef(0.7);

  const refresh = useCallback(async () => {
    try {
      const [listRes, statsRes, thrRes] = await Promise.all([
        fetch(`${GATEWAY}/api/v1/inspections?limit=40`),
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
    setBusy(true);
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
      setBusy(false);
    }
  };

  const kpis = useMemo(() => {
    const latest = rows[0];
    return [
      { label: 'Total inspections', value: stats?.total ?? rows.length },
      { label: 'Pass', value: stats?.pass ?? 0 },
      { label: 'Fail', value: stats?.fail ?? 0 },
      {
        label: 'Pass rate',
        value:
          stats?.pass_rate != null ? `${(stats.pass_rate * 100).toFixed(1)}%` : '—',
      },
      {
        label: 'Edge p95',
        value: stats?.latency_edge_p95_ms != null ? `${stats.latency_edge_p95_ms} ms` : '—',
      },
      {
        label: 'E2E p95',
        value: stats?.latency_e2e_p95_ms != null ? `${stats.latency_e2e_p95_ms} ms` : '—',
      },
      { label: 'θ threshold', value: threshold.toFixed(2) },
      {
        label: 'Node',
        value: latest?.node_id ?? '—',
      },
    ];
  }, [rows, stats, threshold]);

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-xl font-bold">ThreadSight Inspection</span>
            <span
              className={`text-xs px-2 py-1 rounded-full ${
                online ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}
            >
              {online ? 'GATEWAY ONLINE' : 'OFFLINE'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => simulate('pass')} disabled={busy}>
              Demo PASS
            </Button>
            <Button variant="destructive" size="sm" onClick={() => simulate('fail')} disabled={busy}>
              Demo FAIL
            </Button>
            <Button variant="ghost" size="sm" onClick={refresh}>
              Refresh
            </Button>
            <Link href="/">
              <Button variant="ghost" size="sm">Home</Button>
            </Link>
          </div>
        </div>
      </header>

      <section className="container mx-auto px-4 py-6 space-y-6">
        {error && (
          <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {error} — start the gateway (<code>python capstone/gateway/main.py</code>) and a
            simulator/edge node. Dashboard: <code>http://localhost:3000/inspection</code> ·
            Gateway: <code>{GATEWAY}</code>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {kpis.map((k) => (
            <Card key={k.label}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {k.label}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-bold">{k.value}</CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Decision threshold θ (input → output demo)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <input
              type="range"
              min={0.5}
              max={0.95}
              step={0.01}
              value={threshold}
              onChange={(e) => pushThreshold(Number(e.target.value))}
              className="w-full"
              data-testid="threshold-slider"
            />
            <p className="text-sm text-muted-foreground">
              Current θ = <strong>{threshold.toFixed(2)}</strong>. Raise θ to make borderline
              pieces flip PASS → FAIL (DR demonstration, test plan §4.1).
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Live verdicts</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40">
                <tr className="text-left">
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">Time</th>
                  <th className="px-3 py-2">Decision</th>
                  <th className="px-3 py-2">Class</th>
                  <th className="px-3 py-2">Conf</th>
                  <th className="px-3 py-2">θ</th>
                  <th className="px-3 py-2">Cut / Line</th>
                  <th className="px-3 py-2">Lux</th>
                  <th className="px-3 py-2">Light</th>
                  <th className="px-3 py-2">Edge ms</th>
                  <th className="px-3 py-2">Age</th>
                  <th className="px-3 py-2">Model</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={12} className="px-3 py-6 text-center text-muted-foreground">
                      No inspections yet. Run edge node or Demo buttons.
                    </td>
                  </tr>
                )}
                {rows.map((r) => {
                  const age = ageMs(r.received_at ?? r.capture_ts);
                  return (
                    <tr key={r.id} className="border-b last:border-0">
                      <td className="px-3 py-2 font-mono text-xs">{r.seq ?? r.id}</td>
                      <td className="px-3 py-2 font-mono text-xs">
                        {(r.received_at ?? r.capture_ts ?? '').slice(11, 23)}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-semibold ${
                            r.decision === 'PASS'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {r.decision}
                        </span>
                      </td>
                      <td className="px-3 py-2">{r.predicted_class}</td>
                      <td className="px-3 py-2 font-mono">{r.confidence.toFixed(2)}</td>
                      <td className="px-3 py-2 font-mono">{(r.threshold ?? 0).toFixed(2)}</td>
                      <td className="px-3 py-2 text-xs">
                        {r.cut_no != null ? `C${r.cut_no}` : '—'} · {r.product_line ?? '—'}
                      </td>
                      <td className="px-3 py-2 font-mono">{r.sensors?.lux ?? '—'}</td>
                      <td className="px-3 py-2">
                        {r.sensors?.light_ok === false ? (
                          <span className="text-amber-600 font-semibold">OUT</span>
                        ) : (
                          <span className="text-green-700">OK</span>
                        )}
                      </td>
                      <td className="px-3 py-2 font-mono">{r.latency_ms?.edge ?? '—'}</td>
                      <td className="px-3 py-2 font-mono text-xs">
                        {age != null ? `${age} ms` : '—'}
                      </td>
                      <td className="px-3 py-2 text-xs font-mono">{r.model_version ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Defect mix</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {Object.entries(stats?.by_class ?? {}).map(([cls, count]) => (
              <span
                key={cls}
                className="px-3 py-1 rounded-full bg-muted text-sm font-medium"
              >
                {cls}: {count}
              </span>
            ))}
            {!stats?.by_class || Object.keys(stats.by_class).length === 0 ? (
              <span className="text-sm text-muted-foreground">No data yet</span>
            ) : null}
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground">
          Capstone · Pathway A Industrial Base · DR-01 accuracy · DR-02 response time · DR-06
          telemetry · Docs: <code>capstone/docs/</code>
        </p>
      </section>
    </main>
  );
}
