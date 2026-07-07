// Dummy PolyMitra data

export const BRANCHES = [
  "Computer Engineering",
  "Information Technology",
  "AI & Data Science",
  "Electronics & Telecom",
  "Mechanical Engineering",
  "Civil Engineering",
  "Electrical Engineering",
  "Automobile Engineering",
];

export const CATEGORIES = ["OPEN", "SC", "ST", "OBC", "NT", "VJ", "EWS", "TFWS"];

export const REGIONS = [
  "Pune",
  "Mumbai",
  "Nagpur",
  "Nashik",
  "Aurangabad",
  "Amravati",
  "Kolhapur",
  "Konkan",
];

export const REGION_INFO = {
  Pune: { count: 62, top: ["Govt. Polytechnic Pune", "VPM Thane", "AISSMS Poly"] },
  Mumbai: { count: 48, top: ["Govt. Polytechnic Mumbai", "VJTI Mumbai", "Thakur Poly"] },
  Nagpur: { count: 41, top: ["Govt. Polytechnic Nagpur", "KDK Poly", "Priyadarshini Poly"] },
  Nashik: { count: 34, top: ["Govt. Polytechnic Nashik", "K.K. Wagh Poly", "SIER Poly"] },
  Aurangabad: { count: 29, top: ["Govt. Polytechnic Aurangabad", "MIT Poly", "MGM Poly"] },
  Amravati: { count: 22, top: ["Govt. Polytechnic Amravati", "PRMIT Poly", "HVPM Poly"] },
  Kolhapur: { count: 26, top: ["Govt. Polytechnic Kolhapur", "DKTE Poly", "Sanjay Ghodawat"] },
  Konkan: { count: 18, top: ["Govt. Polytechnic Ratnagiri", "Finolex Poly", "YTC Poly"] },
};

const seed = (n) => Math.abs(Math.sin(n * 9301 + 49297) * 233280) % 1;

const NAMES = [
  "Government Polytechnic",
  "VPM Polytechnic",
  "K.K. Wagh Polytechnic",
  "AISSMS Polytechnic",
  "MIT Polytechnic",
  "DKTE Polytechnic",
  "Finolex Polytechnic",
  "Priyadarshini Polytechnic",
  "Sanjay Ghodawat Polytechnic",
  "MGM Polytechnic",
  "Thakur Polytechnic",
  "PRMIT Polytechnic",
  "Bharati Vidyapeeth Polytechnic",
  "SIER Polytechnic",
  "KDK Polytechnic",
];

const DISTRICTS = {
  Pune: ["Pune", "Satara", "Sangli", "Solapur"],
  Mumbai: ["Mumbai", "Thane", "Palghar", "Raigad"],
  Nagpur: ["Nagpur", "Wardha", "Chandrapur", "Gadchiroli"],
  Nashik: ["Nashik", "Dhule", "Jalgaon", "Nandurbar"],
  Aurangabad: ["Aurangabad", "Beed", "Jalna", "Osmanabad"],
  Amravati: ["Amravati", "Akola", "Buldhana", "Yavatmal"],
  Kolhapur: ["Kolhapur", "Sangli", "Satara", "Ratnagiri"],
  Konkan: ["Ratnagiri", "Sindhudurg", "Raigad"],
};

const TYPES = ["Government", "Government Aided", "Private", "Autonomous"];

export const COLLEGES = Array.from({ length: 48 }).map((_, i) => {
  const region = REGIONS[i % REGIONS.length];
  const district = DISTRICTS[region][i % DISTRICTS[region].length];
  const name = `${NAMES[i % NAMES.length]}, ${district}`;
  const type = TYPES[i % 4];
  return {
    id: `col-${1000 + i}`,
    code: `MH${6100 + i}`,
    name,
    district,
    region,
    type,
    status: i % 11 === 0 ? "New" : "Active",
    autonomous: type === "Autonomous",
    minority: i % 7 === 0,
    nba: i % 3 === 0,
    naac: ["A++", "A+", "A", "B++", "B+"][i % 5],
    established: 1960 + Math.floor(seed(i) * 60),
    website: "https://dtemaharashtra.gov.in",
    branches: BRANCHES.slice(0, 3 + (i % 5)),
    facilities: [
      "Central Library",
      "Wi-Fi Campus",
      "Hostel",
      "Sports Ground",
      "Computer Labs",
      "Workshops",
      "Placement Cell",
      "Cafeteria",
    ].slice(0, 4 + (i % 4)),
  };
});

export function getCollege(id) {
  return COLLEGES.find((c) => c.id === id);
}

export const CUTOFFS = (() => {
  const rows = [];
  COLLEGES.forEach((c, ci) => {
    c.branches.forEach((b, bi) => {
      CATEGORIES.slice(0, 5).forEach((cat, kk) => {
        [2023, 2024, 2025].forEach((y) => {
          [1, 2, 3].forEach((r) => {
            const base = 70 + seed(ci * 13 + bi * 7 + kk * 3 + y + r) * 25;
            rows.push({
              collegeId: c.id,
              college: c.name,
              branch: b,
              category: cat,
              round: r,
              year: y,
              rank: Math.round(500 + seed(ci + bi + kk + y + r) * 45000),
              percentage: Math.round(base * 100) / 100,
            });
          });
        });
      });
    });
  });
  return rows;
})();

export const STATS = {
  colleges: 315,
  cutoffs: 94000,
  years: 3,
  branches: 40,
  students: 12500,
};

export const TESTIMONIALS = [
  {
    name: "Aditya Kulkarni",
    role: "SSC 2024 · Pune",
    text: "PolyMitra's predictor showed me realistic options. I secured Computer Engineering at my top-choice college.",
  },
  {
    name: "Sneha Patil",
    role: "SSC 2024 · Kolhapur",
    text: "Comparing three years of cutoffs in one place made choosing branches so much easier.",
  },
  {
    name: "Rohan Deshmukh",
    role: "SSC 2023 · Nagpur",
    text: "Clean, official-looking data. My parents trusted it and we made a confident CAP choice.",
  },
];

export function predict({ percentage, category, region, branch }) {
  const rows = CUTOFFS.filter(
    (r) =>
      r.year === 2025 &&
      r.round === 1 &&
      r.category === category &&
      (!branch || r.branch === branch),
  );
  const scored = rows.map((r) => {
    const college = COLLEGES.find((c) => c.id === r.collegeId);
    const diff = percentage - r.percentage;
    let bucket, chance;
    if (diff >= 6) {
      bucket = "safe";
      chance = Math.min(97, 80 + diff);
    } else if (diff >= -2) {
      bucket = "moderate";
      chance = 45 + diff * 4;
    } else {
      bucket = "dream";
      chance = Math.max(5, 25 + diff * 3);
    }
    return {
      college,
      branch: r.branch,
      expectedCutoff: r.percentage,
      yourPercentage: percentage,
      chance: Math.round(Math.max(1, Math.min(99, chance))),
      confidence: Math.round(70 + seed(r.rank) * 25),
      bucket,
    };
  });

  const filtered = region ? scored.filter((s) => s.college.region === region) : scored;

  const uniq = new Map();
  filtered.forEach((s) => {
    const key = s.college.id + s.branch;
    if (!uniq.has(key)) uniq.set(key, s);
  });
  const list = [...uniq.values()];

  return {
    safe: list.filter((s) => s.bucket === "safe").slice(0, 8),
    moderate: list.filter((s) => s.bucket === "moderate").slice(0, 8),
    dream: list.filter((s) => s.bucket === "dream").slice(0, 8),
  };
}
