/** A single earthquake, flattened from the USGS GeoJSON feature. */
export interface Quake {
  id: string;
  mag: number;
  place: string;
  time: number; // epoch ms
  url: string;
  lat: number;
  lon: number;
  depth: number; // km
  tsunami: boolean;
  alert: string | null; // USGS PAGER level: green | yellow | orange | red
  sig: number; // USGS significance score
}

export type TimeRange = "hour" | "day" | "week" | "month";

export interface Summary {
  count: number;
  avgMag: number;
  maxMag: number;
  strongest: Quake | null;
  lastEventTime: number | null;
  tsunamiCount: number;
  magBuckets: { label: string; count: number }[];
  frequency: { label: string; count: number }[];
}
