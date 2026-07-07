import { GraduationCap, Linkedin, Mail } from "lucide-react";

const LINKEDIN = "https://www.linkedin.com/in/prajwal-banthiya-0581502a6/";
const EMAIL = "prajwalbanthiya27@gmail.com";

export default function Footer() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand text-white">
                <GraduationCap className="h-5 w-5" />
              </span>
              <span className="font-display text-lg font-bold">
                Poly<span className="text-brand">Mitra</span>
              </span>
            </div>
            <p className="mt-3 max-w-md text-sm text-muted-foreground">
              Maharashtra polytechnic cutoffs, college explorer and admission predictions.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:items-end">
            <a
              href={LINKEDIN}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-brand transition-colors"
            >
              <Linkedin className="h-4 w-4 shrink-0" />
              LinkedIn
            </a>
            <a
              href={`mailto:${EMAIL}`}
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-brand transition-colors"
            >
              <Mail className="h-4 w-4 shrink-0" />
              {EMAIL}
            </a>
          </div>
        </div>

        <p className="mt-8 border-t border-border pt-6 text-xs text-muted-foreground text-center sm:text-left">
          © {new Date().getFullYear()} PolyMitra. Not affiliated with the Government of Maharashtra.
        </p>
      </div>
    </footer>
  );
}
