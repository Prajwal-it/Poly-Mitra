import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Award, Database, Heart, ShieldCheck, Sparkles, Users } from "lucide-react";
import SiteLayout, { SectionHeading } from "../components/SiteLayout";
import { Button } from "../components/ui";

export default function About() {
  const values = [
    { icon: ShieldCheck, title: "Trust first", desc: "Data sourced from DTE CAP releases. No paid rankings, no sponsored colleges." },
    { icon: Database, title: "Transparent data", desc: "Every prediction shows the underlying cutoff, category and confidence." },
    { icon: Heart, title: "Student-owned", desc: "Built by students who went through Maharashtra CAP themselves." },
    { icon: Award, title: "Free forever", desc: "Core admission tools are free — no login walls between you and information." },
  ];
  return (
    <SiteLayout>
      <section className="bg-hero-gradient border-b border-border">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
          <SectionHeading eyebrow="About PolyMitra" title="Making Maharashtra polytechnic admissions transparent and stress-free" desc="PolyMitra brings together three years of CAP cutoffs, complete college directories and a data-driven predictor — so every polytechnic aspirant can make an informed choice." />
          <div className="mt-8">
            <Link to="/predictor"><Button>Try the predictor <ArrowRight className="h-4 w-4" /></Button></Link>
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 grid gap-12 lg:grid-cols-2 items-start">
          <div>
            <h2 className="font-display text-3xl font-extrabold tracking-tight">Our mission</h2>
            <p className="mt-5 text-muted-foreground leading-relaxed">
              Every year, thousands of students in Maharashtra apply to polytechnic programmes through the Directorate of Technical Education's CAP process. Most rely on WhatsApp forwards, PDFs and coaching centres to interpret cutoffs. We built PolyMitra to change that — to give every student a clean, honest window into the numbers that actually decide admissions.
            </p>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              PolyMitra is not a coaching brand. We do not sell rankings. We aggregate publicly released CAP data, structure it and let it speak for itself.
            </p>
          </div>
          <div className="rounded-3xl border border-border bg-surface p-8">
            <div className="grid grid-cols-2 gap-6">
              {[
                { icon: Users, label: "Students Helped", value: "12,500+" },
                { icon: Database, label: "Cutoff Records", value: "94,000+" },
                { icon: Award, label: "Colleges Indexed", value: "315+" },
                { icon: Sparkles, label: "Predictions Run", value: "48,000+" },
              ].map((s) => (
                <div key={s.label}>
                  <div className="grid h-10 w-10 place-items-center rounded-lg bg-brand text-white">
                    <s.icon className="h-5 w-5" />
                  </div>
                  <p className="mt-4 font-display text-3xl font-extrabold">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-surface border-y border-border py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading eyebrow="What we stand for" title="Four values that shape every screen" />
          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {values.map((v, i) => (
              <motion.div key={v.title} initial={{ opacity: 0, y: 15 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }} className="rounded-2xl border border-border bg-card p-6">
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-brand/10 text-brand">
                  <v.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 font-display font-bold">{v.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{v.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
