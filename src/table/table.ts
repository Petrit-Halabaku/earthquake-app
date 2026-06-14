import type { Quake } from "../data/types";
import { alertTier, magColor, sortQuakes, timeAgo, type SortKey } from "../data/quakeUtils";

const PAGE = 25; // rows appended per infinite-scroll step

/**
 * Sortable, infinitely-scrolling event table. Owns its own sort state and
 * renders incrementally so thousands of rows stay smooth.
 */
export class QuakeTable {
  private tbody: HTMLElement;
  private table: HTMLElement;
  private sentinel: HTMLElement;
  private empty: HTMLElement;
  private observer: IntersectionObserver;

  private all: Quake[] = [];
  private sortKey: SortKey = "time";
  private sortDir: "asc" | "desc" = "desc";
  private rendered = 0;

  onSelect?: (q: Quake) => void;

  constructor(root: ParentNode) {
    this.table = root.querySelector("#quake-table") as HTMLElement;
    this.tbody = root.querySelector("#quake-tbody") as HTMLElement;
    this.sentinel = root.querySelector("#table-sentinel") as HTMLElement;
    this.empty = root.querySelector("#table-empty") as HTMLElement;

    this.table.querySelectorAll("th[data-sort]").forEach((th) => {
      th.addEventListener("click", () => this.toggleSort(th.getAttribute("data-sort") as SortKey));
    });

    this.tbody.addEventListener("click", (e) => {
      const row = (e.target as HTMLElement).closest("tr[data-id]");
      if (!row) return;
      const q = this.all.find((x) => x.id === row.getAttribute("data-id"));
      if (q && this.onSelect) this.onSelect(q);
    });

    this.observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) this.renderMore();
      },
      { rootMargin: "200px" }
    );
    this.observer.observe(this.sentinel);
  }

  setData(quakes: Quake[]) {
    this.all = quakes;
    this.refresh();
  }

  private toggleSort(key: SortKey) {
    if (this.sortKey === key) {
      this.sortDir = this.sortDir === "asc" ? "desc" : "asc";
    } else {
      this.sortKey = key;
      this.sortDir = key === "place" ? "asc" : "desc";
    }
    this.refresh();
  }

  private refresh() {
    this.all = sortQuakes(this.all, this.sortKey, this.sortDir);
    this.tbody.innerHTML = "";
    this.rendered = 0;

    // Reflect sort state in header aria + indicators.
    this.table.querySelectorAll("th[data-sort]").forEach((th) => {
      const key = th.getAttribute("data-sort");
      th.classList.toggle("sorted", key === this.sortKey);
      th.classList.toggle("asc", key === this.sortKey && this.sortDir === "asc");
      th.classList.toggle("desc", key === this.sortKey && this.sortDir === "desc");
      th.setAttribute(
        "aria-sort",
        key === this.sortKey ? (this.sortDir === "asc" ? "ascending" : "descending") : "none"
      );
    });

    this.empty.hidden = this.all.length > 0;
    this.renderMore();
  }

  private renderMore() {
    if (this.rendered >= this.all.length) return;
    const next = this.all.slice(this.rendered, this.rendered + PAGE);
    const frag = document.createDocumentFragment();
    const now = Date.now();
    for (const q of next) frag.appendChild(this.row(q, now));
    this.tbody.appendChild(frag);
    this.rendered += next.length;
  }

  private row(q: Quake, now: number): HTMLTableRowElement {
    const tr = document.createElement("tr");
    tr.dataset.id = q.id;

    const date = new Date(q.time);
    const tier = alertTier(q);
    const color = magColor(q.mag);

    tr.innerHTML = `
      <td class="td-time">
        <span class="ago">${timeAgo(q.time, now)}</span>
        ${date.toLocaleDateString([], { month: "short", day: "numeric" })}
        ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
      </td>
      <td><span class="mag-chip" style="background:${color}">${q.mag.toFixed(1)}</span></td>
      <td class="td-depth">${q.depth.toFixed(0)} km</td>
      <td class="td-place">${escapeHtml(q.place)}</td>
      <td>${tier ? `<span class="alert-badge ${tier.cls}">${tier.label}</span>` : `<span class="alert-badge">—</span>`}</td>
    `;
    return tr;
  }
}

function escapeHtml(s: string): string {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}
