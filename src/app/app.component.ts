import { Component, type OnInit, type OnDestroy } from "@angular/core";
import { CommonModule } from "@angular/common";
import { HttpClientModule } from "@angular/common/http";
import { ReactiveFormsModule } from "@angular/forms";
import { NgxEchartsModule } from "ngx-echarts";
import { LeafletModule } from "@asymmetrik/ngx-leaflet";
import { ToastrModule } from "ngx-toastr";

import { HeaderComponent } from "./components/header/header.component";
import { FilterComponent } from "./components/filter/filter.component";
import { SummaryComponent } from "./components/summary/summary.component";
import { EarthquakeMapComponent } from "./components/earthquake-map/earthquake-map.component";
import { EarthquakeTableComponent } from "./components/earthquake-table/earthquake-table.component";
import { FrequencyChartComponent } from "./components/charts/frequency-chart.component";
import { MagnitudeChartComponent } from "./components/charts/magnitude-chart.component";

import { EarthquakeService } from "./services/earthquake.service";
import type {
  EarthquakeFilters,
  EarthquakeSummary,
  EarthquakeFeature,
} from "./models/earthquake.model";
import { PerformanceMonitorService } from "./services/performance-monitor.service";
import { Subject } from "rxjs";
import { takeUntil } from "rxjs/operators";

@Component({
  selector: "app-root",
  standalone: true,
  imports: [
    CommonModule,
    HttpClientModule,
    ReactiveFormsModule,
    NgxEchartsModule,
    LeafletModule,
    ToastrModule,
    HeaderComponent,
    FilterComponent,
    SummaryComponent,
    EarthquakeMapComponent,
    EarthquakeTableComponent,
    FrequencyChartComponent,
    MagnitudeChartComponent,
  ],
  template: `
    <div class="app-container">
      <app-header></app-header>

      <main class="container mt-3">
        <app-filter (filtersChanged)="onFiltersChanged($event)"></app-filter>

        <div *ngIf="loading" class="loading-overlay">
          <div class="loading-spinner"></div>
          <div class="loading-text">Loading earthquake data...</div>
          <div class="loading-progress" *ngIf="progress > 0">
            <div class="progress-bar" [style.width.%]="progress"></div>
            <div class="progress-text">{{ progress }}% complete</div>
          </div>
        </div>

        <div *ngIf="error" class="alert alert-danger">
          {{ error }}
        </div>

        <div
          *ngIf="
            shouldShowRecommendations && performanceRecommendations.length > 0
          "
          class="alert alert-warning performance-alert"
        >
          <div class="performance-header">
            <span class="material-symbols-outlined">speed</span>
            Performance Recommendations
          </div>
          <ul class="performance-list">
            <li *ngFor="let rec of performanceRecommendations">{{ rec }}</li>
          </ul>
        </div>

        <app-summary [summary]="summary"></app-summary>

        <div class="grid">
          <div style="grid-column: span 6;">
            <app-frequency-chart [summary]="summary"></app-frequency-chart>
          </div>
          <div style="grid-column: span 6;">
            <app-magnitude-chart [summary]="summary"></app-magnitude-chart>
          </div>
        </div>

        <app-earthquake-map [earthquakes]="earthquakes"></app-earthquake-map>

        <app-earthquake-table
          [earthquakes]="earthquakes"
        ></app-earthquake-table>

        <div
          *ngIf="shouldShowRecommendations && earthquakes.length > 1000"
          class="performance-stats"
        >
          <div class="performance-stats-header">
            <span class="material-symbols-outlined">analytics</span>
            Performance Metrics
          </div>
          <div class="performance-stats-content">
            <div class="stat-item">
              <div class="stat-label">Data Load Time:</div>
              <div class="stat-value">
                {{ performanceMetrics.dataLoadTime.toFixed(0) }}ms
              </div>
            </div>
            <div class="stat-item">
              <div class="stat-label">Render Time:</div>
              <div class="stat-value">
                {{ performanceMetrics.renderTime.toFixed(0) }}ms
              </div>
            </div>
            <div class="stat-item">
              <div class="stat-label">Data Size:</div>
              <div class="stat-value">
                {{ formatBytes(performanceMetrics.dataSize) }}
              </div>
            </div>
            <div class="stat-item" *ngIf="performanceMetrics.memoryUsage > 0">
              <div class="stat-label">Memory Usage:</div>
              <div class="stat-value">
                {{ formatBytes(performanceMetrics.memoryUsage) }}
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer class="footer">
        <div class="container">
          <div class="footer-content">
            <p>&copy; 2025 SeismoKode - Real-time Earthquake Dashboard</p>
            <p class="data-source">
              Data source:
              <a href="https://earthquake.usgs.gov/" target="_blank"
                >USGS Earthquake Catalog</a
              >
            </p>
          </div>
        </div>
      </footer>
    </div>
  `,
  styles: [
    `
      .app-container {
        min-height: 100vh;
        display: flex;
        flex-direction: column;
      }

      main {
        flex: 1;
        padding-bottom: calc(var(--spacing-unit) * 4);
      }

      .footer {
        background-color: var(--gray-900);
        color: white;
        padding: calc(var(--spacing-unit) * 3) 0;
        margin-top: auto;
      }

      .footer-content {
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        gap: var(--spacing-unit);
      }

      .data-source {
        font-size: 0.875rem;
        opacity: 0.8;
      }

      .data-source a {
        color: var(--secondary);
        text-decoration: none;
      }

      .data-source a:hover {
        text-decoration: underline;
      }

      .loading-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: rgba(255, 255, 255, 0.9);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        z-index: 1000;
      }

      .loading-text {
        font-size: 1.25rem;
        color: var(--primary);
        font-weight: 500;
        text-align: center;
        margin-top: var(--spacing-unit);
      }

      .loading-spinner {
        width: 50px;
        height: 50px;
        border: 4px solid rgba(25, 118, 210, 0.3);
        border-radius: 50%;
        border-top-color: var(--primary);
        animation: spin 1s ease-in-out infinite;
      }

      .loading-progress {
        width: 300px;
        height: 20px;
        background-color: var(--gray-200);
        border-radius: var(--radius-sm);
        margin-top: calc(var(--spacing-unit) * 2);
        position: relative;
        overflow: hidden;
      }

      .progress-bar {
        height: 100%;
        background-color: var(--primary);
        transition: width 0.3s ease;
      }

      .progress-text {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 0.75rem;
        font-weight: 500;
        text-shadow: 0 0 2px rgba(0, 0, 0, 0.5);
      }

      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }

      .performance-alert {
        margin-bottom: calc(var(--spacing-unit) * 2);
      }

      .performance-header {
        display: flex;
        align-items: center;
        font-weight: 500;
        margin-bottom: var(--spacing-unit);
      }

      .performance-header .material-symbols-outlined {
        margin-right: var(--spacing-unit);
      }

      .performance-list {
        margin: 0;
        padding-left: calc(var(--spacing-unit) * 3);
      }

      .performance-list li {
        margin-bottom: calc(var(--spacing-unit) / 2);
      }

      .performance-stats {
        background-color: var(--gray-100);
        border-radius: var(--radius-md);
        padding: calc(var(--spacing-unit) * 2);
        margin-top: calc(var(--spacing-unit) * 2);
      }

      .performance-stats-header {
        display: flex;
        align-items: center;
        font-weight: 500;
        margin-bottom: var(--spacing-unit);
        color: var(--primary);
      }

      .performance-stats-header .material-symbols-outlined {
        margin-right: var(--spacing-unit);
      }

      .performance-stats-content {
        display: flex;
        flex-wrap: wrap;
        gap: calc(var(--spacing-unit) * 2);
      }

      .stat-item {
        flex: 1;
        min-width: 150px;
      }

      .stat-label {
        font-size: 0.875rem;
        color: var(--gray-600);
        margin-bottom: calc(var(--spacing-unit) / 2);
      }

      .stat-value {
        font-weight: 500;
      }

      @media (max-width: 768px) {
        .grid > div {
          grid-column: span 12 !important;
        }

        .ground-container {
          width: 250px;
          height: 150px;
        }

        .performance-stats-content {
          flex-direction: column;
          gap: var(--spacing-unit);
        }
      }

      @media (max-width: 480px) {
        .ground-container {
          width: 200px;
          height: 120px;
        }
      }
    `,
  ],
})
export class AppComponent implements OnInit, OnDestroy {
  earthquakes: EarthquakeFeature[] = [];
  summary: EarthquakeSummary | null = null;
  loading = false;
  error: string | null = null;
  progress = 0;
  performanceRecommendations: string[] = [];
  performanceMetrics = {
    dataLoadTime: 0,
    renderTime: 0,
    dataSize: 0,
    memoryUsage: 0,
  };
  shouldShowRecommendations = false;

  // Thresholds for showing recommendations
  private readonly LOAD_TIME_THRESHOLD = 3000; // 3 seconds
  private readonly DATA_SIZE_THRESHOLD = 1 * 1024 * 1024; // 1MB
  private readonly RECORDS_THRESHOLD = 1000; // 1000 earthquakes

  private destroy$ = new Subject<void>();

  constructor(
    private earthquakeService: EarthquakeService,
    private performanceMonitor: PerformanceMonitorService
  ) {}

  ngOnInit(): void {
    this.earthquakeService.loading$
      .pipe(takeUntil(this.destroy$))
      .subscribe((loading) => {
        this.loading = loading;

        if (loading) {
          this.performanceMonitor.startTimer("dataLoad");
          // Reset recommendations when starting a new request
          this.shouldShowRecommendations = false;
        } else {
          const loadTime = this.performanceMonitor.endTimer("dataLoad");
          console.log(`Data loaded in ${loadTime.toFixed(2)}ms`);

          // Check if we should show recommendations based on load time
          if (loadTime > this.LOAD_TIME_THRESHOLD) {
            this.shouldShowRecommendations = true;
          }

          // Update recommendations when loading completes
          this.updatePerformanceRecommendations();
        }
      });

    this.earthquakeService.earthquakes$
      .pipe(takeUntil(this.destroy$))
      .subscribe((earthquakes) => {
        this.performanceMonitor.startTimer("render");
        this.earthquakes = earthquakes;

        // Estimate data size
        const dataSize = JSON.stringify(earthquakes).length * 2; // Rough estimate
        this.performanceMetrics.dataSize = dataSize;

        // Check if we should show recommendations based on data size or record count
        if (
          dataSize > this.DATA_SIZE_THRESHOLD ||
          earthquakes.length > this.RECORDS_THRESHOLD
        ) {
          this.shouldShowRecommendations = true;
        }

        setTimeout(() => {
          const renderTime = this.performanceMonitor.endTimer(
            "render",
            dataSize
          );
          this.performanceMetrics.renderTime = renderTime;

          // Update recommendations after render completes
          this.updatePerformanceRecommendations();
        }, 0);
      });

    this.earthquakeService.summary$
      .pipe(takeUntil(this.destroy$))
      .subscribe((summary) => {
        this.summary = summary;
      });

    this.earthquakeService.error$
      .pipe(takeUntil(this.destroy$))
      .subscribe((error) => {
        this.error = error;
      });

    this.earthquakeService.progress$
      .pipe(takeUntil(this.destroy$))
      .subscribe((progress) => {
        this.progress = progress;
      });

    this.performanceMonitor.metrics$
      .pipe(takeUntil(this.destroy$))
      .subscribe((metrics) => {
        this.performanceMetrics.dataLoadTime = metrics.dataLoadTime;
        this.performanceMetrics.renderTime = metrics.renderTime;
        this.performanceMetrics.memoryUsage = metrics.memoryUsage;

        // Update recommendations when metrics change
        this.updatePerformanceRecommendations();
      });
  }

  /**
   * Update performance recommendations based on current state
   */
  private updatePerformanceRecommendations(): void {
    // Only get recommendations if we should show them
    if (this.shouldShowRecommendations) {
      this.performanceRecommendations =
        this.performanceMonitor.getPerformanceRecommendations();
      console.log("Updated recommendations:", this.performanceRecommendations);
    } else {
      this.performanceRecommendations = [];
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onFiltersChanged(filters: EarthquakeFilters): void {
    this.earthquakeService.fetchEarthquakes(filters);
  }

  formatBytes(bytes: number): string {
    return this.performanceMonitor.formatBytes(bytes);
  }
}
