// ── Maharashtra DTE Regions & Districts ───────────────────────────────────────

export const REGIONS = [
  "Pune", "Mumbai", "Nashik", "Nagpur", "Amravati", "Aurangabad", "Konkan",
];

export const REGION_DISTRICTS = {
  "Pune":       ["Pune", "Satara", "Sangli", "Solapur", "Kolhapur"],
  "Mumbai":     ["Mumbai", "Thane", "Palghar", "Navi Mumbai"],
  "Nashik":     ["Nashik", "Dhule", "Jalgaon", "Nandurbar", "Ahmednagar"],
  "Nagpur":     ["Nagpur", "Wardha", "Chandrapur", "Gadchiroli", "Bhandara", "Gondia"],
  "Amravati":   ["Amravati", "Akola", "Buldhana", "Yavatmal", "Washim"],
  "Aurangabad": [
    "Aurangabad", "Chhatrapati Sambhajinagar", "Beed", "Osmanabad",
    "Dharashiv", "Latur", "Nanded", "Hingoli", "Parbhani", "Jalna",
  ],
  "Konkan":     ["Raigad", "Ratnagiri", "Sindhudurg", "Konkan"],
};

// Inverted map: DISTRICT_UPPER → region
export const DISTRICT_REGION = {};
for (const [region, districts] of Object.entries(REGION_DISTRICTS)) {
  for (const d of districts) {
    DISTRICT_REGION[d.toUpperCase()] = region;
  }
}

// All distinct districts sorted A-Z (for the dropdown when no region selected)
export const ALL_DISTRICTS = [
  ...new Set(Object.values(REGION_DISTRICTS).flat()),
].sort();

// ── Place extraction ───────────────────────────────────────────────────────────

/**
 * All place names that appear in Maharashtra polytechnic college names.
 * Sorted longest-first so "Ahmednagar" is matched before "Nagar".
 */
const PLACE_LIST = [
  "Ahmednagar", "Akola", "Amravati", "Aurangabad", "Baramati",
  "Beed", "Bhandara", "Buldhana", "Chandrapur",
  "Chhatrapati Sambhajinagar", "Dharashiv", "Dhule",
  "Gadchiroli", "Gondia", "Hingoli", "Jalgaon", "Jalna",
  "Kolhapur", "Konkan", "Latur", "Mumbai", "Nagpur",
  "Nanded", "Nandurbar", "Nashik", "Navi Mumbai",
  "Osmanabad", "Palghar", "Parbhani", "Pune",
  "Raigad", "Ratnagiri", "Sangli", "Satara",
  "Sindhudurg", "Solapur", "Thane", "Wardha", "Washim", "Yavatmal",
].sort((a, b) => b.length - a.length); // longest first

/** Extract district/city from a college name string. */
export function extractDistrict(name = "") {
  const lower = name.toLowerCase();
  for (const place of PLACE_LIST) {
    if (lower.includes(place.toLowerCase())) return place;
  }
  return null;
}

/** Get DTE region for a college name. */
export function extractRegion(name = "") {
  const district = extractDistrict(name);
  if (!district) return null;
  return DISTRICT_REGION[district.toUpperCase()] || null;
}

// ── College type ───────────────────────────────────────────────────────────────

export const COLLEGE_TYPES = [
  "Government", "Aided", "Un-Aided", "University Department",
];

/** Infer college type from its name. */
export function extractType(name = "") {
  const u = name.toUpperCase();
  if (u.includes("UNIVERSITY DEPT") || u.includes("UNIVERSITY DEPARTMENT")) return "University Department";
  if (u.includes("GOVERNMENT") && !u.includes("AIDED")) return "Government";
  if (u.includes("AIDED")) return "Aided";
  return "Un-Aided";
}
