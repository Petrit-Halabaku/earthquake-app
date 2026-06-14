/**
 * Unit tests for the pure data layer. These cover the logic the dashboard's
 * correctness depends on: feed parsing, filtering, sorting, and aggregation.
 *
 * Run with: npm test  (node --test, no extra deps)
 *
 * We compile the TS utilities to a temp ESM file on the fly via a tiny inline
 * transform-free approach: the utilities are written in portable TS that is
 * valid once type annotations are stripped, so we import the .ts through a
 * loader. To keep zero-dependency, we instead re-implement imports by reading
 * the transpiled output. Simplest: point tests at a JS mirror built by tsc.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  featureToQuake,
  filterByMag,
  sortQuakes,
  timeAgo,
  buildMagBuckets,
  buildFrequency,
  summarize,
  alertTier,
  magLabel,
} from "./_utils.mjs";

const mk = (over = {}) => ({
  id: Math.random().toString(36).slice(2),
  mag: 4,
  place: "Somewhere",
  time: Date.now(),
  url: "",
  lat: 0,
  lon: 0,
  depth: 10,
  tsunami: false,
  alert: null,
  sig: 0,
  ...over,
});

test("featureToQuake flattens USGS GeoJSON", () => {
  const q = featureToQuake({
    id: "abc",
    properties: { mag: 5.2, place: "10km N of Town", time: 1700000000000, url: "u", tsunami: 1, alert: "yellow", sig: 420 },
    geometry: { coordinates: [-120.5, 38.1, 12.3] },
  });
  assert.equal(q.id, "abc");
  assert.equal(q.mag, 5.2);
  assert.equal(q.lon, -120.5);
  assert.equal(q.lat, 38.1);
  assert.equal(q.depth, 12.3);
  assert.equal(q.tsunami, true);
  assert.equal(q.alert, "yellow");
});

test("featureToQuake tolerates missing fields", () => {
  const q = featureToQuake({ id: "x", properties: {}, geometry: {} });
  assert.equal(q.mag, 0);
  assert.equal(q.place, "Unknown location");
  assert.equal(q.tsunami, false);
});

test("filterByMag keeps only events at/above threshold", () => {
  const data = [mk({ mag: 1 }), mk({ mag: 3.5 }), mk({ mag: 5 })];
  assert.equal(filterByMag(data, 0).length, 3);
  assert.equal(filterByMag(data, 3.5).length, 2);
  assert.equal(filterByMag(data, 6).length, 0);
});

test("sortQuakes orders by key and direction", () => {
  const data = [mk({ mag: 2 }), mk({ mag: 6 }), mk({ mag: 4 })];
  assert.deepEqual(sortQuakes(data, "mag", "desc").map((q) => q.mag), [6, 4, 2]);
  assert.deepEqual(sortQuakes(data, "mag", "asc").map((q) => q.mag), [2, 4, 6]);
});

test("sortQuakes does not mutate input", () => {
  const data = [mk({ mag: 2 }), mk({ mag: 6 })];
  const before = data.map((q) => q.mag);
  sortQuakes(data, "mag", "desc");
  assert.deepEqual(data.map((q) => q.mag), before);
});

test("sortQuakes sorts place alphabetically", () => {
  const data = [mk({ place: "Zed" }), mk({ place: "Alpha" }), mk({ place: "Mike" })];
  assert.deepEqual(sortQuakes(data, "place", "asc").map((q) => q.place), ["Alpha", "Mike", "Zed"]);
});

test("timeAgo formats relative spans", () => {
  const now = 1_000_000_000_000;
  assert.equal(timeAgo(now - 5_000, now), "5s ago");
  assert.equal(timeAgo(now - 120_000, now), "2m ago");
  assert.equal(timeAgo(now - 7_200_000, now), "2h ago");
  assert.equal(timeAgo(now - 172_800_000, now), "2d ago");
});

test("buildMagBuckets bins magnitudes into 6 bands", () => {
  const data = [mk({ mag: 1.2 }), mk({ mag: 2.5 }), mk({ mag: 3.1 }), mk({ mag: 6.9 }), mk({ mag: 7.5 })];
  const buckets = buildMagBuckets(data);
  assert.equal(buckets.length, 6);
  assert.equal(buckets[0].count, 1); // <2
  assert.equal(buckets[1].count, 1); // 2-3
  assert.equal(buckets[2].count, 1); // 3-4
  assert.equal(buckets[5].count, 2); // 6+
});

test("buildFrequency produces hourly buckets for day range", () => {
  const now = Date.now();
  const data = [mk({ time: now - 1000 }), mk({ time: now - 2 * 3600_000 })];
  const freq = buildFrequency(data, "day", now);
  assert.equal(freq.length, 24);
  assert.equal(freq.reduce((s, b) => s + b.count, 0), 2);
});

test("buildFrequency produces daily buckets for week range", () => {
  const now = Date.now();
  const freq = buildFrequency([], "week", now);
  assert.equal(freq.length, 7);
});

test("summarize computes count, avg, max and strongest", () => {
  const data = [mk({ mag: 2 }), mk({ mag: 6, place: "Big one" }), mk({ mag: 4 })];
  const s = summarize(data, "day");
  assert.equal(s.count, 3);
  assert.equal(s.avgMag, 4);
  assert.equal(s.maxMag, 6);
  assert.equal(s.strongest.place, "Big one");
});

test("summarize handles empty input safely", () => {
  const s = summarize([], "day");
  assert.equal(s.count, 0);
  assert.equal(s.avgMag, 0);
  assert.equal(s.strongest, null);
  assert.equal(s.magBuckets.length, 6);
});

test("alertTier escalates by magnitude and tsunami", () => {
  assert.equal(alertTier(mk({ mag: 1 })), null);
  assert.equal(alertTier(mk({ mag: 4.2 })).cls, "lvl-watch");
  assert.equal(alertTier(mk({ mag: 5.3 })).cls, "lvl-strong");
  assert.equal(alertTier(mk({ mag: 6.7 })).cls, "lvl-major");
  assert.equal(alertTier(mk({ mag: 5, tsunami: true })).cls, "lvl-tsunami");
});

test("magLabel describes magnitude bands", () => {
  assert.equal(magLabel(1), "Micro");
  assert.equal(magLabel(4.5), "Light");
  assert.equal(magLabel(8.1), "Great");
});
