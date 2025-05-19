import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgxEchartsModule } from 'ngx-echarts';
import { ECharts, EChartsOption } from 'echarts';
import { EarthquakeSummary } from '../../models/earthquake.model';

@Component({
  selector: 'app-frequency-chart',
  standalone: true,
  imports: [CommonModule, NgxEchartsModule],
  template: `
    <div class="card">
      <h3 class="card-title">Earthquake Frequency</h3>
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
export class FrequencyChartComponent implements OnChanges {
  @Input() summary: EarthquakeSummary | null = null;
  
  chartOptions: EChartsOption = {};
  chartInstance!: ECharts;
  
  constructor() {}
  
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
    
    const { frequencyPerDay } = this.summary;
    
    // Sort the data by date
    const sortedData = [...frequencyPerDay].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    
    const dates = sortedData.map(item => item.date);
    const counts = sortedData.map(item => item.count);
    
    this.chartOptions = {
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'cross',
          label: {
            backgroundColor: '#6a7985'
          }
        }
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: dates,
        axisLabel: {
          formatter: (value: string) => {
            const date = new Date(value);
            return `${date.getMonth() + 1}/${date.getDate()}`;
          }
        }
      },
      yAxis: {
        type: 'value',
        name: 'Earthquakes',
        nameLocation: 'end',
        nameGap: 15,
        nameTextStyle: {
          fontWeight: 'bold'
        }
      },
      series: [
        {
          name: 'Earthquakes',
          type: 'line',
          stack: 'Total',
          data: counts,
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                {
                  offset: 0,
                  color: 'rgba(25, 118, 210, 0.8)'
                },
                {
                  offset: 1,
                  color: 'rgba(25, 118, 210, 0.2)'
                }
              ]
            }
          },
          smooth: true,
          lineStyle: {
            width: 3,
            color: '#1976D2'
          },
          itemStyle: {
            color: '#1976D2'
          }
        }
      ],
      animation: true,
      animationDuration: 1000,
      animationEasing: 'elasticOut'
    };
  }
}