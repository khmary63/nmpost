import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { FileText, Zap, BarChart3, Send, ArrowRight, CheckCircle2 } from "lucide-react";

const features = [
  { icon: FileText, title: "Smart Templates", desc: "5 pre-built templates for web design, consulting, development, marketing, and more." },
  { icon: Zap, title: "AI-Powered Writing", desc: "Let AI help you craft compelling proposals with context-aware suggestions." },
  { icon: BarChart3, title: "Live Tracking", desc: "Know exactly when clients open, view, and engage with your proposals." },
  { icon: Send, title: "One-Click Delivery", desc: "Send polished PDFs via email or shareable links in seconds." },
];

const benefits = [
  "Create proposals in minutes, not hours",
  "Dynamic pricing with real-time calculations",
  "Professional branding on every document",
  "Version history & auto-save",
  "Client management built in",
  "Export to PDF instantly",
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="border-b border-border/50 bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <FileText className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold font-display text-foreground">QuoteKit</span>
          </Link>
          <div className="flex items-center gap-3">
            <Button variant="ghost" asChild>
              <Link to="/login">Log in</Link>
            </Button>
            <Button asChild>
              <Link to="/signup">Get started free <ArrowRight className="ml-1 h-4 w-4" /></Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="container mx-auto px-4 py-24 text-center">
        <div className="mx-auto max-w-3xl animate-fade-in">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-sm text-muted-foreground">
            <Zap className="h-3.5 w-3.5 text-primary" />
            AI-powered proposal generation
          </div>
          <h1 className="font-display text-5xl font-extrabold tracking-tight text-foreground sm:text-6xl lg:text-7xl">
            Win more clients with
            <span className="block text-primary"> stunning proposals</span>
          </h1>
          <p className="mt-6 text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto">
            QuoteKit helps freelancers and agencies create professional, branded proposals in minutes. Smart templates, dynamic pricing, and AI-powered content — all in one place.
          </p>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Button size="lg" className="h-12 px-8 text-base" asChild>
              <Link to="/signup">Start creating proposals <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
            <Button size="lg" variant="outline" className="h-12 px-8 text-base" asChild>
              <Link to="/login">View demo</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="container mx-auto px-4 py-24">
        <div className="text-center mb-16">
          <h2 className="font-display text-3xl font-bold text-foreground sm:text-4xl">Everything you need to close deals faster</h2>
          <p className="mt-4 text-muted-foreground text-lg">From template to signed contract in record time.</p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <div key={f.title} className="group rounded-xl border border-border bg-card p-6 transition-all hover:shadow-md hover:border-primary/20">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-accent">
                <f.icon className="h-5 w-5 text-accent-foreground" />
              </div>
              <h3 className="font-display text-lg font-semibold text-card-foreground">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Benefits */}
      <section className="border-y border-border bg-card">
        <div className="container mx-auto px-4 py-24">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-3xl font-bold text-foreground sm:text-4xl">Why teams love QuoteKit</h2>
            <div className="mt-12 grid gap-4 text-left sm:grid-cols-2">
              {benefits.map((b) => (
                <div key={b} className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
                  <span className="text-foreground">{b}</span>
                </div>
              ))}
            </div>
            <Button size="lg" className="mt-12 h-12 px-8" asChild>
              <Link to="/signup">Get started — it's free <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="container mx-auto flex items-center justify-between px-4 py-8">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <FileText className="h-4 w-4" />
            <span>QuoteKit © {new Date().getFullYear()}</span>
          </div>
          <div className="flex gap-6 text-sm text-muted-foreground">
            <a href="#" className="hover:text-foreground transition-colors">Privacy</a>
            <a href="#" className="hover:text-foreground transition-colors">Terms</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
