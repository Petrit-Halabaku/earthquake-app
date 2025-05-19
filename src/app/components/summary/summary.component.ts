import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EarthquakeSummary, EarthquakeFeature } from '../../models/earthquake.model';
import { DateFormatterService } from '../../services/date-formatter.service';
import { EarthquakeService } from '../../services/earthquake.service';

@Component({
  selector: 'app-summary',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="summary-container">
      <div class="grid">
        <div class="card summary-card" style="grid-column: span 3;">
          <div class="summary-icon-container">
            <span class="material-symbols-outlined summary-icon">format_list_numbered</span>
          </div>
          <div class="summary-content">
            <div class="summary-title">Total Earthquakes</div>
            <div class="summary-value">{{ summary?.count || 0 }}</div>
          </div>
        </div>
        
        <div class="card summary-card" style="grid-column: span 3;">
          <div class="summary-icon-container">
            <span class="material-symbols-outlined summary-icon">speed</span>
          </div>
          <div class="summary-content">
            <div class="summary-title">Average Magnitude</div>
            <div class="summary-value">{{ summary?.averageMagnitude?.toFixed(2) || '0.00' }}</div>
          </div>
        </div>
        
        <div class="card summary-card" style="grid-column: span 6;">
          <div class="summary-icon-container">
            <span class="material-symbols-outlined summary-icon">warning</span>
          </div>
          <div class="summary-content">
            <div class="summary-title">Strongest Earthquake</div>
            <ng-container *ngIf="summary?.strongestEarthquake?.properties as props">
              <div class="summary-value">
                <span [style.color]="getColorForMagnitude(props.mag)">
                  M{{ props.mag.toFixed(1) }}
                </span>
                - {{ props.place }}
              </div>
              <div class="summary-details">
                {{ formatDate(props.time) }}
              </div>
            </ng-container>
            <div class="summary-value" *ngIf="!summary?.strongestEarthquake">
              No earthquakes found
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .summary-container {
      margin-bottom: calc(var(--spacing-unit) * 2);
    }
    
    .summary-card {
      display: flex;
      align-items: center;
      padding: calc(var(--spacing-unit) * 2);
    }
    
    .summary-icon-container {
      background-color: rgba(25, 118, 210, 0.1);
      border-radius: 50%;
      width: 60px;
      height: 60px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-right: calc(var(--spacing-unit) * 2);
    }
    
    .summary-icon {
      font-size: 32px;
      color: var(--primary);
    }
    
    .summary-content {
      flex: 1;
    }
    
    .summary-title {
      font-size: 1rem;
      color: var(--gray-600);
      margin-bottom: var(--spacing-unit);
    }
    
    .summary-value {
      font-size: 1.5rem;
      font-weight: 500;
      color: var(--gray-900);
    }
    
    .summary-details {
      font-size: 0.875rem;
      color: var(--gray-600);
      margin-top: var(--spacing-unit);
    }
    
    @media (max-width: 768px) {
      .summary-card {
        grid-column: span 6 !important;
      }
      
      .summary-icon-container {
        width: 50px;
        height: 50px;
      }
      
      .summary-icon {
        font-size: 28px;
      }
      
      .summary-value {
        font-size: 1.25rem;
      }
    }
  `]
})
export class SummaryComponent implements OnChanges {
  @Input() summary: EarthquakeSummary | null = null;

  constructor(
    private dateFormatterService: DateFormatterService,
    private earthquakeService: EarthquakeService
  ) { }

  ngOnChanges(changes: SimpleChanges): void {
    // This method will be triggered when the summary input changes
  }

  formatDate(timestamp: number): string {
    return this.dateFormatterService.formatDateTime(timestamp);
  }

  getColorForMagnitude(magnitude: number): string {
    return this.earthquakeService.getMagnitudeColor(magnitude);
  }
}