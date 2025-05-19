import {
  Component,
  Input,
  type OnChanges,
  type SimpleChanges,
  type AfterViewInit,
  type OnDestroy,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { LeafletModule } from "@asymmetrik/ngx-leaflet";
import * as L from "leaflet";
import type { EarthquakeFeature } from "../../models/earthquake.model";
import { EarthquakeService } from "../../services/earthquake.service";
import { DateFormatterService } from "../../services/date-formatter.service";
import { Subject } from "rxjs";
import { debounceTime, takeUntil } from "rxjs/operators";

// Import marker cluster styles
// Note: In a real implementation, you would need to include the MarkerCluster CSS
// and add the MarkerCluster plugin to your dependencies

@Component({
  selector: "app-earthquake-map",
  standalone: true,
  imports: [CommonModule, LeafletModule],
  template: `
    <div class="card">
      <h3 class="card-title">Earthquake Map</h3>
      <div class="map-controls">
        <div class="form-group">
          <label for="clusteringToggle" class="form-label">Clustering</label>
          <div class="toggle-switch">
            <input
              type="checkbox"
              id="clusteringToggle"
              [checked]="enableClustering"
              (change)="toggleClustering()"
            />
            <label for="clusteringToggle"></label>
          </div>
        </div>
        <div class="form-group">
          <label for="heatmapToggle" class="form-label">Heatmap</label>
          <div class="toggle-switch">
            <input
              type="checkbox"
              id="heatmapToggle"
              [checked]="enableHeatmap"
              (change)="toggleHeatmap()"
            />
            <label for="heatmapToggle"></label>
          </div>
        </div>
        <div class="map-info" *ngIf="earthquakes.length > 1000">
          <span class="material-symbols-outlined">info</span>
          Showing {{ earthquakes.length }} earthquakes.
          {{
            enableClustering ? "Clustering enabled for better performance." : ""
          }}
        </div>
      </div>
      <div
        class="map-container"
        leaflet
        [leafletOptions]="options"
        (leafletMapReady)="onMapReady($event)"
      ></div>
    </div>
  `,
  styles: [
    `
      .map-container {
        height: 500px;
        width: 100%;
        border-radius: var(--radius-sm);
        overflow: hidden;
      }

      .map-controls {
        display: flex;
        flex-wrap: wrap;
        gap: var(--spacing-unit);
        margin-bottom: var(--spacing-unit);
        align-items: center;
      }

      .map-controls .form-group {
        display: flex;
        align-items: center;
        margin-bottom: 0;
        margin-right: var(--spacing-unit);
      }

      .map-controls .form-label {
        margin-bottom: 0;
        margin-right: var(--spacing-unit);
      }

      .toggle-switch {
        position: relative;
        display: inline-block;
        width: 40px;
        height: 20px;
      }

      .toggle-switch input {
        opacity: 0;
        width: 0;
        height: 0;
      }

      .toggle-switch label {
        position: absolute;
        cursor: pointer;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: var(--gray-300);
        transition: 0.4s;
        border-radius: 34px;
      }

      .toggle-switch label:before {
        position: absolute;
        content: "";
        height: 16px;
        width: 16px;
        left: 2px;
        bottom: 2px;
        background-color: white;
        transition: 0.4s;
        border-radius: 50%;
      }

      .toggle-switch input:checked + label {
        background-color: var(--primary);
      }

      .toggle-switch input:checked + label:before {
        transform: translateX(20px);
      }

      .map-info {
        display: flex;
        align-items: center;
        font-size: 0.875rem;
        color: var(--gray-600);
        margin-left: auto;
      }

      .map-info .material-symbols-outlined {
        font-size: 1rem;
        margin-right: 4px;
        color: var(--primary);
      }

      @media (max-width: 768px) {
        .map-container {
          height: 400px;
        }

        .map-controls {
          flex-direction: column;
          align-items: flex-start;
        }

        .map-info {
          margin-left: 0;
          margin-top: var(--spacing-unit);
        }
      }

      @media (max-width: 480px) {
        .map-container {
          height: 300px;
        }
      }
    `,
  ],
})
export class EarthquakeMapComponent
  implements OnChanges, AfterViewInit, OnDestroy
{
  @Input() earthquakes: EarthquakeFeature[] = [];

  map!: L.Map;
  markerLayer: L.LayerGroup = L.layerGroup();
  clusterLayer: any = null; // Will be initialized if clustering is enabled
  heatmapLayer: any = null; // Will be initialized if heatmap is enabled
  enableClustering = true; // Enable clustering by default for large datasets
  enableHeatmap = false;
  private destroy$ = new Subject<void>();
  private updateMarkers$ = new Subject<void>();
  private readonly MARKER_LIMIT_WITHOUT_CLUSTERING = 1000;

  options = {
    layers: [
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }),
    ],
    zoom: 2,
    center: L.latLng(20, 0),
    preferCanvas: true, // Use canvas rendering for better performance
  };

  constructor(
    private earthquakeService: EarthquakeService,
    private dateFormatterService: DateFormatterService
  ) {}

  ngAfterViewInit(): void {
    // Set up debounced marker updates for better performance
    this.updateMarkers$
      .pipe(
        takeUntil(this.destroy$),
        debounceTime(100) // Debounce marker updates to avoid UI freezing
      )
      .subscribe(() => {
        this.renderMarkers();
      });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes["earthquakes"]) {
      // Auto-enable clustering for large datasets
      if (this.earthquakes.length > this.MARKER_LIMIT_WITHOUT_CLUSTERING) {
        this.enableClustering = true;
      }

      // Trigger debounced update
      this.updateMarkers$.next();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onMapReady(map: L.Map): void {
    this.map = map;

    // Add layers to map
    this.markerLayer.addTo(this.map);

    // Initialize cluster layer if needed
    if (this.enableClustering) {
      this.initializeClusterLayer();
    }

    // Render markers
    this.renderMarkers();

    // Add scale control
    L.control.scale().addTo(this.map);
  }

  toggleClustering(): void {
    this.enableClustering = !this.enableClustering;

    if (this.enableClustering) {
      this.initializeClusterLayer();
    } else {
      if (this.clusterLayer) {
        this.map.removeLayer(this.clusterLayer);
        this.clusterLayer = null;
      }
    }

    this.renderMarkers();
  }

  toggleHeatmap(): void {
    this.enableHeatmap = !this.enableHeatmap;

    if (this.enableHeatmap) {
      this.initializeHeatmapLayer();
    } else {
      if (this.heatmapLayer) {
        this.map.removeLayer(this.heatmapLayer);
        this.heatmapLayer = null;
      }
    }

    this.renderMarkers();
  }

  private initializeClusterLayer(): void {
    // Note: In a real implementation, you would need to add the MarkerCluster plugin
    // this.clusterLayer = L.markerClusterGroup({
    //   chunkedLoading: true,
    //   spiderfyOnMaxZoom: false,
    //   disableClusteringAtZoom: 10,
    //   maxClusterRadius: 80,
    //   iconCreateFunction: (cluster) => {
    //     const count = cluster.getChildCount()
    //     let size = 'small'
    //
    //     if (count > 100) size = 'large'
    //     else if (count > 10) size = 'medium'
    //
    //     return L.divIcon({
    //       html: `<div class="cluster-icon cluster-${size}">${count}</div>`,
    //       className: 'earthquake-cluster',
    //       iconSize: L.point(40, 40)
    //     })
    //   }
    // })
    //
    // this.map.addLayer(this.clusterLayer)
  }

  private initializeHeatmapLayer(): void {
    // Note: In a real implementation, you would need to add the Leaflet.heat plugin
    // const heatData = this.earthquakes.map(eq => {
    //   const [lng, lat] = eq.geometry.coordinates
    //   const intensity = eq.properties.mag * eq.properties.mag // Square for better visualization
    //   return [lat, lng, intensity]
    // })
    //
    // this.heatmapLayer = L.heatLayer(heatData, {
    //   radius: 20,
    //   blur: 15,
    //   maxZoom: 10,
    //   max: 10,
    //   gradient: {
    //     0.0: '#1976D2',
    //     0.2: '#43A047',
    //     0.4: '#FFC107',
    //     0.6: '#FF9800',
    //     0.8: '#F44336',
    //     1.0: '#B71C1C'
    //   }
    // })
    //
    // this.map.addLayer(this.heatmapLayer)
  }

  renderMarkers(): void {
    // Clear existing markers
    this.markerLayer.clearLayers();

    if (this.clusterLayer) {
      // this.clusterLayer.clearLayers()
    }

    if (!this.earthquakes.length) return;

    // For large datasets without clustering, limit the number of markers
    let earthquakesToRender = this.earthquakes;
    if (
      !this.enableClustering &&
      this.earthquakes.length > this.MARKER_LIMIT_WITHOUT_CLUSTERING
    ) {
      // Sample the data to avoid too many markers
      const samplingRate = Math.ceil(
        this.earthquakes.length / this.MARKER_LIMIT_WITHOUT_CLUSTERING
      );
      earthquakesToRender = this.earthquakes.filter(
        (_, index) => index % samplingRate === 0
      );
    }

    // Process in batches to avoid UI freezing
    this.processMarkerBatches(earthquakesToRender);
  }

  private processMarkerBatches(
    earthquakes: EarthquakeFeature[],
    batchSize = 500,
    batchIndex = 0
  ): void {
    const start = batchSize * batchIndex;
    const end = Math.min(start + batchSize, earthquakes.length);
    const batch = earthquakes.slice(start, end);

    // Process this batch
    const markers: L.CircleMarker[] = [];

    batch.forEach((eq) => {
      const [lng, lat, depth] = eq.geometry.coordinates;
      const magnitude = eq.properties.mag;
      const color = this.earthquakeService.getMagnitudeColor(magnitude);
      const radius = this.earthquakeService.getMarkerRadius(magnitude);

      const marker = L.circleMarker([lat, lng], {
        radius: radius,
        fillColor: color,
        color: "#000",
        weight: 1,
        opacity: 0.8,
        fillOpacity: 0.6,
      });

      const popupContent = `
        <div class="popup-content">
          <div class="popup-title">${eq.properties.title}</div>
          <div class="popup-detail">Time: ${this.dateFormatterService.formatDateTime(
            eq.properties.time
          )}</div>
          <div class="popup-detail">Magnitude: <strong>${magnitude.toFixed(
            1
          )}</strong></div>
          <div class="popup-detail">Depth: ${depth.toFixed(1)} km</div>
          <div class="popup-detail">Status: ${eq.properties.status}</div>
          <div class="popup-link"><a href="${
            eq.properties.url
          }" target="_blank">View details</a></div>
        </div>
      `;

      marker.bindPopup(popupContent);
      markers.push(marker);

      if (this.enableClustering && this.clusterLayer) {
        // this.clusterLayer.addLayer(marker)
      } else {
        marker.addTo(this.markerLayer);
      }
    });

    // If there are more batches to process, schedule the next one
    if (end < earthquakes.length) {
      setTimeout(() => {
        this.processMarkerBatches(earthquakes, batchSize, batchIndex + 1);
      }, 10); // Small delay to allow UI to update
    } else {
      // All batches processed, fit bounds if needed
      this.fitMapBounds(markers);
    }
  }

  private fitMapBounds(markers: L.CircleMarker[]): void {
    // If there are markers, fit the map to show all of them
    if (markers.length > 0) {
      const group = L.featureGroup(markers);
      this.map.fitBounds(group.getBounds(), { padding: [30, 30] });
    }
  }
}
