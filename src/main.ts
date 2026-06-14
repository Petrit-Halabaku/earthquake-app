import "./styles.css";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Globe } from "./globe/globe";
import { MagnitudeChart, FrequencyChart } from "./charts/charts";
import { QuakeTable } from "./table/table";
import { fetchQuakes, RANGE_LABELS } from "./data/usgs";
import { filterByMag, summarize, magLabel, timeAgo, magColor } from "./data/quakeUtils";
import type { Quake, TimeRange, Summary } from "./data/types";

gsap.registerPlugin(ScrollTrigger);

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const $ = <T extends HTMLElement = HTMLElement>(sel: string) => document.querySelector(sel) as T;

// ----------------------------------------------------------------- state
let range: TimeRange = "day";
let minMag = 0;
let rawQuakes: Quake[] = [];
let controller: AbortController | null = null;
let refreshTimer: number | undefined;

// ----------------------------------------------------------------- modules
// The globe is the centerpiece, but the dashboard must still work if WebGL is
// unavailable (old hardware, blocked contexts). Construct it defensively so a
// failure here never blocks data, charts, or the table.
let globe: Globe | null = null;
try {
  globe = new Globe($<HTMLCanvasElement>("#globe-canvas"));
} catch (err) {
  console.warn("Globe unavailable, continuing without 3D view:", err);
  document.getElementById("globe-wrap")?.classList.add("globe-fallback");
}

const magChart = new MagnitudeChart($("#chart-mag"));
const freqChart = new FrequencyChart($("#chart-freq"));
const table = new QuakeTable(document);

const tooltip = $("#quake-tooltip");
const qtMag = $("#qt-mag");
const qtPlace = $("#qt-place");
const qtMeta = $("#qt-meta");

// ------------------------------------------------------- globe interactions
if (globe) globe.onHover = (e) => {
  if (!e) {
    tooltip.hidden = true;
    return;
  }
  const { quake: q } = e;
  qtMag.textContent = q.mag.toFixed(1);
  qtMag.style.background = magColor(q.mag);
  qtPlace.textContent = q.place;
  qtMeta.textContent = `${magLabel(q.mag)} · ${q.depth.toFixed(0)} km deep · ${timeAgo(q.time)}`;
  tooltip.style.left = `${e.x}px`;
  tooltip.style.top = `${e.y}px`;
  tooltip.hidden = false;
};
if (globe) globe.onSelect = (q) => q.url && window.open(q.url, "_blank", "noopener");

table.onSelect = (q) => {
  if (globe) {
    globe.focus(q);
    $("#hero").scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
  } else if (q.url) {
    window.open(q.url, "_blank", "noopener");
  }
};

// ----------------------------------------------------------------- rendering
function applyFilters() {
  const filtered = filterByMag(rawQuakes, minMag);
  const summary = summarize(filtered, range);
  renderStats(summary);
  magChart.update(summary);
  freqChart.update(summary);
  table.setData(filtered);
  globe?.setQuakes(filtered);

  $("#filtered-count").textContent = filtered.length.toLocaleString();
  $("#mag-chart-tag").textContent = `${filtered.length} events`;
  $("#freq-chart-tag").textContent = RANGE_LABELS[range];
}

function renderStats(s: Summary) {
  animateNumber($("#stat-count"), s.count, 0);
  animateNumber($("#stat-max"), s.maxMag, 1);
  animateNumber($("#stat-avg"), s.avgMag, 1);
  $("#stat-last").textContent = s.lastEventTime ? timeAgo(s.lastEventTime) : "—";
  $("#stat-max-label").textContent = s.strongest
    ? `Strongest · ${truncate(s.strongest.place, 22)}`
    : "Strongest (mag)";
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

/** Tween a numeric stat from its current value to the target. */
function animateNumber(el: HTMLElement, target: number, decimals: number) {
  const from = parseFloat(el.dataset.val ?? "0") || 0;
  el.dataset.val = String(target);
  if (reduceMotion) {
    el.textContent = format(target, decimals);
    return;
  }
  const obj = { v: from };
  gsap.to(obj, {
    v: target,
    duration: 0.9,
    ease: "power2.out",
    onUpdate: () => (el.textContent = format(obj.v, decimals)),
  });
}

function format(v: number, decimals: number) {
  return decimals === 0 ? Math.round(v).toLocaleString() : v.toFixed(decimals);
}

// ----------------------------------------------------------------- data load
async function load() {
  controller?.abort();
  controller = new AbortController();
  setStatus(null);
  setLive("loading");
  try {
    const { quakes } = await fetchQuakes(range, controller.signal);
    rawQuakes = quakes;
    applyFilters();
    setLive("live");
  } catch (err) {
    if ((err as Error).name === "AbortError") return;
    console.error("Failed to load USGS data:", err);
    setLive("error");
    setStatus("Couldn't reach the USGS feed. Check your connection.");
  }
}

function setStatus(msg: string | null) {
  const box = $("#data-status");
  if (!msg) {
    box.hidden = true;
    return;
  }
  $("#data-status-text").textContent = msg;
  box.hidden = false;
}

function setLive(state: "live" | "loading" | "error") {
  const badge = $("#live-badge");
  const text = badge.querySelector(".live-text") as HTMLElement;
  badge.classList.toggle("is-error", state === "error");
  text.textContent = state === "live" ? "LIVE · USGS" : state === "loading" ? "SYNCING…" : "OFFLINE";
}

// ----------------------------------------------------------------- controls
function bindControls() {
  $("#range-pills").querySelectorAll<HTMLButtonElement>(".pill").forEach((pill) => {
    pill.addEventListener("click", () => {
      const r = pill.dataset.range as TimeRange;
      if (r === range) return;
      range = r;
      $("#range-pills").querySelectorAll(".pill").forEach((p) => {
        const active = p === pill;
        p.classList.toggle("is-active", active);
        p.setAttribute("aria-selected", String(active));
      });
      $("#window-label").textContent = RANGE_LABELS[range];
      load();
    });
  });

  const slider = $<HTMLInputElement>("#mag-slider");
  const output = $("#mag-output");
  const updateSlider = () => {
    minMag = parseFloat(slider.value);
    output.textContent = minMag === 0 ? "All" : `M ${minMag.toFixed(1)}+`;
    slider.style.setProperty("--fill", `${(minMag / 7) * 100}%`);
    if (rawQuakes.length) applyFilters();
  };
  slider.addEventListener("input", updateSlider);
  updateSlider();

  $("#retry-btn").addEventListener("click", load);
}

// ----------------------------------------------------------------- motion
function introAnimation() {
  document.body.classList.remove("no-js");
  if (reduceMotion) {
    document.body.classList.add("motion-done");
    return;
  }
  const heroBits = ".nav, .reveal-line > span, .hero-stats .stat, .scroll-cue";
  const tl = gsap.timeline({
    defaults: { ease: "power3.out" },
    // Failsafe: whatever happens, the hero ends in its natural, visible state.
    onComplete: () => gsap.set(heroBits, { clearProps: "all" }),
  });
  tl.from(".nav", { y: -40, opacity: 0, duration: 0.7 })
    .from(".reveal-line > span", { yPercent: 110, duration: 0.9, stagger: 0.08 }, "-=0.3")
    .from(".hero-stats .stat", { y: 24, opacity: 0, duration: 0.6, stagger: 0.07 }, "-=0.4")
    .from(".scroll-cue", { opacity: 0, duration: 0.6 }, "-=0.3");

  // Belt-and-braces: if the timeline is interrupted (e.g. tab backgrounded
  // during load), force the final state so critical copy is never stuck hidden.
  window.setTimeout(() => {
    if (!tl.isActive() && tl.progress() < 1) gsap.set(heroBits, { clearProps: "all" });
  }, 4000);

  // Section reveals on scroll.
  gsap.utils.toArray<HTMLElement>("[data-reveal]").forEach((el) => {
    gsap.to(el, {
      opacity: 1,
      y: 0,
      duration: 0.8,
      ease: "power3.out",
      scrollTrigger: { trigger: el, start: "top 85%" },
    });
  });
}

// ----------------------------------------------------------------- resize
let resizeRaf = 0;
window.addEventListener("resize", () => {
  cancelAnimationFrame(resizeRaf);
  resizeRaf = requestAnimationFrame(() => {
    magChart.resize();
    freqChart.resize();
  });
});

// hide tooltip while scrolling the page (marker positions go stale)
window.addEventListener("scroll", () => {
  tooltip.hidden = true;
}, { passive: true });

// ----------------------------------------------------------------- boot
bindControls();
introAnimation();
load();

// Auto-refresh live feeds every 60s.
refreshTimer = window.setInterval(load, 60_000);
window.addEventListener("beforeunload", () => {
  clearInterval(refreshTimer);
  globe?.dispose();
});
