import { NavLink, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { Menu, X, GraduationCap } from "lucide-react";
import { cn } from "../lib/utils";

const LINKS = [
  { to: "/", label: "Home", end: true },
  { to: "/colleges", label: "College & Cutoff Explorer" },
  { to: "/predictor", label: "College Predictor" },
  { to: "/about", label: "About" },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full border-b border-transparent backdrop-blur transition-all duration-300",
        scrolled ? "bg-white/85 border-border shadow-sm" : "bg-white/60",
      )}
    >
      <div
        className={cn(
          "mx-auto flex max-w-7xl items-center justify-between gap-6 px-4 sm:px-6 lg:px-8 transition-all",
          scrolled ? "h-14" : "h-16",
        )}
      >
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand text-white shadow-elegant">
            <GraduationCap className="h-5 w-5" />
          </span>
          <span className="font-display text-lg font-bold tracking-tight">
            Poly<span className="text-brand">Mitra</span>
          </span>
        </Link>

        <nav className="hidden lg:flex items-center gap-1">
          {LINKS.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) =>
                cn(
                  "px-3 py-2 text-sm font-medium rounded-md transition-colors",
                  isActive
                    ? "text-brand bg-surface-2"
                    : "text-muted-foreground hover:text-foreground hover:bg-surface",
                )
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>


        <button
          className="lg:hidden grid h-10 w-10 place-items-center rounded-md border border-border"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="lg:hidden border-t border-border bg-white">
          <div className="mx-auto max-w-7xl px-4 py-3 flex flex-col gap-1">
            {LINKS.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.end}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  cn(
                    "px-3 py-2 rounded-md text-sm font-medium",
                    isActive
                      ? "text-brand bg-surface-2"
                      : "text-foreground hover:bg-surface",
                  )
                }
              >
                {l.label}
              </NavLink>
            ))}

          </div>
        </div>
      )}
    </header>
  );
}
