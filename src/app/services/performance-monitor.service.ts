import { Injectable } from "@angular/core"
import { BehaviorSubject } from "rxjs"

/**
 * Service for monitoring and optimizing application performance
 * with large-scale earthquake data
 */
@Injectable({
  providedIn: "root",
})
export class PerformanceMonitorService {
  private metricsSubject = new BehaviorSubject<PerformanceMetrics>({
    dataLoadTime: 0,
    renderTime: 0,
    memoryUsage: 0,
    dataSize: 0,
    lastUpdated: new Date(),
  })

  metrics$ = this.metricsSubject.asObservable()

  private timers: Record<string, number> = {}

  constructor() {
    // Set up periodic memory usage monitoring if supported
    this.setupMemoryMonitoring()
  }

  /**
   * Start timing an operation
   * @param operation - Name of the operation to time
   */
  startTimer(operation: string): void {
    this.timers[operation] = performance.now()
  }

  /**
   * End timing an operation and record the metric
   * @param operation - Name of the operation to end timing
   * @param dataSize - Optional size of data processed in bytes
   */
  endTimer(operation: string, dataSize?: number): number {
    if (!this.timers[operation]) {
      console.warn(`No timer started for operation: ${operation}`)
      return 0
    }

    const endTime = performance.now()
    const duration = endTime - this.timers[operation]

    // Update metrics based on operation type
    const currentMetrics = this.metricsSubject.value

    switch (operation) {
      case "dataLoad":
        currentMetrics.dataLoadTime = duration
        if (dataSize) currentMetrics.dataSize = dataSize
        break
      case "render":
        currentMetrics.renderTime = duration
        break
      default:
        // Custom operation, just log it
        console.log(`Operation ${operation} took ${duration.toFixed(2)}ms`)
    }

    currentMetrics.lastUpdated = new Date()
    this.metricsSubject.next({ ...currentMetrics }) // Create a new object to trigger change detection

    delete this.timers[operation]
    return duration
  }

  /**
   * Set up monitoring of memory usage if the browser supports it
   */
  private setupMemoryMonitoring(): void {
    if (performance && (performance as any).memory) {
      // Chrome-specific memory monitoring
      setInterval(() => {
        const memory = (performance as any).memory
        const currentMetrics = this.metricsSubject.value

        if (memory && memory.usedJSHeapSize) {
          currentMetrics.memoryUsage = memory.usedJSHeapSize
          this.metricsSubject.next({ ...currentMetrics }) // Create a new object to trigger change detection
        }
      }, 10000) // Check every 10 seconds
    }
  }

  /**
   * Get performance recommendations based on current metrics
   * Focused on large-scale data handling
   */
  getPerformanceRecommendations(): string[] {
    const metrics = this.metricsSubject.value
    const recommendations: string[] = []

    // Data load time recommendations
    if (metrics.dataLoadTime > 10000) {
      // 10 seconds
      recommendations.push("This query took a long time. Consider reducing the date range significantly.")
    } else if (metrics.dataLoadTime > 5000) {
      // 5 seconds
      recommendations.push("For faster loading, try reducing the date range or adding geographic filters.")
    } else if (metrics.dataLoadTime > 3000) {
      // 3 seconds
      recommendations.push("To improve load times, use more specific search criteria.")
    }

    // Data size recommendations
    if (metrics.dataSize > 10 * 1024 * 1024) {
      // 10MB
      recommendations.push("Very large dataset detected. This may impact browser performance.")
    } else if (metrics.dataSize > 5 * 1024 * 1024) {
      // 5MB
      recommendations.push("Large dataset loaded. For better performance, narrow your search criteria.")
    }

    // Render time recommendations
    if (metrics.renderTime > 2000) {
      // 2 seconds
      recommendations.push("Map rendering is slow. Enable clustering for better performance with large datasets.")
    } else if (metrics.renderTime > 1000) {
      // 1 second
      recommendations.push("For smoother map interaction, try enabling clustering.")
    }

    // Memory usage recommendations
    if (metrics.memoryUsage > 200 * 1024 * 1024) {
      // 200MB
      recommendations.push("High memory usage detected. Consider refreshing the browser.")
    } else if (metrics.memoryUsage > 100 * 1024 * 1024) {
      // 100MB
      recommendations.push(
        "Memory usage is increasing. You may need to refresh the browser after several large queries.",
      )
    }

    // If no specific recommendations, but we're showing the panel anyway
    if (recommendations.length === 0) {
      recommendations.push("For best performance with large datasets, use specific date ranges and geographic filters.")
    }

    return recommendations
  }

  /**
   * Format bytes to human-readable format
   */
  formatBytes(bytes: number): string {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }
}

/**
 * Interface for performance metrics
 */
export interface PerformanceMetrics {
  dataLoadTime: number // Time to load data in ms
  renderTime: number // Time to render in ms
  memoryUsage: number // Memory usage in bytes
  dataSize: number // Size of data in bytes
  lastUpdated: Date // When metrics were last updated
}
