import Navbar from "./Navbar";
import Footer from "./Footer";

export default function SiteLayout({ children }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}

export function SectionHeading({ eyebrow, title, desc }) {
  return (
    <div className="max-w-2xl">
      {eyebrow && (
        <p className="text-xs font-semibold uppercase tracking-widest text-brand">{eyebrow}</p>
      )}
      <h2 className="mt-3 font-display text-3xl sm:text-4xl font-extrabold tracking-tight">
        {title}
      </h2>
      {desc && <p className="mt-3 text-base text-muted-foreground leading-relaxed">{desc}</p>}
    </div>
  );
}
