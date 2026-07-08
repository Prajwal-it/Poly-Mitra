import { Link } from "react-router-dom";
import { motion, useInView } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight, BarChart3, Building2, LineChart, Search, Sparkles,
  TrendingUp, Users, School, MapPin, ShieldCheck, CheckCircle2, BookOpen,
} from "lucide-react";
import SiteLayout, { SectionHeading } from "../components/SiteLayout";
import { Button } from "../components/ui";
import { fetchYears } from "../lib/api";

export default function Home() {
  return (
    <SiteLayout>
      <Hero />
      <Features />
      <Stats />
      <Why />
      <CTA />
    </SiteLayout>
  );
}

function Hero() {
  return (
    <section className="bg-hero-gradient relative overflow-hidden">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-10 pb-14 sm:pt-14 sm:pb-20 lg:pt-24 lg:pb-32">
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-16 items-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <div className="inline-flex items-center gap-2 rounded-full border border-brand/20 bg-white/70 px-3 py-1 text-xs font-medium text-brand">
              <Sparkles className="h-3.5 w-3.5" />
              Admission Season 2026 · CAP Rounds Live
            </div>
            <h1 className="mt-4 font-display text-3xl sm:text-5xl lg:text-6xl font-extrabold leading-[1.08] tracking-tight">
              Maharashtra Polytechnic <span className="text-gradient-brand">Admission Helper</span>
            </h1>
            <p className="mt-4 max-w-xl text-sm sm:text-lg text-muted-foreground leading-relaxed">
              Find previous year cutoffs, explore colleges, and predict your
              admission chances using an ML model — all in one clean, trustworthy dashboard.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/colleges"><Button size="lg" className="shadow-elegant"><Building2 className="h-4 w-4" /> Explore Colleges</Button></Link>
              <Link to="/predictor"><Button size="lg" variant="outline"><Sparkles className="h-4 w-4" /> Predict Admission</Button></Link>
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-success" /> DTE-aligned data</span>
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-success" /> 3 years of records</span>
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-success" /> Free for students</span>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.15 }} className="hidden lg:block">
            <HeroVisual />
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function HeroVisual() {
  const cards = [
    { icon: School, label: "Colleges", value: "300+", tint: "brand" },
    { icon: BookOpen, label: "Cutoff Records", value: "94,000+", tint: "success" },
    { icon: TrendingUp, label: "Admission Years", value: "3", tint: "brand" },
    { icon: Users, label: "ML-Powered", value: "CatBoost", tint: "success" },
  ];
  return (
    <div className="relative">
      <div className="relative rounded-3xl border border-border bg-white shadow-card p-5 sm:p-8">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Live Snapshot</p>
            <h3 className="mt-1 font-display font-bold text-base sm:text-lg">Maharashtra CAP 2025</h3>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 text-success px-2.5 py-1 text-xs font-medium">
            <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" /> Round 1 Open
          </span>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2 sm:gap-3">
          {cards.map((c, i) => (
            <motion.div key={c.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + i * 0.08 }} className="rounded-xl border border-border bg-surface p-3 sm:p-4">
              <div className={`grid h-8 w-8 sm:h-9 sm:w-9 place-items-center rounded-lg ${c.tint === "brand" ? "bg-brand/10 text-brand" : "bg-success/10 text-success"}`}>
                <c.icon className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              <p className="mt-2 sm:mt-3 text-xs text-muted-foreground">{c.label}</p>
              <p className="mt-0.5 font-display text-lg sm:text-xl font-bold">{c.value}</p>
            </motion.div>
          ))}
        </div>
        <div className="mt-4 sm:mt-6 rounded-xl border border-border p-3 sm:p-4">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium">Cutoff Trend · Computer Engg</span>
            <span className="text-muted-foreground">2023 → 2025</span>
          </div>
          <div className="mt-3 flex items-end gap-1 sm:gap-2 h-16 sm:h-24">
            {[62, 70, 74, 78, 82, 85, 88, 91, 94].map((h, i) => (
              <motion.div key={i} initial={{ height: 0 }} animate={{ height: `${h}%` }} transition={{ duration: 0.7, delay: 0.4 + i * 0.05 }} className="flex-1 rounded-t-md bg-gradient-to-t from-brand to-brand/40" />
            ))}
          </div>
        </div>
      </div>
      <motion.div animate={{ y: [0, -10, 0] }} transition={{ repeat: Infinity, duration: 5, ease: "easeInOut" }} className="hidden sm:flex absolute -top-6 -left-6 items-center gap-2 rounded-xl border border-border bg-white shadow-card px-3 py-2">
        <MapPin className="h-4 w-4 text-brand" />
        <span className="text-xs font-medium">Maharashtra · 300+ Colleges</span>
      </motion.div>
      <motion.div animate={{ y: [0, 10, 0] }} transition={{ repeat: Infinity, duration: 6, ease: "easeInOut" }} className="hidden sm:flex absolute -bottom-5 -right-4 items-center gap-2 rounded-xl border border-border bg-white shadow-card px-3 py-2">
        <Sparkles className="h-4 w-4 text-success" />
        <span className="text-xs font-medium">ML-powered predictions</span>
      </motion.div>
    </div>
  );
}

function Features() {
  const items = [
    { icon: BarChart3, title: "Previous Year Cutoffs", desc: "View year-wise and round-wise cutoff trends across every institute." },
    { icon: Building2, title: "College Directory", desc: "Browse every polytechnic with district and city filters." },
    { icon: Sparkles, title: "Admission Predictor", desc: "Predict chances using historical cutoff data and a trained ML model (CatBoost)." },
    { icon: School, title: "Branch-wise Data", desc: "Branch-level cutoff records across all CAP categories." },
    { icon: LineChart, title: "Trend Analysis", desc: "Visualize cutoff movement over multiple years and rounds." },
    { icon: Search, title: "Smart Search", desc: "Search colleges and branches instantly with real-time filtering." },
  ];
  return (
    <section className="py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading eyebrow="Everything you need" title="Complete admission toolkit for polytechnic aspirants" desc="Focused modules that turn scattered CAP data into confident admission decisions." />
        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((f, i) => (
            <motion.div key={f.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-60px" }} transition={{ duration: 0.4, delay: i * 0.05 }} className="group rounded-2xl border border-border bg-card p-6 transition-all hover:-translate-y-1 hover:shadow-card hover:border-brand/30">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-brand/10 text-brand transition-colors group-hover:bg-brand group-hover:text-white">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-5 font-display text-lg font-bold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Stats() {
  const items = [
    { value: 315, suffix: "+", label: "Polytechnic Colleges" },
    { value: 94000, suffix: "+", label: "Historical Cutoff Records" },
    { value: 3, suffix: "", label: "Admission Years (2023–2025)" },
    { value: 4, suffix: "", label: "CAP Rounds Covered" },
  ];
  return (
    <section className="py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-border bg-gradient-to-br from-surface-2 to-surface p-8 sm:p-12">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {items.map((s) => (
              <div key={s.label} className="text-center">
                <p className="font-display text-4xl sm:text-5xl font-extrabold text-brand">
                  <Counter to={s.value} />{s.suffix}
                </p>
                <p className="mt-2 text-sm font-medium text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Counter({ to }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const start = performance.now();
    const dur = 1400;
    let raf = 0;
    const tick = (now) => {
      const p = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(to * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, to]);
  return <span ref={ref}>{val.toLocaleString("en-IN")}</span>;
}

function Why() {
  const steps = [
    { icon: Search, title: "Search College", desc: "Filter 300+ polytechnics by district and city." },
    { icon: BarChart3, title: "View Cutoffs", desc: "Compare year-wise and round-wise cutoffs by category." },
    { icon: Sparkles, title: "Predict Chances", desc: "Get your admission probability from our ML model." },
    { icon: CheckCircle2, title: "Apply Confidently", desc: "Lock your CAP preferences with data-backed confidence." },
  ];
  return (
    <section className="bg-surface py-20 lg:py-28 border-y border-border">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading eyebrow="Why PolyMitra?" title="From confused to confident, in four steps" desc="A simple workflow that mirrors how counsellors actually think about CAP admissions." />
        <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, i) => (
            <motion.div key={s.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }} className="relative rounded-2xl border border-border bg-card p-6">
              <div className="absolute -top-3 left-6 rounded-full bg-brand text-white text-xs font-bold px-2.5 py-1">Step {i + 1}</div>
              <div className="mt-3 grid h-11 w-11 place-items-center rounded-xl bg-brand/10 text-brand">
                <s.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-display text-lg font-bold">{s.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section className="pb-16 sm:pb-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl bg-gradient-to-br from-brand to-blue-800 p-8 sm:p-14 text-white shadow-elegant">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
              <h3 className="font-display text-xl sm:text-3xl font-extrabold max-w-xl leading-tight">Ready to find the right polytechnic college?</h3>
              <p className="mt-3 text-sm sm:text-base text-white/85 max-w-xl">Run your first prediction in under a minute. Free, ad-free, and built for Maharashtra CAP.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link to="/predictor"><Button size="lg" variant="secondary">Try Predictor <ArrowRight className="h-4 w-4" /></Button></Link>
              <Link to="/colleges"><Button size="lg" variant="outline" className="!bg-transparent !border-white/40 !text-white hover:!bg-white/10">Browse Colleges</Button></Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
