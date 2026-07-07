import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft, Building2, ChevronDown, ChevronUp, Loader2, MapPin,
  Search, SlidersHorizontal,
} from "lucide-react";
import SiteLayout from "../components/SiteLayout";
import { Button } from "../components/ui";
import { fetchCollegeList, fetchCutoffsByCollege, fetchYears } from "../lib/api";
import {
  REGIONS, REGION_DISTRICTS, ALL_DISTRICTS, COLLEGE_TYPES,
  extractDistrict, extractRegion, extractType,
} from "../lib/maharashtra";

// ── Standard Category Columns mapping (matching the Vercel app screenshot) ──

const STANDARD_COLUMNS = [
  "OPEN (M)", "OBC (M)", "SEBC (M)", "SC (M)", "ST (M)",
  "OPEN (F)", "OBC (F)", "SEBC (F)", "SC (F)", "ST (F)",
  "EWS", "TFWS"
];

function mapToStandard(raw) {
  if (!raw) return null;
  const u = raw.toUpperCase().trim();
  
  if (u === "EWS") return "EWS";
  if (u === "TFWS") return "TFWS";

  // Check if it's a female category (starts with L, NL, TL)
  const isFemale = u.startsWith("L") || u.startsWith("NL") || u.startsWith("TL");

  if (u.includes("OPEN")) return isFemale ? "OPEN (F)" : "OPEN (M)";
  if (u.includes("OBC"))  return isFemale ? "OBC (F)" : "OBC (M)";
  if (u.includes("SEBC")) return isFemale ? "SEBC (F)" : "SEBC (M)";
  if (u.includes("SC") || /SC(?!H)/.test(u)) return isFemale ? "SC (F)" : "SC (M)";
  if (u.includes("ST"))   return isFemale ? "ST (F)" : "ST (M)";
  if (u.includes("VJ") || u.includes("DT") || u.includes("NTA")) return isFemale ? "OPEN (F)" : "OPEN (M)"; // fallback
  if (u.includes("NTB"))  return isFemale ? "OBC (F)" : "OBC (M)"; // fallback
  if (u.includes("NTC"))  return isFemale ? "OBC (F)" : "OBC (M)"; // fallback
  if (u.includes("NTD"))  return isFemale ? "OBC (F)" : "OBC (M)"; // fallback
  if (u.includes("SBC"))  return isFemale ? "OBC (F)" : "OBC (M)"; // fallback
  
  return isFemale ? "OPEN (F)" : "OPEN (M)"; // default fallback
}

// ── Type badge styles ─────────────────────────────────────────────────────────

const TYPE_STYLE = {
  "Government":           "bg-emerald-100 text-emerald-700",
  "Aided":                "bg-blue-100 text-blue-700",
  "Un-Aided":             "bg-gray-100 text-gray-600",
  "University Department":"bg-purple-100 text-purple-700",
};

const ALL = "__all__";
const PAGE_SIZE = 20;

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Colleges() {
  // Year / round meta
  const [yearsMeta, setYearsMeta] = useState([]);
  const [year, setYear]           = useState("");
  const [round, setRound]         = useState("");
  const [metaLoading, setMetaLoading] = useState(true);

  // College list
  const [colleges, setColleges]       = useState([]);
  const [listLoading, setListLoading] = useState(true);

  // Filters
  const [q, setQ]             = useState("");
  const [region, setRegion]   = useState(ALL);
  const [district, setDistrict] = useState(ALL);
  const [taluka, setTaluka]   = useState("");
  const [type, setType]       = useState(ALL);
  const [minPct, setMinPct]   = useState("");
  const [maxPct, setMaxPct]   = useState("");
  const [page, setPage]       = useState(1);

  // Lazy cutoff state
  const [expanded, setExpanded]             = useState(new Set());
  const [cutoffLoading, setCutoffLoading]   = useState({});
  const [cutoffData, setCutoffData]         = useState({});
  const cache = useRef({});

  // ── Init: load years + college list ──────────────────────────────────────────
  useEffect(() => {
    async function init() {
      try {
        const [ym, cols] = await Promise.all([fetchYears(), fetchCollegeList()]);
        setYearsMeta(ym);
        if (ym.length > 0) {
          const latest = ym[ym.length - 1];
          setYear(String(latest.year));
          if (latest.rounds.length > 0) setRound(String(latest.rounds[0]));
        }
        // Enrich each college with derived region / district / type
        const enriched = (Array.isArray(cols) ? cols : []).map((c) => ({
          ...c,
          district: extractDistrict(c.collegeName),
          region:   extractRegion(c.collegeName),
          type:     extractType(c.collegeName),
        }));
        setColleges(enriched);
      } catch (e) {
        console.error("Init failed:", e);
      } finally {
        setMetaLoading(false);
        setListLoading(false);
      }
    }
    init();
  }, []);

  // ── Round options for selected year ──────────────────────────────────────────
  const roundsForYear = useMemo(() => {
    const found = yearsMeta.find((y) => String(y.year) === year);
    return found ? found.rounds : [];
  }, [yearsMeta, year]);

  // ── Districts dropdown (respects region selection) ────────────────────────────
  const availableDistricts = useMemo(() => {
    if (region === ALL) return ALL_DISTRICTS;
    return REGION_DISTRICTS[region] ? [...REGION_DISTRICTS[region]].sort() : [];
  }, [region]);

  // When region changes → reset district
  function handleRegionChange(v) {
    setRegion(v);
    setDistrict(ALL);
    setPage(1);
  }

  // ── Filtered college list ─────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const talukaTerm = taluka.trim().toLowerCase();
    return colleges.filter((c) => {
      if (region   !== ALL && c.region   !== region)   return false;
      if (district !== ALL && c.district !== district) return false;
      if (type     !== ALL && c.type     !== type)     return false;
      // Taluka matching (checks name since taluka/city info is part of the college name/address)
      if (talukaTerm && !c.collegeName?.toLowerCase().includes(talukaTerm)) return false;
      
      if (term) {
        const searchWords = term.split(/[\s,]+/).filter(Boolean);
        const nameCodeStr = `${c.collegeName} ${c.collegeCode}`.toLowerCase();
        const matchesAll = searchWords.every((word) => nameCodeStr.includes(word));
        if (!matchesAll) return false;
      }
      return true;
    });
  }, [colleges, q, region, district, type, taluka]);

  // ── Pagination ────────────────────────────────────────────────────────────────
  const pages   = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const slice   = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  // ── Lazy cutoff load ──────────────────────────────────────────────────────────
  const toggle = useCallback(async (code) => {
    const isOpen = expanded.has(code);
    setExpanded((prev) => {
      const next = new Set(prev);
      isOpen ? next.delete(code) : next.add(code);
      return next;
    });
    if (!isOpen && !cache.current[code]) {
      setCutoffLoading((p) => ({ ...p, [code]: true }));
      try {
        const data = await fetchCutoffsByCollege(code);
        const records = Array.isArray(data) ? data : [];
        cache.current[code] = records;
        setCutoffData((p) => ({ ...p, [code]: records }));
      } catch {
        cache.current[code] = [];
        setCutoffData((p) => ({ ...p, [code]: [] }));
      } finally {
        setCutoffLoading((p) => ({ ...p, [code]: false }));
      }
    }
  }, [expanded]);

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <SiteLayout>
      {/* ── Header + filters ── */}
      <div className="border-b border-border bg-hero-gradient">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">

          {/* Title row */}
          <div className="flex items-center gap-3 mb-1">
            <button
              onClick={() => window.history.back()}
              className="rounded-md p-1 text-muted-foreground hover:text-brand transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="font-display text-2xl font-bold">College & Cutoff Explorer</h1>
              <p className="text-sm text-muted-foreground">
                Search any college to view its previous year CAP cutoffs across all categories
              </p>
            </div>
          </div>

          {/* Search bar */}
          <div className="mt-5 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <input
              className="w-full rounded-xl border border-border bg-white pl-12 pr-4 py-3.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition"
              placeholder="Search by college name, branch, or choice code…"
              value={q}
              onChange={(e) => { setQ(e.target.value); setPage(1); }}
            />
          </div>

          {/* ── Filter row ── */}
          <div className="mt-3 flex flex-wrap items-center gap-2">

            {/* All Regions */}
            <div className="relative flex items-center">
              <MapPin className="absolute left-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none z-10" />
              <select
                value={region}
                onChange={(e) => handleRegionChange(e.target.value)}
                className="pl-7 pr-8 py-2 rounded-lg border border-border bg-white text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-brand/30 appearance-none cursor-pointer"
              >
                <option value={ALL}>All Regions</option>
                {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              <ChevronDown className="absolute right-2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            </div>

            {/* All Districts */}
            <div className="relative flex items-center">
              <MapPin className="absolute left-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none z-10" />
              <select
                value={district}
                onChange={(e) => { setDistrict(e.target.value); setPage(1); }}
                className="pl-7 pr-8 py-2 rounded-lg border border-border bg-white text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-brand/30 appearance-none cursor-pointer"
              >
                <option value={ALL}>All Districts</option>
                {availableDistricts.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
              <ChevronDown className="absolute right-2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            </div>

            {/* Taluka search box */}
            <div className="relative flex items-center">
              <MapPin className="absolute left-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none z-10" />
              <input
                type="text"
                placeholder="Search Taluka..."
                value={taluka}
                onChange={(e) => { setTaluka(e.target.value); setPage(1); }}
                className="pl-7 pr-3 py-2 rounded-lg border border-border bg-white text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-brand/30 w-28"
              />
            </div>

            {/* All Types */}
            <div className="relative flex items-center">
              <Building2 className="absolute left-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none z-10" />
              <select
                value={type}
                onChange={(e) => { setType(e.target.value); setPage(1); }}
                className="pl-7 pr-8 py-2 rounded-lg border border-border bg-white text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-brand/30 appearance-none cursor-pointer"
              >
                <option value={ALL}>All Types</option>
                {COLLEGE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <ChevronDown className="absolute right-2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            </div>

            {/* Divider */}
            <span className="w-px h-6 bg-border mx-1" />

            {/* Year */}
            {!metaLoading && (
              <div className="relative flex items-center">
                <select
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-border bg-white text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-brand/30 appearance-none cursor-pointer pr-7"
                >
                  {yearsMeta.map((y) => (
                    <option key={y.year} value={String(y.year)}>{y.year}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              </div>
            )}

            {/* Round */}
            {!metaLoading && (
              <div className="relative flex items-center">
                <select
                  value={round}
                  onChange={(e) => setRound(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-border bg-white text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-brand/30 appearance-none cursor-pointer pr-7"
                >
                  {roundsForYear.map((r) => (
                    <option key={r} value={String(r)}>Round {r}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              </div>
            )}

            {/* Min / Max % */}
            <div className="flex items-center gap-1">
              <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="number"
                className="w-20 rounded-lg border border-border px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-brand/30"
                placeholder="Min %"
                value={minPct}
                onChange={(e) => { setMinPct(e.target.value); setPage(1); }}
              />
              <span className="text-muted-foreground text-xs">–</span>
              <input
                type="number"
                className="w-20 rounded-lg border border-border px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-brand/30"
                placeholder="Max %"
                value={maxPct}
                onChange={(e) => { setMaxPct(e.target.value); setPage(1); }}
              />
            </div>

            {/* College count */}
            <span className="ml-auto text-sm font-semibold text-muted-foreground">
              {listLoading ? "…" : `${filtered.length} colleges`}
            </span>
          </div>
        </div>
      </div>

      {/* ── College list ── */}
      <section className="py-8 bg-slate-50/50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {listLoading ? (
            <div className="flex justify-center py-24">
              <Loader2 className="h-8 w-8 animate-spin text-brand" />
            </div>
          ) : slice.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="space-y-3">
              {slice.map((col) => (
                <CollegeCard
                  key={col.collegeCode}
                  college={col}
                  isOpen={expanded.has(col.collegeCode)}
                  onToggle={() => toggle(col.collegeCode)}
                  loading={!!cutoffLoading[col.collegeCode]}
                  records={cutoffData[col.collegeCode]}
                  year={Number(year)}
                  round={Number(round)}
                  minPct={minPct !== "" ? Number(minPct) : null}
                  maxPct={maxPct !== "" ? Number(maxPct) : null}
                />
              ))}
            </div>
          )}

          {/* Pagination */}
          {!listLoading && pages > 1 && (
            <div className="mt-8 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Page {current} of {pages}</p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={current === 1} onClick={() => setPage((p) => p - 1)}>
                  Prev
                </Button>
                <Button size="sm" variant="outline" disabled={current === pages} onClick={() => setPage((p) => p + 1)}>
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      </section>
    </SiteLayout>
  );
}

// ── College card ──────────────────────────────────────────────────────────────

function CollegeCard({ college, isOpen, onToggle, loading, records, year, round, minPct, maxPct }) {
  // Filter records for selected year / round / pct range
  const filtered = useMemo(() => {
    if (!records) return [];
    return records.filter((r) => {
      if (year  && r.year  !== year)  return false;
      if (round && r.round !== round) return false;
      if (minPct !== null && r.percentage < minPct) return false;
      if (maxPct !== null && r.percentage > maxPct) return false;
      return true;
    });
  }, [records, year, round, minPct, maxPct]);

  // Distinct branches
  const branches = useMemo(() => {
    const seen = new Map();
    filtered.forEach((r) => {
      if (!seen.has(r.branchName))
        seen.set(r.branchName, { name: r.branchName, code: r.branchCode });
    });
    return [...seen.values()];
  }, [filtered]);

  // Pivot: branchName → standardCategory → { pct, rank }
  const pivot = useMemo(() => {
    const m = {};
    filtered.forEach((r) => {
      const std = mapToStandard(r.category);
      if (!std) return;
      if (!m[r.branchName]) m[r.branchName] = {};

      const existing = m[r.branchName][std];
      // Keep the one with the higher percentage (conservative main cutoff)
      if (!existing || r.percentage > existing.pct) {
        m[r.branchName][std] = { pct: r.percentage, rank: r.rank };
      }
    });
    return m;
  }, [filtered]);

  const typeBadge = TYPE_STYLE[college.type] || TYPE_STYLE["Un-Aided"];

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-surface/60 transition-colors text-left"
      >
        <div className="flex items-start gap-3 min-w-0">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand/10 text-brand mt-0.5">
            <Building2 className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            {/* Tags */}
            <div className="flex flex-wrap items-center gap-1.5 mb-1">
              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md ${typeBadge}`}>
                {college.type}
              </span>
              {college.district && (
                <span className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground">
                  <MapPin className="h-3 w-3" /> {college.district}
                </span>
              )}
              {records !== undefined && (
                <span className="text-[11px] text-muted-foreground">
                  · {branches.length} branch{branches.length !== 1 ? "es" : ""}
                </span>
              )}
            </div>
            {/* Name */}
            <h3 className="font-display text-sm font-bold leading-snug">{college.collegeName}</h3>
            <p className="text-[11px] font-mono text-muted-foreground mt-0.5">{college.collegeCode}</p>
          </div>
        </div>
        <div className="shrink-0 ml-4">
          {loading
            ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            : isOpen
            ? <ChevronUp className="h-5 w-5 text-muted-foreground" />
            : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
        </div>
      </button>

      {/* Expandable cutoff table */}
      <AnimatePresence initial={false}>
        {isOpen && !loading && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeInOut" }}
            className="overflow-hidden border-t border-border"
          >
            {branches.length === 0 ? (
              <p className="px-6 py-6 text-center text-sm text-muted-foreground">
                No cutoff data for {year}, Round {round}.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-surface border-b border-border">
                      <th className="sticky left-0 z-10 bg-surface px-5 py-3 text-left font-semibold text-muted-foreground min-w-[200px]">
                        BRANCH
                      </th>
                      <th className="px-3 py-3 text-left font-semibold text-muted-foreground min-w-[90px]">
                        CODE
                      </th>
                      {STANDARD_COLUMNS.map((colName) => (
                        <th key={colName} className="px-3 py-3 text-right font-semibold text-muted-foreground min-w-[90px] whitespace-nowrap">
                          {colName}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {branches.map((b, i) => (
                      <tr key={b.name} className={`border-t border-border/50 ${i % 2 !== 0 ? "bg-surface/40" : ""}`}>
                        <td className="sticky left-0 z-10 bg-card px-5 py-3 font-medium text-brand min-w-[200px]">
                          {b.name}
                        </td>
                        <td className="px-3 py-3 font-mono text-muted-foreground">{b.code || "—"}</td>
                        {STANDARD_COLUMNS.map((colName) => {
                          const cell = pivot[b.name]?.[colName];
                          return (
                            <td key={colName} className="px-3 py-3 text-right">
                              {cell ? (
                                <>
                                  <p className="font-semibold text-foreground">{cell.pct}%</p>
                                  {cell.rank != null && (
                                    <p className="text-[10px] text-muted-foreground">
                                      Rank {cell.rank.toLocaleString("en-IN")}
                                    </p>
                                  )}
                                </>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-surface p-16 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand/10 text-brand">
        <Search className="h-6 w-6" />
      </div>
      <h3 className="mt-4 font-display text-lg font-bold">No colleges found</h3>
      <p className="mt-2 text-sm text-muted-foreground">Try adjusting the region, district or type filters.</p>
    </div>
  );
}
