import { Injectable } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";
import {
  BehaviorSubject,
  catchError,
  throwError,
  Subject,
  timer,
  interval,
} from "rxjs";
import { timeout, takeUntil, shareReplay, finalize } from "rxjs/operators";
import { ToastrService } from "ngx-toastr";
import type {
  EarthquakeResponse,
  EarthquakeFeature,
  EarthquakeFilters,
  EarthquakeSummary,
} from "../models/earthquake.model";
import { format, parseISO, differenceInDays, addDays } from "date-fns";
import { environment } from "../../environments/environment";

/**
 * Service responsible for fetching and processing earthquake data
 * from the USGS Earthquake API with optimizations for large-scale data
 */
@Injectable({
  providedIn: "root",
})
export class EarthquakeService {
  private apiUrl: string = environment.earthquakeApiUrl;
  private loadingSubject = new BehaviorSubject<boolean>(false);
  private earthquakesSubject = new BehaviorSubject<EarthquakeFeature[]>([]);
  private summarySubject = new BehaviorSubject<EarthquakeSummary | null>(null);
  private errorSubject = new BehaviorSubject<string | null>(null);
  private cancelSubject = new Subject<void>();
  private progressSubject = new BehaviorSubject<number>(0);

  // Enhanced cache with size management and expiration
  private cache = new Map<
    string,
    {
      data: EarthquakeResponse;
      timestamp: number;
      size: number; // Approximate size in bytes
    }
  >();

  private readonly CACHE_DURATION = 30 * 60 * 1000; // 30 minutes
  private readonly MAX_CACHE_SIZE = 50 * 1024 * 1024; // 50MB max cache size
  private currentCacheSize = 0;
  private readonly BATCH_SIZE = 500; // Process data in batches of 500 items
  private progressSimulation: any = null; // For storing the interval subscription

  // Observables for components to subscribe to
  loading$ = this.loadingSubject.asObservable();
  earthquakes$ = this.earthquakesSubject.asObservable().pipe(shareReplay(1));
  summary$ = this.summarySubject.asObservable().pipe(shareReplay(1));
  error$ = this.errorSubject.asObservable();
  progress$ = this.progressSubject.asObservable();

  constructor(private http: HttpClient, private toastr: ToastrService) {
    // Clean up expired cache entries periodically
    this.setupCacheCleanup();
  }

  /**
   * Set up periodic cache cleanup to remove expired entries
   */
  private setupCacheCleanup(): void {
    timer(60000, 300000) // Check every 5 minutes after initial 1 minute
      .subscribe(() => this.cleanupCache());
  }

  /**
   * Remove expired cache entries and manage cache size
   */
  private cleanupCache(): void {
    const now = Date.now();
    let entriesRemoved = 0;

    // Remove expired entries
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.CACHE_DURATION) {
        this.currentCacheSize -= entry.size;
        this.cache.delete(key);
        entriesRemoved++;
      }
    }

    // If cache is still too large, remove oldest entries
    if (this.currentCacheSize > this.MAX_CACHE_SIZE) {
      const entries = Array.from(this.cache.entries()).sort(
        (a, b) => a[1].timestamp - b[1].timestamp
      );

      for (const [key, entry] of entries) {
        this.currentCacheSize -= entry.size;
        this.cache.delete(key);
        entriesRemoved++;

        if (this.currentCacheSize <= this.MAX_CACHE_SIZE * 0.8) {
          break; // Stop when we've reduced to 80% of max
        }
      }
    }

    if (entriesRemoved > 0) {
      console.log(
        `Cache cleanup: removed ${entriesRemoved} entries, current size: ${this.formatBytes(
          this.currentCacheSize
        )}`
      );
    }
  }

  /**
   * Format bytes to human-readable format
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return (
      Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
    );
  }

  /**
   * Fetches earthquake data based on the provided filters
   * with a single request and simulated progress bar
   * @param filters - The search criteria to apply
   */
  fetchEarthquakes(filters: EarthquakeFilters): void {
    this.cancelCurrentRequest();
    this.loadingSubject.next(true);
    this.errorSubject.next(null);
    this.progressSubject.next(0);

    // Create a cache key based on the filters
    const cacheKey = this.createCacheKey(filters);
    const cachedData = this.getFromCache(cacheKey);

    if (cachedData) {
      this.processResponse(cachedData, filters);
      this.progressSubject.next(100);
      this.loadingSubject.next(false);
      this.toastr.info("Data loaded from cache");
      return;
    }

    // Check if this is a large date range and warn the user
    if (this.isLargeDateRange(filters)) {
      this.toastr.warning(
        "Large date range detected. This request may take some time to complete. Please wait while data is being fetched."
      );
    }

    // Start simulated progress
    this.startProgressSimulation();

    // Build request parameters
    const params = this.buildRequestParams(filters);

    // Make a single request for all data
    this.http
      .get<EarthquakeResponse>(this.apiUrl, { params })
      .pipe(
        timeout(120000), // 2 minute timeout for large queries
        takeUntil(this.cancelSubject),
        catchError((error) => {
          this.stopProgressSimulation();
          this.progressSubject.next(0);
          this.errorSubject.next(
            "Error fetching earthquake data. Please try again or refine your filters."
          );

          if (error.name === "TimeoutError") {
            this.toastr.error(
              "Request timed out. Try reducing the date range or adding more filters."
            );
            this.cancelCurrentRequest(); // Cancel the request when timeout occurs
          } else {
            this.toastr.error(
              "Failed to fetch earthquake data. Please check your connection and try again."
            );
          }

          return throwError(() => error);
        }),
        finalize(() => {
          this.stopProgressSimulation();
          this.loadingSubject.next(false);
          this.progressSubject.next(100);
        })
      )
      .subscribe((response) => {
        // Stop the simulated progress and set to 95% to indicate data processing is starting
        this.stopProgressSimulation();
        this.progressSubject.next(95);

        // Process the response
        this.addToCache(cacheKey, response);
        this.processResponseInBatches(response, filters);
      });
  }

  /**
   * Start a simulated progress bar that moves gradually while waiting for data
   */
  private startProgressSimulation(): void {
    // Stop any existing simulation
    this.stopProgressSimulation();

    // Define the progress curve - starts slow, accelerates in the middle, slows down near the end
    const progressCurve = [
      { time: 0, progress: 0 },
      { time: 1000, progress: 5 }, // 5% after 1 second
      { time: 3000, progress: 15 }, // 15% after 3 seconds
      { time: 8000, progress: 30 }, // 30% after 8 seconds
      { time: 15000, progress: 50 }, // 50% after 15 seconds
      { time: 30000, progress: 70 }, // 70% after 30 seconds
      { time: 60000, progress: 85 }, // 85% after 60 seconds
      { time: 90000, progress: 90 }, // 90% after 90 seconds
      { time: 120000, progress: 94 }, // 94% after 120 seconds (max)
    ];

    const startTime = Date.now();

    // Update progress every 200ms
    this.progressSimulation = interval(200)
      .pipe(takeUntil(this.cancelSubject))
      .subscribe(() => {
        const elapsed = Date.now() - startTime;

        // Find the right segment in the progress curve
        let progress = 0;
        for (let i = 0; i < progressCurve.length - 1; i++) {
          const current = progressCurve[i];
          const next = progressCurve[i + 1];

          if (elapsed >= current.time && elapsed < next.time) {
            // Linear interpolation between points
            const timeRatio =
              (elapsed - current.time) / (next.time - current.time);
            progress =
              current.progress + timeRatio * (next.progress - current.progress);
            break;
          }
        }

        // If we're past the last point, use the max progress
        if (elapsed >= progressCurve[progressCurve.length - 1].time) {
          progress = progressCurve[progressCurve.length - 1].progress;
        }

        this.progressSubject.next(Math.round(progress));
      });
  }

  /**
   * Stop the simulated progress
   */
  private stopProgressSimulation(): void {
    if (this.progressSimulation) {
      this.progressSimulation.unsubscribe();
      this.progressSimulation = null;
    }
  }

  /**
   * Checks if the date range is large and might require special handling
   */
  private isLargeDateRange(filters: EarthquakeFilters): boolean {
    const startDate = parseISO(filters.startTime);
    const endDate = parseISO(filters.endTime);
    const daysDiff = differenceInDays(endDate, startDate);

    // Consider date ranges over 90 days as large
    return daysDiff > 90;
  }

  /**
   * Builds HTTP parameters for the API request
   */
  private buildRequestParams(filters: EarthquakeFilters): HttpParams {
    let params = new HttpParams()
      .set("format", "geojson")
      .set("starttime", filters.startTime)
      .set("endtime", filters.endTime)
      .set("minmagnitude", filters.minMagnitude.toString())
      .set("limit", filters.limit.toString())
      .set("offset", Math.max(filters.offset, 1).toString())
      .set("orderby", "time");

    if (filters.maxMagnitude) {
      params = params.set("maxmagnitude", filters.maxMagnitude.toString());
    }

    if (
      filters.minLatitude &&
      filters.maxLatitude &&
      filters.minLongitude &&
      filters.maxLongitude
    ) {
      params = params
        .set("minlatitude", filters.minLatitude.toString())
        .set("maxlatitude", filters.maxLatitude.toString())
        .set("minlongitude", filters.minLongitude.toString())
        .set("maxlongitude", filters.maxLongitude.toString());
    }

    return params;
  }

  /**
   * Process response data in batches to avoid UI blocking
   */
  private processResponseInBatches(
    response: EarthquakeResponse,
    filters: EarthquakeFilters
  ): void {
    const earthquakes = response.features;

    // If small dataset, process immediately
    if (earthquakes.length < this.BATCH_SIZE) {
      this.processResponse(response, filters);
      return;
    }

    // For large datasets, process in batches
    this.toastr.info(
      `Processing ${earthquakes.length} earthquakes in batches for better performance`
    );

    // First update with a subset for immediate feedback
    const initialBatch = earthquakes.slice(0, 100);
    const initialResponse = { ...response, features: initialBatch };
    this.processResponse(initialResponse, filters);

    // Then process the full dataset in the background
    setTimeout(() => {
      // Process in main thread but in batches
      this.processBatchesSequentially(earthquakes, filters);
    }, 100);
  }

  /**
   * Process data in sequential batches to avoid UI freezing
   */
  private processBatchesSequentially(
    earthquakes: EarthquakeFeature[],
    filters: EarthquakeFilters
  ): void {
    const totalBatches = Math.ceil(earthquakes.length / this.BATCH_SIZE);
    let currentBatch = 0;

    const processNextBatch = () => {
      if (currentBatch >= totalBatches) {
        // All batches processed
        this.progressSubject.next(100);
        return;
      }

      const start = currentBatch * this.BATCH_SIZE;
      const end = Math.min(start + this.BATCH_SIZE, earthquakes.length);
      const batchEarthquakes = earthquakes.slice(0, end); // Include all processed so far

      // Update the data
      this.earthquakesSubject.next(batchEarthquakes);

      // Generate summary if it's the last batch
      if (currentBatch === totalBatches - 1) {
        this.generateSummary(earthquakes, filters);
      }

      // Update progress
      this.progressSubject.next(
        95 + Math.floor((currentBatch / totalBatches) * 5)
      );

      // Process next batch
      currentBatch++;
      setTimeout(processNextBatch, 10);
    };

    // Start processing
    processNextBatch();
  }

  /**
   * Cancels the current API request
   */
  cancelCurrentRequest(): void {
    this.cancelSubject.next();
    this.stopProgressSimulation();
    this.loadingSubject.next(false);
  }

  /**
   * Processes the API response and updates the observables
   * @param response - The API response data
   * @param filters - The filters that were applied
   */
  private processResponse(
    response: EarthquakeResponse,
    filters: EarthquakeFilters
  ): void {
    const earthquakes = response.features;
    this.earthquakesSubject.next(earthquakes);
    this.generateSummary(earthquakes, filters);

    if (earthquakes.length === 0) {
      this.toastr.info("No earthquakes found matching your criteria");
    } else if (earthquakes.length > filters.limit) {
      this.toastr.warning(
        `Showing maximum of ${filters.limit} results. Consider refining your filters for more specific data.`
      );
    } else {
      this.toastr.success(
        `Found ${earthquakes.length} earthquakes matching your criteria`
      );
    }
  }

  /**
   * Creates a cache key from the filters object
   * @param filters - The filters to create a key from
   * @returns A string key for the cache
   */
  private createCacheKey(filters: EarthquakeFilters): string {
    return JSON.stringify(filters);
  }

  /**
   * Retrieves data from the cache if available and not expired
   * @param key - The cache key to check
   * @returns The cached data or null if not found/expired
   */
  private getFromCache(key: string): EarthquakeResponse | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    const now = Date.now();
    if (now - cached.timestamp > this.CACHE_DURATION) {
      this.currentCacheSize -= cached.size;
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  /**
   * Adds data to the cache with a timestamp and size tracking
   * @param key - The cache key
   * @param data - The data to cache
   */
  private addToCache(key: string, data: EarthquakeResponse): void {
    // Estimate the size of the data (rough approximation)
    const size = this.estimateObjectSize(data);

    // Check if adding this would exceed cache size
    if (this.currentCacheSize + size > this.MAX_CACHE_SIZE) {
      this.cleanupCache();

      // If still too large, don't cache
      if (this.currentCacheSize + size > this.MAX_CACHE_SIZE) {
        console.warn(`Data too large to cache (${this.formatBytes(size)})`);
        return;
      }
    }

    // Add to cache and update size
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      size,
    });

    this.currentCacheSize += size;
  }

  /**
   * Estimate the size of an object in bytes (approximate)
   */
  private estimateObjectSize(obj: any): number {
    const jsonString = JSON.stringify(obj);
    return jsonString.length * 2; // Rough estimate: 2 bytes per character
  }

  /**
   * Generates summary statistics from earthquake data
   * @param earthquakes - The earthquake data to analyze
   * @param filters - The filters that were applied
   */
  private generateSummary(
    earthquakes: EarthquakeFeature[],
    filters: EarthquakeFilters
  ): void {
    if (earthquakes.length === 0) {
      this.summarySubject.next({
        count: 0,
        averageMagnitude: 0,
        strongestEarthquake: null,
        frequencyPerDay: [],
        magnitudeDistribution: [],
      });
      return;
    }

    // Calculate average magnitude
    const totalMagnitude = earthquakes.reduce(
      (sum, eq) => sum + eq.properties.mag,
      0
    );
    const averageMagnitude = totalMagnitude / earthquakes.length;

    // Find strongest earthquake
    const strongestEarthquake = earthquakes.reduce((strongest, current) =>
      strongest.properties.mag > current.properties.mag ? strongest : current
    );

    // Calculate frequency per day
    const dateMap = new Map<string, number>();
    const startDate = parseISO(filters.startTime);
    const endDate = parseISO(filters.endTime);
    const daysDiff = differenceInDays(endDate, startDate);

    // For large date ranges, use a sampling approach
    const shouldSample = daysDiff > 90;
    const sampleInterval = shouldSample ? Math.ceil(daysDiff / 90) : 1;

    // Initialize dates in range with zero count (with sampling for large ranges)
    for (let i = 0; i <= daysDiff; i += sampleInterval) {
      const date = addDays(startDate, i);
      const dateStr = format(date, "yyyy-MM-dd");
      dateMap.set(dateStr, 0);
    }

    // Count earthquakes per day
    earthquakes.forEach((eq) => {
      const date = format(new Date(eq.properties.time), "yyyy-MM-dd");
      dateMap.set(date, (dateMap.get(date) || 0) + 1);
    });

    const frequencyPerDay = Array.from(dateMap).map(([date, count]) => ({
      date,
      count,
    }));

    // Magnitude distribution
    const magnitudeRanges = [
      { min: 0, max: 2, label: "0-2" },
      { min: 2, max: 4, label: "2-4" },
      { min: 4, max: 6, label: "4-6" },
      { min: 6, max: 8, label: "6-8" },
      { min: 8, max: 10, label: "8+" },
    ];

    const magnitudeDistribution = magnitudeRanges.map((range) => {
      const count = earthquakes.filter(
        (eq) =>
          eq.properties.mag >= range.min &&
          (range.max === 10 || eq.properties.mag < range.max)
      ).length;
      return { range: range.label, count };
    });

    this.summarySubject.next({
      count: earthquakes.length,
      averageMagnitude,
      strongestEarthquake,
      frequencyPerDay,
      magnitudeDistribution,
    });
  }

  /**
   * Returns a color based on earthquake magnitude
   * @param magnitude - The earthquake magnitude
   * @returns A color string (hex code)
   */
  getMagnitudeColor(magnitude: number): string {
    if (magnitude < 2) return "#1976D2"; // Blue - Minor
    if (magnitude < 4) return "#43A047"; // Green - Light
    if (magnitude < 6) return "#FFC107"; // Yellow - Moderate
    if (magnitude < 8) return "#FF9800"; // Orange - Strong
    return "#F44336"; // Red - Major
  }

  /**
   * Returns a description based on earthquake magnitude
   * @param magnitude - The earthquake magnitude
   * @returns A text description
   */
  getMagnitudeDescription(magnitude: number): string {
    if (magnitude < 2) return "Minor";
    if (magnitude < 4) return "Light";
    if (magnitude < 6) return "Moderate";
    if (magnitude < 8) return "Strong";
    return "Major";
  }

  /**
   * Calculates an appropriate radius for map markers based on magnitude
   * @param magnitude - The earthquake magnitude
   * @returns Radius value in pixels
   */
  getMarkerRadius(magnitude: number): number {
    return Math.max(5, magnitude * 3);
  }
}

