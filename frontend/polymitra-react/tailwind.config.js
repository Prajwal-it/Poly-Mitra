/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Plus Jakarta Sans"', "ui-sans-serif", "system-ui", "sans-serif"],
        sans: ['"Inter"', "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        background: "#ffffff",
        foreground: "#0f172a",
        card: "#ffffff",
        border: "#e2e8f0",
        muted: "#f1f5f9",
        "muted-foreground": "#64748b",
        surface: "#f5faff",
        "surface-2": "#eaf4ff",
        brand: {
          DEFAULT: "#2563eb",
          foreground: "#ffffff",
          50: "#eff6ff",
          100: "#dbeafe",
          500: "#2563eb",
          600: "#1d4ed8",
        },
        success: {
          DEFAULT: "#10b981",
          foreground: "#ffffff",
        },
        warning: {
          DEFAULT: "#f59e0b",
          foreground: "#78350f",
        },
        destructive: {
          DEFAULT: "#ef4444",
          foreground: "#ffffff",
        },
      },
      boxShadow: {
        elegant: "0 10px 30px -12px rgba(37, 99, 235, 0.28)",
        card: "0 1px 2px rgba(0,0,0,0.04), 0 8px 24px -12px rgba(0,0,0,0.08)",
      },
      backgroundImage: {
        "hero-gradient":
          "radial-gradient(1200px 500px at 90% -10%, rgba(37,99,235,0.10), transparent 60%), radial-gradient(900px 400px at -10% 10%, rgba(16,185,129,0.10), transparent 55%), linear-gradient(180deg, #f5faff 0%, #ffffff 100%)",
      },
    },
  },
  plugins: [],
};
