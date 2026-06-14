/**
 * Precomputes an evenly-distributed dot grid over Earth's landmasses.
 * Uses a Fibonacci sphere distribution tested against country polygons,
 * then writes [lat, lon] pairs (quantized to 2 decimals) to src/assets/land-dots.json.
 *
 * Run: npm run generate:landdots
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const geo = JSON.parse(readFileSync(join(__dirname, "countries.geo.json"), "utf8"));

// Flatten all polygons into rings with bounding boxes for fast rejection
const polygons = [];
for (const feature of geo.features) {
  const { type, coordinates } = feature.geometry;
  const polys = type === "Polygon" ? [coordinates] : coordinates;
  for (const poly of polys) {
    const outer = poly[0];
    let minX = 180, maxX = -180, minY = 90, maxY = -90;
    for (const [x, y] of outer) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    polygons.push({ rings: poly, bbox: [minX, minY, maxX, maxY] });
  }
}

function pointInRing(x, y, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function isLand(lon, lat) {
  for (const { rings, bbox } of polygons) {
    if (lon < bbox[0] || lon > bbox[2] || lat < bbox[1] || lat > bbox[3]) continue;
    if (pointInRing(lon, lat, rings[0])) {
      // Check holes
      let inHole = false;
      for (let h = 1; h < rings.length; h++) {
        if (pointInRing(lon, lat, rings[h])) {
          inHole = true;
          break;
        }
      }
      if (!inHole) return true;
    }
  }
  return false;
}

// Fibonacci sphere: N candidate points evenly spread on the sphere surface
const N = 42000;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const dots = [];

for (let i = 0; i < N; i++) {
  const y = 1 - (i / (N - 1)) * 2; // 1 .. -1
  const lat = (Math.asin(y) * 180) / Math.PI;
  const theta = GOLDEN_ANGLE * i;
  let lon = ((theta * 180) / Math.PI) % 360;
  if (lon > 180) lon -= 360;
  if (lon < -180) lon += 360;
  if (isLand(lon, lat)) {
    dots.push([Math.round(lat * 100) / 100, Math.round(lon * 100) / 100]);
  }
}

const out = join(__dirname, "..", "src", "assets", "land-dots.json");
writeFileSync(out, JSON.stringify(dots));
console.log(`Wrote ${dots.length} land dots to ${out}`);
