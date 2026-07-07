# PolyMitra — Maharashtra Polytechnic Admission Helper

A modern React + Vite frontend for a Maharashtra polytechnic admission helper. Includes
college directory, cutoff explorer, admission predictor, trend charts and more — all
running on dummy data ready for backend integration.

## Tech Stack

- React 18
- Vite 5
- React Router DOM v6
- Tailwind CSS v3
- Framer Motion
- Recharts
- Lucide Icons

## Getting Started

```bash
npm install
npm run dev
```

Open http://localhost:8080

## Build

```bash
npm run build
npm run preview
```

## Project Structure

```
src/
  App.jsx              # Route table
  main.jsx             # Entry point
  index.css            # Tailwind entry + base styles
  lib/
    data.js            # Dummy colleges, cutoffs, predictor logic
    utils.js           # cn() classname helper
  components/
    Navbar.jsx
    Footer.jsx
    SiteLayout.jsx
    ui.jsx             # Reusable primitives (Button, Input, Select, Tabs, etc.)
  pages/
    Home.jsx
    Colleges.jsx
    CollegeDetails.jsx
    Cutoffs.jsx
    Predictor.jsx
    About.jsx
    Contact.jsx
    NotFound.jsx
```

## Wiring a Backend

Replace `src/lib/data.js` with real API calls. The `predict()` function is the
single integration point for the ML predictor endpoint.

## License

MIT
