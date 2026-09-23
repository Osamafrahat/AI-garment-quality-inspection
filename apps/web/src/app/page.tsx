import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Activity,
  ArrowRight,
  Cpu,
  FileCheck2,
  Gauge,
  ScanEye,
  ShieldCheck,
} from 'lucide-react';

const features = [
  {
    icon: ScanEye,
    title: 'Defect Detection',
    desc: 'On-device model classifies pass/fail garment defects with confidence scores and class labels.',
  },
  {
    icon: Gauge,
    title: 'Response Time',
    desc: 'Edge inference tracked with p95 latency on Raspberry Pi 5 hardware for DR-02 evidence.',
  },
  {
    icon: ShieldCheck,
    title: 'Accuracy ≥ 80%',
    desc: 'Held-out evaluation accuracy 90% with full metrics, threshold reports, and confusion matrix.',
  },
  {
    icon: Cpu,
    title: 'Edge + Gateway',
    desc: 'Firmware self-test, FastAPI gateway, and live sensor telemetry in one exhibition-ready loop.',
  },
  {
    icon: Activity,
    title: 'Live Dashboard',
    desc: 'Real-time inspection stream, pass rate, latency KPIs, and defect mix in a control-room UI.',
  },
  {
    icon: FileCheck2,
    title: 'Audit Trail',
    desc: 'Every decision stored with model version, decision threshold θ, and sensor context.',
  },
];

const steps = [
  { n: '01', title: 'Capture', text: 'Camera + sensors on the Pi collect the piece under inspection.' },
  { n: '02', title: 'Decide', text: 'Edge model returns class, confidence, and PASS/FAIL at threshold θ.' },
  { n: '03', title: 'Publish', text: 'Gateway stores the verdict and streams it to the dashboard.' },
  { n: '04', title: 'Demonstrate', text: 'Change θ or hit Demo PASS/FAIL — output visibly flips.' },
];

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <header className="border-b bg-background/85 backdrop-blur sticky top-0 z-20">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <ScanEye className="h-5 w-5" />
            </div>
            <span className="text-xl font-bold tracking-tight">ThreadSight</span>
          </div>
          <nav className="hidden md:flex items-center gap-6">
            <Link href="/inspection" className="text-sm font-medium text-muted-foreground hover:text-foreground">
              Inspection
            </Link>
            <a href="#features" className="text-sm font-medium text-muted-foreground hover:text-foreground">
              Features
            </a>
            <a href="#how" className="text-sm font-medium text-muted-foreground hover:text-foreground">
              How it works
            </a>
          </nav>
          <div className="flex items-center gap-4">
            <Link href="/inspection">
              <Button>
                Open Dashboard
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <section className="py-20 md:py-28">
        <div className="container mx-auto px-4 text-center">
          <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-live-dot" />
            Pathway A · Industrial Base · Capstone
          </div>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
            AI Garment Quality
            <br />
            Inspection
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
            Edge-to-dashboard quality control for garment manufacturing — measurable accuracy,
            response time, and defect recall, ready for exhibition demonstration.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/inspection">
              <Button size="lg" className="w-full sm:w-auto">
                Open Live Dashboard
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <a href="#how">
              <Button size="lg" variant="outline" className="w-full sm:w-auto">
                See how it works
              </Button>
            </a>
          </div>

          <div className="mt-14 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto">
            {[
              { k: 'Accuracy', v: '90%' },
              { k: 'Defect recall', v: '100%' },
              { k: 'FRR', v: '1.3%' },
              { k: 'Edge p95', v: '≤ 476 ms' },
            ].map((m) => (
              <Card key={m.k} className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="text-2xl font-bold tabular-nums text-primary">{m.v}</div>
                  <div className="text-xs text-muted-foreground mt-1">{m.k}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="py-16 bg-muted/50">
        <div className="container mx-auto px-4">
          <div className="mb-10 text-center">
            <h2 className="text-3xl font-bold tracking-tight">Built for the exhibition floor</h2>
            <p className="mt-2 text-muted-foreground max-w-xl mx-auto">
              Everything required to prove Pathway A requirements with live, inspectable output.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <Card key={i} className="border-0 shadow-sm hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <feature.icon className="h-5 w-5" />
                  </div>
                  <CardTitle className="text-xl">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{feature.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section id="how" className="py-16">
        <div className="container mx-auto px-4">
          <div className="mb-10 text-center">
            <h2 className="text-3xl font-bold tracking-tight">How it works</h2>
            <p className="mt-2 text-muted-foreground">Four steps from fabric to verdict.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((s) => (
              <Card key={s.n} className="border-0 shadow-sm">
                <CardHeader className="pb-2">
                  <div className="text-sm font-bold text-primary">{s.n}</div>
                  <CardTitle className="text-lg">{s.title}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">{s.text}</CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 bg-muted/50">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to inspect the line?</h2>
          <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
            Open the live console, nudge the decision threshold, and watch PASS/FAIL flip in
            real time.
          </p>
          <Link href="/inspection">
            <Button size="lg">
              Launch inspection console
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      <footer className="border-t py-12">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} ThreadSight — Capstone AI garment quality inspection.
        </div>
      </footer>
    </main>
  );
}
