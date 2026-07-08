import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, ArrowRight, CheckCircle2, Loader2, Sparkles, Target, Wifi, WifiOff } from "lucide-react";
import SiteLayout, { SectionHeading } from "../components/SiteLayout";
import {
  Button, Input, Label, Progress,
  SearchableSelect,
  Select, SelectContent, SelectItem, SelectTrigger,
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "../components/ui";
import { fetchCollegeList, postPredict, fetchCutoffsByCollege, warmupML, fetchMLStatus } from "../lib/api";

const PREDICTOR_CATEGORIES = [
  { value: "OPEN",  label: "OPEN (General)" },
  { value: "OBC",   label: "OBC" },
  { value: "SC",    label: "SC" },
  { value: "ST",    label: "ST" },
  { value: "EWS",   label: "EWS" },
  { value: "SEBC",  label: "SEBC" },
  { value: "NTB",   label: "NT-B" },
  { value: "NTC",   label: "NT-C" },
  { value: "NTD",   label: "NT-D" },
  { value: "TFWS",  label: "TFWS" },
  { value: "PWD",   label: "PWD" },
];

const SEAT_QUOTAS = [
  { value: "H", label: "Home District (H)",  hint: "Same district as college — e.g. NGOPENH" },
  { value: "O", label: "Other District (O)", hint: "Different district — e.g. NGOPENO" },
];

const STANDALONE_CATEGORIES = new Set(["EWS", "TFWS", "MI", "ORPHAN"]);

function previewCapCode(category, quota) {
  if (STANDALONE_CATEGORIES.has(category)) return category;
  return `NG${category}${quota}`;
}

const ROUNDS = [
  { v: "1", l: "Round 1" },
  { v: "2", l: "Round 2" },
  { v: "3", l: "Round 3" },
  { v: "4", l: "Round 4" },
];

// ── Warmup states ──────────────────────────────────────────────────────────────
// "checking"  → just mounted, first ping in flight
// "warming"   → server is reachable but model not ready yet
// "ready"     → model is ready
// "error"     → could not reach server at all after retries

const WARMUP_CHECK_INTERVAL_MS = 8000; // poll status every 8 s while warming up
const WARMUP_READY_HIDE_DELAY_MS = 3000; // hide "Ready!" banner after 3 s

export default function Predictor() {
  const [percentage, setPercentage] = useState("");
  const [category,   setCategory]   = useState("");
  const [college,    setCollege]     = useState("");
  const [branch,     setBranch]      = useState("");
  const [round,      setRound]       = useState("1");
  const [quota,      setQuota]       = useState("H");

  const [colleges,       setColleges]       = useState([]);
  const [branches,       setBranches]       = useState([]);
  const [metaLoading,    setMetaLoading]    = useState(true);
  const [branchesLoading,setBranchesLoading]= useState(false);

  const [loading,    setLoading]    = useState(false);
  const [result,     setResult]     = useState(null);
  const [error,      setError]      = useState(null);
  const [isFallback, setIsFallback] = useState(false);

  // ML service warmup tracking
  const [warmupState, setWarmupState] = useState("checking"); // "checking"|"warming"|"ready"|"error"
  const [warmupMsg,   setWarmupMsg]   = useState("Connecting to prediction server…");
  const warmupTimerRef   = useRef(null);
  const hideReadyTimerRef = useRef(null);

  // ── Warmup polling logic ───────────────────────────────────────────────────
  const checkWarmup = useCallback(async () => {
    try {
      // Use /warmup (which also pings Flask) for the first call,
      // then /status (cheap, no outbound request) for subsequent polls.
      const data = await warmupML();

      if (data.modelReady) {
        setWarmupState("ready");
        setWarmupMsg("Prediction server is ready!");
        // Auto-hide the "ready" banner after a short delay
        hideReadyTimerRef.current = setTimeout(
          () => setWarmupState(null),
          WARMUP_READY_HIDE_DELAY_MS
        );
        // Stop polling
        if (warmupTimerRef.current) {
          clearInterval(warmupTimerRef.current);
          warmupTimerRef.current = null;
        }
      } else if (data.success === false && !data.modelReady) {
        // Server reachable but model still loading
        setWarmupState("warming");
        setWarmupMsg("ML server is waking up — this takes up to 60 seconds on first use…");
      } else {
        // Server not reachable yet
        setWarmupState("warming");
        setWarmupMsg("Connecting to prediction server…");
      }
    } catch {
      setWarmupState("error");
      setWarmupMsg("Could not reach the prediction server. Predictions may be slow.");
    }
  }, []);

  // Load dropdowns + start warmup polling on mount
  useEffect(() => {
    // Start warmup immediately
    checkWarmup();
    // Poll every 8 s while still warming
    warmupTimerRef.current = setInterval(checkWarmup, WARMUP_CHECK_INTERVAL_MS);

    async function loadMeta() {
      setMetaLoading(true);
      try {
        const cols = await fetchCollegeList();
        setColleges(cols);
      } catch (e) {
        console.error("Failed to load predictor meta:", e);
      } finally {
        setMetaLoading(false);
      }
    }
    loadMeta();

    return () => {
      if (warmupTimerRef.current)    clearInterval(warmupTimerRef.current);
      if (hideReadyTimerRef.current) clearTimeout(hideReadyTimerRef.current);
    };
  }, [checkWarmup]);

  // Stop polling once ready or null (banner hidden)
  useEffect(() => {
    if (warmupState === "ready" || warmupState === null) {
      if (warmupTimerRef.current) {
        clearInterval(warmupTimerRef.current);
        warmupTimerRef.current = null;
      }
    }
  }, [warmupState]);

  const quotaHint = SEAT_QUOTAS.find((q) => q.value === quota)?.hint ?? "";

  const handleCollegeChange = async (colName) => {
    setCollege(colName);
    const selected = colleges.find((c) => c.collegeName === colName);
    if (!selected) {
      setBranches([]);
      setBranch("");
      return;
    }

    setBranchesLoading(true);
    try {
      const data   = await fetchCutoffsByCollege(selected.collegeCode);
      const unique = [...new Set(data.map((r) => r.branchName))].sort();
      setBranches(unique);
      setBranch("");
    } catch (e) {
      console.error("Failed to load branches for college:", e);
    } finally {
      setBranchesLoading(false);
    }
  };

  const onPredict = async () => {
    setLoading(true);
    setResult(null);
    setError(null);
    setIsFallback(false);

    const payload = {
      percentage: Number(percentage),
      college,
      branch,
      category,
      round: Number(round),
      year:  2026,
      quota,
    };

    try {
      // postPredict already has built-in retry (2 retries, 5s + 10s back-off)
      const res = await postPredict(payload);
      setResult(res.data);
      setIsFallback(res._fallback === true);
    } catch (e) {
      const msg    = e.message || "";
      const status = e.status;

      if (status === 504 || msg.toLowerCase().includes("timeout")) {
        setError(
          "The ML prediction server is taking too long to respond. " +
          "This usually means it was sleeping and needs 60–90 seconds to wake up. " +
          "Please wait a moment and try again."
        );
      } else if (status === 503 || msg.toLowerCase().includes("waking")) {
        setError(
          "The ML prediction server is still warming up. Please wait 30–60 seconds and try again."
        );
      } else if (msg === "Failed to fetch" || msg.toLowerCase().includes("network")) {
        setError(
          "Network error — could not reach the server. " +
          "Please check your internet connection and try again."
        );
      } else {
        setError(msg || "Prediction failed. Please check your inputs and try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const label = (opts, v) => opts.find((o) => o.v === v)?.l ?? v;

  return (
    <SiteLayout>
      <section className="bg-hero-gradient border-b border-border">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-16">
          <SectionHeading
            eyebrow="Admission Predictor"
            title="Predict your admission chances"
            desc="Enter your SSC percentage, select a college and branch. Our ML model estimates your cutoff and admission probability using historical CAP data."
          />
        </div>
      </section>

      {/* ── Warmup status banner ── */}
      <AnimatePresence>
        {warmupState && warmupState !== null && (
          <motion.div
            key="warmup-banner"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
          >
            <WarmupBanner state={warmupState} message={warmupMsg} />
          </motion.div>
        )}
      </AnimatePresence>

      <section className="py-6 sm:py-10 lg:py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 grid gap-6 lg:grid-cols-5">
          {/* ── Form ── */}
          <div className="lg:col-span-2">
            <div className="rounded-2xl border border-border bg-card p-6 sm:p-7 shadow-card lg:sticky lg:top-20">
              <div className="flex items-center gap-2.5">
                <div className="grid h-9 w-9 place-items-center rounded-lg bg-brand text-white">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-display font-bold">Prediction form</h3>
                  <p className="text-xs text-muted-foreground">Fill your details to get results</p>
                </div>
              </div>

              {metaLoading ? (
                <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading options from server…
                </div>
              ) : (
                <div className="mt-6 space-y-4">
                  <Field label="SSC Percentage">
                    <Input
                      type="number"
                      min={35}
                      max={100}
                      step={0.01}
                      value={percentage}
                      onChange={(e) => setPercentage(e.target.value)}
                      placeholder="e.g. 85.4"
                    />
                  </Field>

                  <Field label="College">
                    <SearchableSelect
                      value={college}
                      onChange={handleCollegeChange}
                      options={colleges}
                      placeholder="Select college"
                      searchPlaceholder="Search by name or code…"
                      getOptionValue={(c) => c.collegeName}
                      getOptionLabel={(c) => c.collegeName}
                      getSearchText={(c) => `${c.collegeName} ${c.collegeCode}`}
                    />
                  </Field>

                  <Field label="Branch">
                    <Select
                      value={branch}
                      onChange={setBranch}
                      disabled={branchesLoading || branches.length === 0}
                    >
                      <SelectTrigger>
                        {branchesLoading ? (
                          <span className="flex items-center gap-1.5 text-muted-foreground">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading branches...
                          </span>
                        ) : branch || "Select branch"}
                      </SelectTrigger>
                      <SelectContent>
                        {branches.map((b) => (
                          <SelectItem key={b} value={b}>{b}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field label="Seat Quota">
                    <Select value={quota} onChange={setQuota}>
                      <SelectTrigger>
                        {SEAT_QUOTAS.find((q) => q.value === quota)?.label || quota}
                      </SelectTrigger>
                      <SelectContent>
                        {SEAT_QUOTAS.map((q) => (
                          <SelectItem key={q.value} value={q.value}>{q.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {quotaHint}
                      {!STANDALONE_CATEGORIES.has(category) && (
                        <> · Predicting for <span className="font-medium text-foreground">{previewCapCode(category, quota)}</span></>
                      )}
                    </p>
                  </Field>

                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Category">
                      <Select value={category} onChange={setCategory}>
                        <SelectTrigger>
                          {PREDICTOR_CATEGORIES.find((c) => c.value === category)?.label || category || "Select category"}
                        </SelectTrigger>
                        <SelectContent>
                          {PREDICTOR_CATEGORIES.map((c) => (
                            <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Round">
                      <Select value={round} onChange={setRound}>
                        <SelectTrigger>{label(ROUNDS, round)}</SelectTrigger>
                        <SelectContent>
                          {ROUNDS.map((o) => (
                            <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>

                  <Button
                    className="w-full shadow-elegant"
                    size="lg"
                    onClick={onPredict}
                    disabled={loading || !percentage || !college || !branch || !category}
                  >
                    {loading
                      ? <><Loader2 className="h-4 w-4 animate-spin" /> Analysing…</>
                      : <><Sparkles className="h-4 w-4" /> Predict Admission</>
                    }
                  </Button>

                  <p className="text-[11px] text-muted-foreground flex items-start gap-1.5">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    Results are indicative estimates based on previous CAP data. Final admission depends on DTE CAP rounds.
                    {warmupState === "warming" && (
                      <> · <span className="text-amber-600 font-medium">ML server warming up — first prediction may take longer.</span></>
                    )}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* ── Results ── */}
          <div className="lg:col-span-3">
            {loading && <LoadingResults />}
            {!loading && error  && <ErrorState message={error} onRetry={onPredict} />}
            {!loading && !error && !result && <EmptyPrediction />}
            {!loading && !error && result  && <ResultCard result={result} college={college} branch={branch} isFallback={isFallback} />}
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}

// ── Warmup banner component ────────────────────────────────────────────────────

function WarmupBanner({ state, message }) {
  const styles = {
    checking: "bg-blue-50   border-blue-200   text-blue-700",
    warming:  "bg-amber-50  border-amber-200  text-amber-700",
    ready:    "bg-green-50  border-green-200  text-green-700",
    error:    "bg-orange-50 border-orange-200 text-orange-700",
  };

  const Icon =
    state === "ready"   ? CheckCircle2 :
    state === "error"   ? WifiOff      :
    state === "warming" ? Wifi         :
    Loader2;

  return (
    <div className={`border-b px-4 py-2 ${styles[state] || styles.checking}`}>
      <div className="mx-auto max-w-7xl flex items-center gap-2 text-xs font-medium">
        <Icon
          className={`h-3.5 w-3.5 shrink-0 ${(state === "checking" || state === "warming") ? "animate-spin" : ""}`}
        />
        <span>{message}</span>
        {state === "warming" && (
          <span className="ml-auto opacity-70">Retrying automatically…</span>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Field({ label, children }) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function LoadingResults() {
  return (
    <div className="rounded-2xl border border-border bg-card p-8 shadow-card">
      <div className="animate-pulse space-y-4">
        <div className="h-6 w-40 rounded bg-surface-2" />
        <div className="h-4 w-64 rounded bg-surface" />
        <div className="grid gap-3 mt-6">
          {[1, 2, 3].map((i) => <div key={i} className="h-24 rounded-xl bg-surface" />)}
        </div>
      </div>
    </div>
  );
}

function EmptyPrediction() {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-surface p-8 sm:p-14 text-center h-full grid place-items-center">
      <div>
        <div className="mx-auto grid h-14 w-14 sm:h-16 sm:w-16 place-items-center rounded-2xl bg-brand/10 text-brand">
          <Target className="h-6 w-6 sm:h-7 sm:w-7" />
        </div>
        <h3 className="mt-4 font-display text-lg sm:text-xl font-bold">Ready when you are</h3>
        <p className="mt-2 text-sm text-muted-foreground max-w-sm mx-auto">
          Select a college, branch and category above, then hit Predict to see your admission probability.
        </p>
      </div>
    </div>
  );
}

function ErrorState({ message, onRetry }) {
  return (
    <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-10 text-center space-y-4">
      <AlertCircle className="h-8 w-8 text-destructive mx-auto" />
      <h3 className="font-display text-lg font-bold text-destructive">Prediction Failed</h3>
      <p className="text-sm text-muted-foreground max-w-sm mx-auto">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline mt-2"
        >
          <Loader2 className="h-3.5 w-3.5" /> Try again
        </button>
      )}
    </div>
  );
}

function ResultCard({ result, college, branch, isFallback }) {
  const {
    predicted_cutoff,
    student_percentage,
    probability,
    chance,
    resolved_category,
  } = result;

  const chanceColor =
    chance === "Very High" || chance === "High"
      ? "text-success bg-success/10"
      : chance === "Moderate"
      ? "text-warning-foreground bg-warning/20"
      : "text-destructive bg-destructive/10";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-border bg-card p-6 shadow-card space-y-6"
    >
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-brand">Your Match Report</p>
        <h3 className="mt-1 font-display text-xl font-bold">{college}</h3>
        <p className="text-sm text-muted-foreground">
          {branch} · CAP seat: {resolved_category}
          {resolved_category?.endsWith("H") && " (Home District)"}
          {resolved_category?.endsWith("O") && " (Other District)"}
        </p>
      </div>

      {/* Chance badge */}
      <div className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 font-semibold text-sm ${chanceColor}`}>
        <ArrowRight className="h-4 w-4" />
        Admission Chance: <span className="font-extrabold">{chance}</span>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <StatBox label="Your Score"   value={`${student_percentage}%`}           tone="brand" />
        <StatBox label="Cutoff"       value={`${predicted_cutoff?.toFixed(2)}%`} tone="neutral" />
        <StatBox label="Probability"  value={`${probability?.toFixed(1)}%`}
          tone={probability >= 60 ? "success" : probability >= 35 ? "warning" : "destructive"} />
      </div>

      {/* Probability bar */}
      <div>
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="text-muted-foreground font-medium">Admission Probability</span>
          <span className="font-bold">{probability?.toFixed(1)}%</span>
        </div>
        <Progress value={probability} className="h-2" />
      </div>

      {isFallback && (
        <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-start gap-1.5">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          Prediction server was temporarily unavailable — this result is based on <strong>2025 historical cutoff data</strong> and is still a reliable estimate.
        </p>
      )}
      <p className="text-[11px] text-muted-foreground flex items-start gap-1.5 border-t border-border pt-4">
        <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
        Prediction is based on the ML model trained on CAP 2023–2025 data. Actual cutoffs may vary.
      </p>
    </motion.div>
  );
}

function StatBox({ label, value, tone }) {
  const colors = {
    brand:       "text-brand bg-brand/10",
    success:     "text-success bg-success/10",
    warning:     "text-warning-foreground bg-warning/20",
    destructive: "text-destructive bg-destructive/10",
    neutral:     "text-foreground bg-surface",
  };
  return (
    <div className={`rounded-xl p-3 sm:p-4 text-center ${colors[tone] || colors.neutral}`}>
      <p className="text-[9px] sm:text-[10px] uppercase tracking-wider font-semibold opacity-70">{label}</p>
      <p className="font-display text-base sm:text-lg font-extrabold mt-1 leading-none">{value}</p>
    </div>
  );
}
