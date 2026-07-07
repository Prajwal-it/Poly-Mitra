import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Download, Filter, Loader2, Search } from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import SiteLayout, { SectionHeading } from "../components/SiteLayout";
import {
  Badge, Button, Input, Select, SelectContent, SelectItem, SelectTrigger,
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "../components/ui";
import { fetchCutoffs, fetchBranches, fetchCategories, fetchYears } from "../lib/api";

const ALL = "__all__";
const PAGE_SIZE = 40;

export default function Cutoffs() {
  // ── Meta state (years / rounds / branches / categories from API) ─────────────
  const [yearsMeta, setYearsMeta] = useState([]); // [{ year, rounds[] }]
  const [branches, setBranches] = useState([]);
  const [categories, setCategories] = useState([]);
  const [metaLoading, setMetaLoading] = useState(true);

  // ── Filter state ─────────────────────────────────────────────────────────────
  const [year, setYear] = useState("");
  const [round, setRound] = useState("");
  const [branch, setBranch] = useState(ALL);
  const [category, setCategory] = useState(ALL);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);

  // ── Cutoff records state ─────────────────────────────────────────────────────
  const [records, setRecords] = useState([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [dataLoading, setDataLoading] = useState(false);

  // ── Load meta on mount ───────────────────────────────────────────────────────
  useEffect(() => {
    async function loadMeta() {
      setMetaLoading(true);
      try {
        const [ym, brs, cats] = await Promise.all([
          fetchYears(),
          fetchBranches(),
          fetchCategories(),
        ]);
        setYearsMeta(ym);
        setBranches(brs);
        setCategories(cats);
        if (ym.length > 0) {
          const latest = ym[ym.length - 1];
          setYear(String(latest.year));
          if (latest.rounds.length > 0) setRound(String(latest.rounds[0]));
        }
      } catch (e) {
        console.error("Failed to load cutoff meta:", e);
      } finally {
        setMetaLoading(false);
      }
    }
    loadMeta();
  }, []);

  // ── Fetch cutoffs whenever filters change ────────────────────────────────────
  useEffect(() => {
    if (!year || !round) return;
    async function load() {
      setDataLoading(true);
      try {
        const params = {
          year,
          round,
          page,
          limit: PAGE_SIZE,
        };
        if (branch !== ALL) params.branchName = branch;
        if (category !== ALL) params.category = category;
        if (q.trim()) params.collegeName = q.trim();

        const res = await fetchCutoffs(params);
        setRecords(res.data || []);
        setTotalRecords(res.totalRecords || 0);
        setTotalPages(res.totalPages || 1);
      } catch (e) {
        console.error("Failed to fetch cutoffs:", e);
      } finally {
        setDataLoading(false);
      }
    }
    load();
  }, [year, round, branch, category, q, page]);

  // ── Derived round options for selected year ──────────────────────────────────
  const roundsForYear = useMemo(() => {
    const found = yearsMeta.find((y) => String(y.year) === String(year));
    return found ? found.rounds : [];
  }, [yearsMeta, year]);

  // When year changes, reset round to first available
  function handleYearChange(v) {
    setYear(v);
    setPage(1);
    const found = yearsMeta.find((y) => String(y.year) === v);
    if (found && found.rounds.length > 0) setRound(String(found.rounds[0]));
    else setRound("");
  }

  // ── Trend data (currently just from loaded records — aggregated by year) ─────
  // We compute average/max from current page records grouped by year
  const trendData = useMemo(() => {
    const grouped = {};
    records.forEach((r) => {
      if (!grouped[r.year]) grouped[r.year] = [];
      grouped[r.year].push(r.percentage);
    });
    return Object.entries(grouped)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([y, vals]) => ({
        year: y,
        average: Number((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2)),
        highest: Number(Math.max(...vals).toFixed(2)),
      }));
  }, [records]);

  // ── CSV export ───────────────────────────────────────────────────────────────
  const exportCsv = () => {
    const header = ["College", "Branch", "Category", "Round", "Year", "Rank", "Percentage"];
    const rows = records.map((r) => [
      r.collegeName, r.branchName, r.category, r.round, r.year, r.rank ?? "", r.percentage ?? "",
    ]);
    const csv = [header, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `polymitra-cutoffs-${year}-r${round}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <SiteLayout>
      <section className="bg-hero-gradient border-b border-border">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-14 lg:py-20">
          <SectionHeading
            eyebrow="Cutoff Explorer"
            title="Search CAP cutoff records"
            desc="Filter by year, round, branch and category. Export to CSV or visualise trends."
          />
        </div>
      </section>

      <section className="py-10 lg:py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

          {metaLoading ? (
            <div className="flex items-center justify-center h-40 gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" /> Loading available years and filters…
            </div>
          ) : (
            <Tabs defaultValue="table">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <TabsList>
                  <TabsTrigger value="table">Data Table</TabsTrigger>
                  <TabsTrigger value="trend">Trend</TabsTrigger>
                </TabsList>
                <Button variant="outline" size="sm" onClick={exportCsv}>
                  <Download className="h-4 w-4" /> Download CSV
                </Button>
              </div>

              {/* ── Filter Bar ── */}
              <div className="mt-4 rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-card">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-3">
                  <Filter className="h-3.5 w-3.5" /> Filters
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  {/* Year */}
                  <FilterField label="Year">
                    <Select value={year} onChange={handleYearChange}>
                      <SelectTrigger>{year || "Year"}</SelectTrigger>
                      <SelectContent>
                        {yearsMeta.map((y) => (
                          <SelectItem key={y.year} value={String(y.year)}>{y.year}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FilterField>

                  {/* Round */}
                  <FilterField label="Round">
                    <Select value={round} onChange={(v) => { setRound(v); setPage(1); }}>
                      <SelectTrigger>{round ? `Round ${round}` : "Round"}</SelectTrigger>
                      <SelectContent>
                        {roundsForYear.map((r) => (
                          <SelectItem key={r} value={String(r)}>Round {r}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FilterField>

                  {/* Branch */}
                  <FilterField label="Branch">
                    <Select value={branch} onChange={(v) => { setBranch(v); setPage(1); }}>
                      <SelectTrigger>{branch === ALL ? "All Branches" : branch}</SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ALL}>All Branches</SelectItem>
                        {branches.map((b) => (
                          <SelectItem key={b} value={b}>{b}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FilterField>

                  {/* Category */}
                  <FilterField label="Category">
                    <Select value={category} onChange={(v) => { setCategory(v); setPage(1); }}>
                      <SelectTrigger>{category === ALL ? "All" : category}</SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ALL}>All</SelectItem>
                        {categories.map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FilterField>

                  {/* Search college */}
                  <FilterField label="Search">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="College name" className="pl-9" />
                    </div>
                  </FilterField>
                </div>
              </div>

              {/* ── Data Table ── */}
              <TabsContent value="table" className="mt-6">
                <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-card">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-surface">
                        <tr className="text-left text-xs text-muted-foreground">
                          <th className="px-5 py-3 font-medium">College</th>
                          <th className="px-5 py-3 font-medium">Branch</th>
                          <th className="px-5 py-3 font-medium">Category</th>
                          <th className="px-5 py-3 font-medium">Round</th>
                          <th className="px-5 py-3 font-medium">Rank</th>
                          <th className="px-5 py-3 font-medium">Percentage</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dataLoading ? (
                          <tr>
                            <td colSpan={6} className="py-14 text-center">
                              <Loader2 className="h-6 w-6 animate-spin text-brand mx-auto" />
                            </td>
                          </tr>
                        ) : records.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-14 text-center text-muted-foreground text-sm">
                              No cutoff data matches these filters.
                            </td>
                          </tr>
                        ) : records.map((r, i) => (
                          <motion.tr
                            key={r._id || i}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: i * 0.01 }}
                            className="border-t border-border hover:bg-surface/60"
                          >
                            <td className="px-5 py-3.5 font-medium max-w-xs truncate">{r.collegeName}</td>
                            <td className="px-5 py-3.5 text-muted-foreground text-xs">{r.branchName}</td>
                            <td className="px-5 py-3.5"><Badge variant="secondary">{r.category}</Badge></td>
                            <td className="px-5 py-3.5">R{r.round}</td>
                            <td className="px-5 py-3.5 font-mono">{r.rank?.toLocaleString("en-IN") ?? "—"}</td>
                            <td className="px-5 py-3.5 font-semibold text-brand">{r.percentage ?? "—"}%</td>
                          </motion.tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="border-t border-border px-5 py-3 text-xs text-muted-foreground bg-surface flex items-center justify-between">
                    <span>Showing {records.length} of {totalRecords.toLocaleString("en-IN")} records</span>
                    {totalPages > 1 && (
                      <div className="flex gap-2 items-center">
                        <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Prev</Button>
                        <span>Page {page}/{totalPages}</span>
                        <Button size="sm" variant="outline" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>

              {/* ── Trend chart ── */}
              <TabsContent value="trend" className="mt-6">
                <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
                  <h3 className="font-display font-bold">Cutoff trend (current page data)</h3>
                  <p className="text-xs text-muted-foreground">Average vs. highest cutoff for current filters</p>
                  <div className="mt-6 h-80">
                    {trendData.length > 0 ? (
                      <ResponsiveContainer>
                        <LineChart data={trendData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis dataKey="year" stroke="#64748b" fontSize={12} />
                          <YAxis stroke="#64748b" fontSize={12} domain={[50, 100]} />
                          <Tooltip contentStyle={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 12 }} />
                          <Legend wrapperStyle={{ fontSize: 12 }} />
                          <Line dataKey="average" stroke="#2563eb" strokeWidth={2.5} dot={{ r: 5 }} />
                          <Line dataKey="highest" stroke="#10b981" strokeWidth={2.5} dot={{ r: 5 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full grid place-items-center text-muted-foreground text-sm">
                        No data to show. Apply filters and load records first.
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </div>
      </section>
    </SiteLayout>
  );
}

function FilterField({ label, children }) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}
