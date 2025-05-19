import {
  Component,
  Input,
  type OnChanges,
  type SimpleChanges,
  ViewChild,
  type ElementRef,
  type AfterViewInit,
  type OnDestroy,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import type { EarthquakeFeature } from "../../models/earthquake.model";
import { DateFormatterService } from "../../services/date-formatter.service";
import { EarthquakeService } from "../../services/earthquake.service";
import { Subject, fromEvent } from "rxjs";
import { debounceTime, takeUntil } from "rxjs/operators";

@Component({
  selector: "app-earthquake-table",
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="card">
      <h3 class="card-title">Earthquake Alerts</h3>

      <div class="table-controls">
        <div class="search-container">
          <input
            type="text"
            placeholder="Search locations..."
            class="form-control search-input"
            (input)="onSearch($event)"
          />
          <span class="material-symbols-outlined search-icon">search</span>
        </div>

        <div class="table-info" *ngIf="filteredEarthquakes.length > 0">
          Showing {{ visibleEarthquakes.length }} of
          {{ filteredEarthquakes.length }} earthquakes
        </div>
      </div>

      <div class="table-container" #tableContainer (scroll)="onTableScroll()">
        <table class="table">
          <thead>
            <tr>
              <th (click)="sort('time')">
                Time
                <span class="material-symbols-outlined sort-icon">{{
                  getSortIcon("time")
                }}</span>
              </th>
              <th (click)="sort('mag')">
                Magnitude
                <span class="material-symbols-outlined sort-icon">{{
                  getSortIcon("mag")
                }}</span>
              </th>
              <th (click)="sort('place')">
                Location
                <span class="material-symbols-outlined sort-icon">{{
                  getSortIcon("place")
                }}</span>
              </th>
              <th (click)="sort('status')">
                Status
                <span class="material-symbols-outlined sort-icon">{{
                  getSortIcon("status")
                }}</span>
              </th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            <tr
              *ngFor="let eq of visibleEarthquakes"
              [ngClass]="getRowClass(eq)"
            >
              <td>{{ formatDate(eq.properties.time) }}</td>
              <td
                [style.color]="getColorForMagnitude(eq.properties.mag)"
                class="magnitude-cell"
              >
                <span
                  class="magnitude-badge"
                  [style.background-color]="
                    getColorForMagnitude(eq.properties.mag)
                  "
                >
                  {{ eq.properties.mag.toFixed(1) }}
                </span>
                <span class="magnitude-type">{{
                  getMagnitudeDescription(eq.properties.mag)
                }}</span>
              </td>
              <td>{{ eq.properties.place }}</td>
              <td>{{ eq.properties.status | titlecase }}</td>
              <td>
                <a
                  href="{{ eq.properties.url }}"
                  target="_blank"
                  class="details-link"
                >
                  <span class="material-symbols-outlined">open_in_new</span>
                </a>
              </td>
            </tr>
            <tr *ngIf="visibleEarthquakes.length === 0 && !isLoading">
              <td colspan="5" class="text-center">
                No earthquakes found matching your criteria.
              </td>
            </tr>
            <tr *ngIf="isLoading">
              <td colspan="5" class="text-center">
                <div class="loading-spinner"></div>
                Loading more data...
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `,
  styles: [
    `
      .table-container {
        overflow-y: auto;
        overflow-x: auto;
        max-height: 500px;
        position: relative;
        scroll-behavior: smooth;
      }

      .table th {
        cursor: pointer;
        user-select: none;
        position: relative;
        position: sticky;
        top: 0;
        background-color: white;
        z-index: 10;
      }

      .table th:hover {
        background-color: var(--gray-200);
      }

      .sort-icon {
        font-size: 1rem;
        vertical-align: middle;
        margin-left: var(--spacing-unit);
      }

      .magnitude-cell {
        white-space: nowrap;
      }

      .magnitude-badge {
        display: inline-block;
        width: 40px;
        height: 26px;
        line-height: 26px;
        text-align: center;
        border-radius: var(--radius-sm);
        color: white;
        font-weight: 500;
        margin-right: var(--spacing-unit);
      }

      .magnitude-type {
        font-size: 0.875rem;
        color: var(--gray-700);
      }

      .details-link {
        color: var(--primary);
        display: inline-flex;
        align-items: center;
        transition: color 0.3s;
      }

      .details-link:hover {
        color: var(--primary-dark);
      }

      tr.alert-warning {
        background-color: rgba(255, 193, 7, 0.1);
      }

      tr.alert-danger {
        background-color: rgba(244, 67, 54, 0.1);
      }

      .table-controls {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: var(--spacing-unit);
        flex-wrap: wrap;
        gap: var(--spacing-unit);
      }

      .search-container {
        position: relative;
        width: 300px;
        max-width: 100%;
      }

      .search-input {
        padding-left: calc(var(--spacing-unit) * 4);
      }

      .search-icon {
        position: absolute;
        left: var(--spacing-unit);
        top: 50%;
        transform: translateY(-50%);
        color: var(--gray-500);
      }

      .table-info {
        font-size: 0.875rem;
        color: var(--gray-600);
      }

      .loading-spinner {
        display: inline-block;
        width: 20px;
        height: 20px;
        border: 2px solid rgba(25, 118, 210, 0.3);
        border-radius: 50%;
        border-top-color: var(--primary);
        animation: spin 1s ease-in-out infinite;
        margin-right: var(--spacing-unit);
      }

      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }

      @media (max-width: 768px) {
        .table th,
        .table td {
          padding: var(--spacing-unit) calc(var(--spacing-unit) / 2);
          font-size: 0.875rem;
        }

        .magnitude-badge {
          width: 30px;
          height: 22px;
          line-height: 22px;
          font-size: 0.75rem;
        }

        .magnitude-type {
          font-size: 0.75rem;
        }

        .search-container {
          width: 100%;
        }

        .table-controls {
          flex-direction: column;
          align-items: flex-start;
        }
      }
    `,
  ],
})
export class EarthquakeTableComponent
  implements OnChanges, AfterViewInit, OnDestroy
{
  @Input() earthquakes: EarthquakeFeature[] = [];
  @ViewChild("tableContainer") tableContainer!: ElementRef<HTMLDivElement>;

  sortedEarthquakes: EarthquakeFeature[] = [];
  filteredEarthquakes: EarthquakeFeature[] = [];
  visibleEarthquakes: EarthquakeFeature[] = [];
  sortColumn = "time";
  sortDirection: "asc" | "desc" = "desc";
  searchTerm = "";
  isLoading = false;

  // Virtual scrolling settings
  private readonly PAGE_SIZE = 50;
  private currentPage = 0;
  private destroy$ = new Subject<void>();
  private readonly SCROLL_THRESHOLD = 100; // px from bottom to trigger loading more

  constructor(
    private dateFormatterService: DateFormatterService,
    private earthquakeService: EarthquakeService
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes["earthquakes"]) {
      this.sortEarthquakes();
      this.filterEarthquakes();
      this.resetPagination();
    }
  }

  ngAfterViewInit(): void {
    // Listen for window resize to adjust visible items
    fromEvent(window, "resize")
      .pipe(takeUntil(this.destroy$), debounceTime(200))
      .subscribe(() => {
        this.updateVisibleEarthquakes();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  sort(column: string): void {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === "asc" ? "desc" : "asc";
    } else {
      this.sortColumn = column;
      this.sortDirection = "desc";
    }

    this.sortEarthquakes();
    this.filterEarthquakes();
    this.resetPagination();
  }

  onSearch(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchTerm = input.value.toLowerCase();
    this.filterEarthquakes();
    this.resetPagination();
  }

  onTableScroll(): void {
    if (this.isLoading) return;

    const element = this.tableContainer.nativeElement;
    const scrollPosition = element.scrollTop + element.clientHeight;
    const scrollHeight = element.scrollHeight;

    // If we're close to the bottom, load more items
    if (scrollHeight - scrollPosition < this.SCROLL_THRESHOLD) {
      this.loadMoreItems();
    }
  }

  private loadMoreItems(): void {
    if (this.visibleEarthquakes.length >= this.filteredEarthquakes.length) {
      return; // All items are already loaded
    }

    this.isLoading = true;

    // Simulate a delay for loading (in a real app, this might be a network request)
    setTimeout(() => {
      this.currentPage++;
      this.updateVisibleEarthquakes();
      this.isLoading = false;
    }, 300);
  }

  private resetPagination(): void {
    this.currentPage = 0;
    this.updateVisibleEarthquakes();
  }

  private updateVisibleEarthquakes(): void {
    const endIndex = (this.currentPage + 1) * this.PAGE_SIZE;
    this.visibleEarthquakes = this.filteredEarthquakes.slice(0, endIndex);
  }

  private filterEarthquakes(): void {
    if (!this.searchTerm) {
      this.filteredEarthquakes = this.sortedEarthquakes;
      return;
    }

    this.filteredEarthquakes = this.sortedEarthquakes.filter(
      (eq) =>
        eq.properties.place.toLowerCase().includes(this.searchTerm) ||
        eq.properties.status.toLowerCase().includes(this.searchTerm) ||
        eq.properties.mag.toString().includes(this.searchTerm)
    );
  }

  sortEarthquakes(): void {
    this.sortedEarthquakes = [...this.earthquakes].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      // Extract the values based on the sort column
      switch (this.sortColumn) {
        case "time":
          aValue = a.properties.time;
          bValue = b.properties.time;
          break;
        case "mag":
          aValue = a.properties.mag;
          bValue = b.properties.mag;
          break;
        case "place":
          aValue = a.properties.place;
          bValue = b.properties.place;
          break;
        case "status":
          aValue = a.properties.status;
          bValue = b.properties.status;
          break;
        default:
          aValue = a.properties.time;
          bValue = b.properties.time;
      }

      // Compare the values
      if (aValue < bValue) {
        return this.sortDirection === "asc" ? -1 : 1;
      }
      if (aValue > bValue) {
        return this.sortDirection === "asc" ? 1 : -1;
      }
      return 0;
    });
  }

  getSortIcon(column: string): string {
    if (this.sortColumn !== column) {
      return "sort";
    }
    return this.sortDirection === "asc" ? "arrow_upward" : "arrow_downward";
  }

  formatDate(timestamp: number): string {
    return this.dateFormatterService.formatDateTime(timestamp);
  }

  getColorForMagnitude(magnitude: number): string {
    return this.earthquakeService.getMagnitudeColor(magnitude);
  }

  getMagnitudeDescription(magnitude: number): string {
    return this.earthquakeService.getMagnitudeDescription(magnitude);
  }

  getRowClass(earthquake: EarthquakeFeature): string {
    const magnitude = earthquake.properties.mag;
    if (magnitude >= 6) {
      return "alert-danger";
    } else if (magnitude >= 4.5) {
      return "alert-warning";
    }
    return "";
  }
}
