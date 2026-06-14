import type { Quake, Summary, TimeRange } from "./types";

/** Flatten a raw USGS GeoJSON feature into our compact Quake shape. */
export function featureToQuake(f: any): Quake {
  const p = f.properties ?? {};
  const c = f.geometry?.coordinates ?? [0, 0, 0];
  return {
    id: f.id,
    mag: typeof p.mag === "number" ? p.mag : 0,
    place: p.place || p.title || "Unknown location",
    time: p.time ?? 0,
    url: p.url || "",
    lon: c[0] ?? 0,
    lat: c[1] ?? 0,
    depth: c[2] ?? 0,
    tsunami: p.tsunami === 1,
    alert: p.alert ?? null,
    sig: p.sig ?? 0,
  };
}

/** Color ramp by magnitude — shared by globe, table, and charts. */
export function magColor(mag: number): string {
  if (mag < 2) return "#5eead4"; // teal — micro
  if (mag < 3) return "#7dd3fc"; // sky — minor
  if (mag < 4) return "#a3e635"; // lime — light
  if (mag < 5) return "#ffd166"; // amber — moderate
  if (mag < 6) return "#ff9f43"; // orange — strong
  if (mag < 7) return "#ff5c3d"; // red-orange — major
  return "#ff2d78"; // magenta — great
}

export function magLabel(mag: number): string {
  if (mag < 2) return "Micro";
  if (mag < 4) return "Minor";
  if (mag < 5) return "Light";
  if (mag < 6) return "Moderate";
  if (mag < 7) return "Strong";
  if (mag < 8) return "Major";
  return "Great";
}

/** Severity tier used for the table's status badge. */
export function alertTier(q: Quake): { label: string; cls: string } | null {
  if (q.tsunami) return { label: "Tsunami", cls: "lvl-tsunami" };
  if (q.mag >= 6 || q.alert === "red" || q.alert === "orange")
    return { label: "Major", cls: "lvl-major" };
  if (q.mag >= 5 || q.alert === "yellow") return { label: "Strong", cls: "lvl-strong" };
  if (q.mag >= 4 || q.sig >= 600) return { label: "Watch", cls: "lvl-watch" };
  return null;
}

export function filterByMag(quakes: Quake[], minMag: number): Quake[] {
  if (minMag <= 0) return quakes;
  return quakes.filter((q) => q.mag >= minMag);
}

export type SortKey = "time" | "mag" | "depth" | "place";

export function sortQuakes(quakes: Quake[], key: SortKey, dir: "asc" | "desc"): Quake[] {
  const sign = dir === "asc" ? 1 : -1;
  const sorted = [...quakes].sort((a, b) => {
    let cmp: number;
    if (key === "place") cmp = a.place.localeCompare(b.place);
    else cmp = (a[key] as number) - (b[key] as number);
    return cmp * sign;
  });
  return sorted;
}

/** Compact relative time, e.g. "3m ago", "2h ago". */
export function timeAgo(time: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - time) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

/**
 * Buckets for the frequency chart. Hour/day windows bucket by hour;
 * longer windows bucket by day. Returns chronologically ordered buckets.
 */
export function buildFrequency(quakes: Quake[], range: TimeRange, now = Date.now()): { label: string; count: number }[] {
  const byHour = range === "hour" || range === "day";
  const bucketMs = byHour ? 3600_000 : 86_400_000;
  const spanMs = range === "hour" ? 3600_000 : range === "day" ? 86_400_000 : range === "week" ? 7 * 86_400_000 : 30 * 86_400_000;
  const buckets = Math.max(1, Math.round(spanMs / bucketMs));
  const start = now - buckets * bucketMs;
  const counts = new Array(buckets).fill(0);

  for (const q of quakes) {
    const idx = Math.floor((q.time - start) / bucketMs);
    if (idx >= 0 && idx < buckets) counts[idx]++;
  }

  const fmt = (t: number) =>
    byHour
      ? new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : new Date(t).toLocaleDateString([], { month: "short", day: "numeric" });

  return counts.map((count, i) => ({ label: fmt(start + i * bucketMs), count }));
}

const MAG_BANDS = [
  { label: "<2", min: -Infinity, max: 2 },
  { label: "2–3", min: 2, max: 3 },
  { label: "3–4", min: 3, max: 4 },
  { label: "4–5", min: 4, max: 5 },
  { label: "5–6", min: 5, max: 6 },
  { label: "6+", min: 6, max: Infinity },
];

export function buildMagBuckets(quakes: Quake[]): { label: string; count: number }[] {
  return MAG_BANDS.map((b) => ({
    label: b.label,
    count: quakes.filter((q) => q.mag >= b.min && q.mag < b.max).length,
  }));
}

/** Aggregate everything the UI needs from a filtered quake set. */
export function summarize(quakes: Quake[], range: TimeRange, now = Date.now()): Summary {
  if (quakes.length === 0) {
    return {
      count: 0,
      avgMag: 0,
      maxMag: 0,
      strongest: null,
      lastEventTime: null,
      tsunamiCount: 0,
      magBuckets: buildMagBuckets([]),
      frequency: buildFrequency([], range, now),
    };
  }
  let sum = 0;
  let strongest = quakes[0];
  let last = quakes[0];
  let tsunamiCount = 0;
  for (const q of quakes) {
    sum += q.mag;
    if (q.mag > strongest.mag) strongest = q;
    if (q.time > last.time) last = q;
    if (q.tsunami) tsunamiCount++;
  }
  return {
    count: quakes.length,
    avgMag: sum / quakes.length,
    maxMag: strongest.mag,
    strongest,
    lastEventTime: last.time,
    tsunamiCount,
    magBuckets: buildMagBuckets(quakes),
    frequency: buildFrequency(quakes, range, now),
  };
}
