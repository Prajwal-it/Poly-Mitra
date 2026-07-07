import { cn } from "../lib/utils";
import { createContext, useContext, useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";

/* -------- Button -------- */
export function Button({ variant = "default", size = "md", className, children, ...rest }) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50";
  const variants = {
    default: "bg-brand text-white hover:bg-brand-600",
    outline: "border border-border bg-white text-foreground hover:bg-surface",
    ghost: "text-foreground hover:bg-surface",
    secondary: "bg-white text-brand hover:bg-surface",
  };
  const sizes = {
    sm: "h-9 px-3 text-sm",
    md: "h-10 px-4 text-sm",
    lg: "h-11 px-6 text-base",
  };
  return (
    <button className={cn(base, variants[variant], sizes[size], className)} {...rest}>
      {children}
    </button>
  );
}

/* -------- Input -------- */
export function Input({ className, ...rest }) {
  return (
    <input
      className={cn(
        "flex h-10 w-full rounded-lg border border-border bg-white px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand/40",
        className,
      )}
      {...rest}
    />
  );
}

/* -------- Textarea -------- */
export function Textarea({ className, ...rest }) {
  return (
    <textarea
      className={cn(
        "flex w-full rounded-lg border border-border bg-white px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand/40",
        className,
      )}
      {...rest}
    />
  );
}

/* -------- Label -------- */
export function Label({ className, children, ...rest }) {
  return (
    <label className={cn("text-xs font-medium text-muted-foreground", className)} {...rest}>
      {children}
    </label>
  );
}

/* -------- Badge -------- */
export function Badge({ variant = "default", className, children }) {
  const styles = {
    default: "bg-brand text-white",
    secondary: "bg-surface-2 text-brand",
    outline: "border border-border bg-white text-foreground",
    success: "bg-success/10 text-success border border-success/20",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
        styles[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}

/* -------- Checkbox -------- */
export function Checkbox({ checked, onChange, className }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "h-4 w-4 rounded border border-border grid place-items-center transition-colors",
        checked ? "bg-brand border-brand" : "bg-white",
        className,
      )}
    >
      {checked && <Check className="h-3 w-3 text-white" />}
    </button>
  );
}

/* -------- Select -------- */
const SelectCtx = createContext(null);

export function Select({ value, onChange, children }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);
  return (
    <SelectCtx.Provider value={{ value, onChange, open, setOpen }}>
      <div ref={ref} className="relative">
        {children}
      </div>
    </SelectCtx.Provider>
  );
}

export function SelectTrigger({ className, children }) {
  const ctx = useContext(SelectCtx);
  return (
    <button
      type="button"
      onClick={() => ctx.setOpen(!ctx.open)}
      className={cn(
        "flex h-10 w-full items-center justify-between rounded-lg border border-border bg-white px-3 text-sm hover:bg-surface focus:outline-none focus:ring-2 focus:ring-brand/40",
        className,
      )}
    >
      <span className="truncate text-left">{children}</span>
      <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
    </button>
  );
}

export function SelectContent({ children }) {
  const ctx = useContext(SelectCtx);
  if (!ctx.open) return null;
  return (
    <div className="absolute z-40 mt-1.5 max-h-64 w-full overflow-y-auto rounded-lg border border-border bg-white p-1 shadow-card">
      {children}
    </div>
  );
}

export function SelectItem({ value, children }) {
  const ctx = useContext(SelectCtx);
  const active = ctx.value === value;
  return (
    <button
      type="button"
      onClick={() => {
        ctx.onChange(value);
        ctx.setOpen(false);
      }}
      className={cn(
        "flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-sm hover:bg-surface",
        active && "bg-surface-2 text-brand font-medium",
      )}
    >
      <span>{children}</span>
      {active && <Check className="h-3.5 w-3.5" />}
    </button>
  );
}

/* -------- SearchableSelect -------- */
export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = "Select…",
  searchPlaceholder = "Type to search…",
  getOptionValue = (o) => o,
  getOptionLabel = (o) => o,
  getSearchText,
  disabled = false,
  className,
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
    if (!open) setSearch("");
  }, [open]);

  const term = search.toLowerCase().trim();
  const filtered = options.filter((o) => {
    if (!term) return true;
    const text = (getSearchText ? getSearchText(o) : `${getOptionLabel(o)} ${getOptionValue(o)}`).toLowerCase();
    return text.includes(term);
  });

  const selected = options.find((o) => getOptionValue(o) === value);
  const displayLabel = selected ? getOptionLabel(selected) : value || placeholder;

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(!open)}
        className={cn(
          "flex h-10 w-full items-center justify-between rounded-lg border border-border bg-white px-3 text-sm hover:bg-surface focus:outline-none focus:ring-2 focus:ring-brand/40",
          disabled && "opacity-50 pointer-events-none",
        )}
      >
        <span className="truncate text-left">{displayLabel}</span>
        <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
      </button>
      {open && (
        <div className="absolute z-40 mt-1.5 w-full rounded-lg border border-border bg-white shadow-card">
          <div className="border-b border-border p-2">
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="flex h-9 w-full rounded-md border border-border bg-white px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40"
            />
          </div>
          <div className="max-h-56 overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <p className="px-2.5 py-2 text-sm text-muted-foreground">No matches found</p>
            ) : (
              filtered.map((o) => {
                const v = getOptionValue(o);
                const active = value === v;
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => {
                      onChange(v);
                      setOpen(false);
                      setSearch("");
                    }}
                    className={cn(
                      "flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-sm hover:bg-surface",
                      active && "bg-surface-2 text-brand font-medium",
                    )}
                  >
                    <span className="truncate">{getOptionLabel(o)}</span>
                    {active && <Check className="h-3.5 w-3.5 shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* -------- Tabs -------- */
const TabsCtx = createContext(null);

export function Tabs({ value, defaultValue, onChange, children, className }) {
  const [internal, setInternal] = useState(defaultValue);
  const current = value ?? internal;
  const setCurrent = (v) => {
    if (onChange) onChange(v);
    setInternal(v);
  };
  return (
    <TabsCtx.Provider value={{ value: current, setValue: setCurrent }}>
      <div className={className}>{children}</div>
    </TabsCtx.Provider>
  );
}

export function TabsList({ children, className }) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-lg border border-border bg-white p-1",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function TabsTrigger({ value, children }) {
  const ctx = useContext(TabsCtx);
  const active = ctx.value === value;
  return (
    <button
      type="button"
      onClick={() => ctx.setValue(value)}
      className={cn(
        "rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors",
        active ? "bg-brand text-white shadow-sm" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

export function TabsContent({ value, children, className }) {
  const ctx = useContext(TabsCtx);
  if (ctx.value !== value) return null;
  return <div className={className}>{children}</div>;
}

/* -------- Progress -------- */
export function Progress({ value = 0, className }) {
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-surface-2", className)}>
      <div
        className="h-full rounded-full bg-brand transition-all"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

/* -------- Toast (very simple) -------- */
const listeners = new Set();
export const toast = {
  show(message, description) {
    listeners.forEach((l) => l({ message, description }));
  },
};

export function Toaster() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    const l = (t) => {
      const id = Math.random();
      setItems((v) => [...v, { ...t, id }]);
      setTimeout(() => setItems((v) => v.filter((x) => x.id !== id)), 3500);
    };
    listeners.add(l);
    return () => listeners.delete(l);
  }, []);
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
      {items.map((i) => (
        <div
          key={i.id}
          className="rounded-lg border border-border bg-white shadow-card px-4 py-3 min-w-64 animate-in fade-in slide-in-from-bottom-2"
        >
          <p className="text-sm font-semibold">{i.message}</p>
          {i.description && <p className="text-xs text-muted-foreground mt-0.5">{i.description}</p>}
        </div>
      ))}
    </div>
  );
}
