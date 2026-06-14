import type { Quake, TimeRange } from "./types";
import { featureToQuake } from "./quakeUtils";

/**
 * USGS publishes pre-aggregated GeoJSON summary feeds that are CDN-cached and
 * fast — ideal for a live dashboard. We map each UI time window to the feed
 * with the broadest magnitude coverage for that span.
 * https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php
 */
const FEEDS: Record<TimeRange, string> = {
  hour: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson",
  day: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson",
  week: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_week.geojson",
  // The 30-day "all" feed is very large; the 2.5+ feed is the practical choice.
  month: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_month.geojson",
};

export interface FetchResult {
  quakes: Quake[];
  generated: number;
}

export async function fetchQuakes(range: TimeRange, signal?: AbortSignal): Promise<FetchResult> {
  const res = await fetch(FEEDS[range], { signal });
  if (!res.ok) throw new Error(`USGS feed returned ${res.status}`);
  const json = await res.json();
  const quakes = (json.features ?? [])
    .map(featureToQuake)
    .filter((q: Quake) => Number.isFinite(q.lat) && Number.isFinite(q.lon));
  return { quakes, generated: json.metadata?.generated ?? Date.now() };
}

export const RANGE_LABELS: Record<TimeRange, string> = {
  hour: "1 hour",
  day: "24 hours",
  week: "7 days",
  month: "30 days",
};
