import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Car, Shield, DollarSign, Calendar, Users, TrendingUp } from 'lucide-react';

const features = [
  { icon: Car, title: 'Fleet Management', desc: 'Track vehicles, maintenance, and availability in real-time' },
  { icon: Calendar, title: 'Smart Booking', desc: 'Online reservations with dynamic pricing and availability' },
  { icon: DollarSign, title: 'Automated Billing', desc: 'Invoices, payments, and Stripe integration out of the box' },
  { icon: Shield, title: 'Damage Tracking', desc: 'Pre/post-rental inspections with photos and signatures' },
  { icon: Users, title: 'Customer Portal', desc: 'Self-service booking, history, and loyalty program' },
  { icon: TrendingUp, title: 'Analytics Dashboard', desc: 'Revenue, utilization, and operational metrics' },
];

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Car className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold">CarRental</span>
          </div>
          <nav className="hidden md:flex items-center gap-6">
            <Link href="/features" className="text-sm font-medium text-muted-foreground hover:text-foreground">Features</Link>
            <Link href="/pricing" className="text-sm font-medium text-muted-foreground hover:text-foreground">Pricing</Link>
            <Link href="/docs" className="text-sm font-medium text-muted-foreground hover:text-foreground">Docs</Link>
          </nav>
          <div className="flex items-center gap-4">
            <Link href="/auth/signin"><Button variant="ghost">Sign in</Button></Link>
            <Link href="/auth/signup"><Button>Get Started</Button></Link>
          </div>
        </div>
      </header>

      <section className="py-20 md:py-32">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
            Complete Car Rental<br />Management Platform
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
            Fleet tracking, online bookings, automated billing, damage inspections,
            and analytics — all in one modern platform built for rental businesses.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/auth/signup"><Button size="lg" className="w-full sm:w-auto">Start Free Trial</Button></Link>
            <Link href="/demo"><Button size="lg" variant="outline" className="w-full sm:w-auto">View Demo</Button></Link>
          </div>
        </div>
      </section>

      <section className="py-20 bg-muted/50">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <Card key={i} className="border-0 shadow-sm">
                <CardHeader>
                  <feature.icon className="h-10 w-10 text-primary mb-4" />
                  <CardTitle>{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{feature.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to streamline your rental business?</h2>
          <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
            Join hundreds of rental companies using CarRental to manage their fleet,
            bookings, and billing efficiently.
          </p>
          <Link href="/auth/signup"><Button size="lg">Start Free Trial</Button></Link>
        </div>
      </section>

      <footer className="border-t py-12">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Car className="h-6 w-6 text-primary" />
                <span className="font-bold">CarRental</span>
              </div>
              <p className="text-sm text-muted-foreground">Modern car rental management platform.</p>
            </div>
            <nav>
              <h4 className="font-medium mb-3">Product</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/features" className="hover:text-foreground">Features</Link></li>
                <li><Link href="/pricing" className="hover:text-foreground">Pricing</Link></li>
                <li><Link href="/docs" className="hover:text-foreground">Documentation</Link></li>
                <li><Link href="/changelog" className="hover:text-foreground">Changelog</Link></li>
              </ul>
            </nav>
            <nav>
              <h4 className="font-medium mb-3">Company</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/about" className="hover:text-foreground">About</Link></li>
                <li><Link href="/blog" className="hover:text-foreground">Blog</Link></li>
                <li><Link href="/careers" className="hover:text-foreground">Careers</Link></li>
                <li><Link href="/contact" className="hover:text-foreground">Contact</Link></li>
              </ul>
            </nav>
            <nav>
              <h4 className="font-medium mb-3">Legal</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/privacy" className="hover:text-foreground">Privacy</Link></li>
                <li><Link href="/terms" className="hover:text-foreground">Terms</Link></li>
                <li><Link href="/security" className="hover:text-foreground">Security</Link></li>
              </ul>
            </nav>
          </div>
          <div className="border-t mt-8 pt-8 text-center text-sm text-muted-foreground">
            © {new Date().getFullYear()} CarRental. All rights reserved.
          </div>
        </div>
      </footer>
    </main>
  );
}