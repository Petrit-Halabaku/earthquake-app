import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgxEchartsModule } from 'ngx-echarts';
import { ECharts, EChartsOption } from 'echarts';
import { EarthquakeSummary } from '../../models/earthquake.model';
import { EarthquakeService } from '../../services/earthquake.service';

@Component({
  selector: 'app-magnitude-chart',
  standalone: true,
  imports: [CommonModule, NgxEchartsModule],
  template: `
    <div class="card">
      <h3 class="card-title">Magnitude Distribution</h3>
      <div 
        echarts 
        [options]="chartOptions" 
        [theme]="'macarons'" 
        class="chart-container"
        (chartInit)="onChartInit($event)">
      </div>
    </div>
  `,
  styles: [`
    .chart-container {
      height: 300px;
      width: 100%;
    }
  `]
})
export class MagnitudeChartComponent implements OnChanges {
  @Input() summary: EarthquakeSummary | null = null;
  
  chartOptions: EChartsOption = {};
  chartInstance!: ECharts;
  
  constructor(private earthquakeService: EarthquakeService) {}
  
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['summary'] && this.summary) {
      this.updateChartOptions();
    }
  }
  
  onChartInit(chartInstance: ECharts): void {
    this.chartInstance = chartInstance;
  }
  
  updateChartOptions(): void {
    if (!this.summary) return;
    
    const { magnitudeDistribution } = this.summary;
    
    const categories = magnitudeDistribution.map(item => item.range);
    const data = magnitudeDistribution.map(item => ({
      value: item.count,
      itemStyle: {
        color: this.getColorForRange(item.range)
      }
    }));
    
    this.chartOptions = {
      tooltip: {
        trigger: 'item',
        formatter: '{a} <br/>{b}: {c} ({d}%)'
      },
      legend: {
        orient: 'vertical',
        right: 10,
        top: 'center',
        data: categories
      },
      series: [
        {
          name: 'Magnitude',
          type: 'pie',
          radius: ['40%', '70%'],
          avoidLabelOverlap: false,
          label: {
            show: false,
            position: 'center'
          },
          emphasis: {
            label: {
              show: true,
              fontSize: '16',
              fontWeight: 'bold'
            }
          },
          labelLine: {
            show: false
          },
          data: data
        }
      ],
      animation: true,
      animationDuration: 1000,
      animationEasing: 'elasticOut'
    };
  }
  
  getColorForRange(range: string): string {
    switch(range) {
      case '0-2': return '#1976D2'; // Blue - Minor
      case '2-4': return '#43A047'; // Green - Light
      case '4-6': return '#FFC107'; // Yellow - Moderate
      case '6-8': return '#FF9800'; // Orange - Strong
      case '8+': return '#F44336'; // Red - Major
      default: return '#9E9E9E';
    }
  }
}