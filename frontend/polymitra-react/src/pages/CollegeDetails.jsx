import { Link, useParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, Building2, FileText, Loader2,
} from "lucide-react";
import {
  CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import SiteLayout from "../components/SiteLayout";
import { Badge, Button } from "../components/ui";
import { fetchCutoffsByCollege } from "../lib/api";

export default function CollegeDetails() {
  const { id } = useParams(); // id = collegeCode

  const [college, setCollege] = useState(null);
  const [cutoffs, setCutoffs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const cutoffData = await fetchCutoffsByCollege(id);
        const records = Array.isArray(cutoffData) ? cutoffData : [];
        setCutoffs(records);
        // Derive college info from the first cutoff record
        if (records.length > 0) {
          setCollege({
            collegeCode: records[0].collegeCode,
            collegeName: records[0].collegeName,
          });
        } else {
          setCollege(null);
        }
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  // Year-wise cutoff trend for top 3 branches (OPEN category only)
  const branches = useMemo(
    () => [...new Set(cutoffs.map((r) => r.branchName))].slice(0, 3),
    [cutoffs]
  );

  const years = useMemo(
    () => [...new Set(cutoffs.map((r) => r.year))].sort(),
    [cutoffs]
  );

  const trendData = useMemo(
    () =>
      years.map((y) => {
        const point = { year: String(y) };
        branches.forEach((b) => {
          const row = cutoffs.find(
            (r) => r.year === y && r.branchName === b && r.round === 1 &&
              r.category?.toUpperCase().includes("OPEN")
          );
          point[b] = row?.percentage ?? null;
        });
        return point;
      }),
    [years, branches, cutoffs]
  );

  // Latest round cutoffs table
  const latestYear = years[years.length - 1];
  const latestCutoffs = cutoffs
    .filter((r) => r.year === latestYear && r.round === 1)
    .slice(0, 15);

  if (loading) {
    return (
      <SiteLayout>
        <div className="flex h-96 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-brand" />
        </div>
      </SiteLayout>
    );
  }

  if (error || !college) {
    return (
      <SiteLayout>
        <div className="flex h-96 flex-col items-center justify-center gap-3">
          <p className="text-lg font-semibold text-muted-foreground">
            {error || "College not found"}
          </p>
          <Link to="/colleges">
            <Button variant="outline">← Back to Colleges</Button>
          </Link>
        </div>
      </SiteLayout>
    );
  }

  return (
    <SiteLayout>
      {/* ── Hero ── */}
      <section className="bg-hero-gradient border-b border-border">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-14 lg:py-16">
          <Link to="/colleges" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-brand">
            <ArrowLeft className="h-4 w-4" /> Back to colleges
          </Link>
          <div className="mt-6 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-brand text-white shadow-elegant">
                <Building2 className="h-8 w-8" />
              </div>
              <div>
                <p className="text-xs font-mono text-muted-foreground">Institute Code · {college.collegeCode}</p>
                <h1 className="mt-1 font-display text-3xl sm:text-4xl font-extrabold leading-tight max-w-3xl">
                  {college.collegeName}
                </h1>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge variant="secondary">Code: {college.collegeCode}</Badge>
                  <Badge variant="outline">{cutoffs.length} cutoff records</Badge>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Link to="/predictor">
                <Button>Predict My Chance</Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Content ── */}
      <section className="py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-8">

            {/* Basic info */}
            <Card title="Basic Information" icon={FileText}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Info label="College Code" value={String(college.collegeCode)} />
                <Info label="District" value={college.district || "—"} />
                <Info label="City" value={college.city || "—"} />
                <Info label="Cutoff Records" value={`${cutoffs.length} entries`} />
              </div>
            </Card>

            {/* Latest cutoffs table */}
            {latestCutoffs.length > 0 && (
              <Card title={`Cutoffs · ${latestYear} · Round 1`} icon={FileText}>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-muted-foreground border-b border-border">
                        <th className="py-2.5 font-medium">Branch</th>
                        <th className="py-2.5 font-medium">Category</th>
                        <th className="py-2.5 font-medium">Rank</th>
                        <th className="py-2.5 font-medium">Percentage</th>
                      </tr>
                    </thead>
                    <tbody>
                      {latestCutoffs.map((r, i) => (
                        <tr key={i} className="border-b border-border/60">
                          <td className="py-3 text-xs">{r.branchName}</td>
                          <td className="py-3"><Badge variant="secondary">{r.category}</Badge></td>
                          <td className="py-3 font-mono text-xs">{r.rank?.toLocaleString("en-IN") ?? "—"}</td>
                          <td className="py-3 font-semibold text-brand">{r.percentage ?? "—"}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

            {/* Trend chart */}
            {trendData.length > 0 && branches.length > 0 && (
              <Card title="Cutoff Trend · OPEN Category · Round 1" icon={FileText}>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="year" stroke="#64748b" fontSize={12} />
                      <YAxis stroke="#64748b" fontSize={12} domain={[50, 100]} />
                      <Tooltip contentStyle={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 12 }} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      {branches.map((b, i) => (
                        <Line
                          key={b}
                          type="monotone"
                          dataKey={b}
                          stroke={["#2563eb", "#10b981", "#f59e0b"][i]}
                          strokeWidth={2.5}
                          dot={{ r: 4 }}
                          connectNulls
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            )}
          </div>

          {/* ── Sidebar ── */}
          <aside className="space-y-6">
            <Card title="Available Years" icon={FileText}>
              <div className="flex flex-wrap gap-2">
                {years.length > 0
                  ? years.map((y) => <Badge key={y} variant="secondary">{y}</Badge>)
                  : <p className="text-sm text-muted-foreground">No data</p>
                }
              </div>
            </Card>

            <Card title="Branches Offered" icon={FileText}>
              <div className="flex flex-wrap gap-2">
                {[...new Set(cutoffs.map((r) => r.branchName))].slice(0, 12).map((b) => (
                  <Badge key={b} variant="outline" className="text-xs">{b}</Badge>
                ))}
              </div>
            </Card>


          </aside>
        </div>
      </section>
    </SiteLayout>
  );
}

function Card({ title, icon: Icon, children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="rounded-2xl border border-border bg-card p-6 shadow-card"
    >
      <div className="flex items-center gap-2.5">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-brand/10 text-brand">
          <Icon className="h-4 w-4" />
        </div>
        <h2 className="font-display text-base font-bold">{title}</h2>
      </div>
      <div className="mt-5">{children}</div>
    </motion.div>
  );
}

function Info({ label, value }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}
