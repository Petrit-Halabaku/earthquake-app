import * as echarts from "echarts/core";
import { BarChart, LineChart } from "echarts/charts";
import { GridComponent, TooltipComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { Summary } from "../data/types";
import { magColor } from "../data/quakeUtils";

echarts.use([BarChart, LineChart, GridComponent, TooltipComponent, CanvasRenderer]);

const FONT_MONO = "IBM Plex Mono, monospace";
const AXIS_COLOR = "#5b6378";
const SPLIT_COLOR = "rgba(148,163,198,0.08)";

const baseTooltip = {
  backgroundColor: "rgba(10,13,26,0.94)",
  borderColor: "rgba(148,163,198,0.28)",
  borderWidth: 1,
  textStyle: { color: "#e9edf6", fontFamily: FONT_MONO, fontSize: 12 },
  padding: [8, 12],
};

export class MagnitudeChart {
  private chart: echarts.ECharts;
  constructor(el: HTMLElement) {
    this.chart = echarts.init(el, undefined, { renderer: "canvas" });
  }

  update(summary: Summary) {
    const data = summary.magBuckets;
    // Color each bar by the lower bound of its band.
    const bandMid = [1, 2.5, 3.5, 4.5, 5.5, 6.5];
    this.chart.setOption({
      grid: { top: 18, right: 14, bottom: 28, left: 38 },
      tooltip: {
        ...baseTooltip,
        trigger: "axis",
        axisPointer: { type: "shadow" },
        formatter: (p: any) => {
          const item = p[0];
          return `<strong>Mag ${item.name}</strong><br/>${item.value} event${item.value === 1 ? "" : "s"}`;
        },
      },
      xAxis: {
        type: "category",
        data: data.map((d) => d.label),
        axisLine: { lineStyle: { color: AXIS_COLOR } },
        axisTick: { show: false },
        axisLabel: { color: AXIS_COLOR, fontFamily: FONT_MONO, fontSize: 11 },
      },
      yAxis: {
        type: "value",
        splitLine: { lineStyle: { color: SPLIT_COLOR } },
        axisLabel: { color: AXIS_COLOR, fontFamily: FONT_MONO, fontSize: 11 },
      },
      series: [
        {
          type: "bar",
          data: data.map((d, i) => ({
            value: d.count,
            itemStyle: {
              color: magColor(bandMid[i]),
              borderRadius: [4, 4, 0, 0],
            },
          })),
          barWidth: "58%",
          animationDuration: 700,
          animationEasing: "cubicOut",
        },
      ],
    });
  }

  resize() { this.chart.resize(); }
}

export class FrequencyChart {
  private chart: echarts.ECharts;
  constructor(el: HTMLElement) {
    this.chart = echarts.init(el, undefined, { renderer: "canvas" });
  }

  update(summary: Summary) {
    const data = summary.frequency;
    // Thin x-axis labels when there are many buckets.
    const step = Math.ceil(data.length / 8);
    this.chart.setOption({
      grid: { top: 18, right: 16, bottom: 28, left: 38 },
      tooltip: {
        ...baseTooltip,
        trigger: "axis",
        formatter: (p: any) => {
          const item = p[0];
          return `<strong>${item.name}</strong><br/>${item.value} event${item.value === 1 ? "" : "s"}`;
        },
      },
      xAxis: {
        type: "category",
        boundaryGap: false,
        data: data.map((d) => d.label),
        axisLine: { lineStyle: { color: AXIS_COLOR } },
        axisTick: { show: false },
        axisLabel: {
          color: AXIS_COLOR,
          fontFamily: FONT_MONO,
          fontSize: 11,
          interval: (i: number) => i % step === 0,
        },
      },
      yAxis: {
        type: "value",
        splitLine: { lineStyle: { color: SPLIT_COLOR } },
        axisLabel: { color: AXIS_COLOR, fontFamily: FONT_MONO, fontSize: 11 },
      },
      series: [
        {
          type: "line",
          data: data.map((d) => d.count),
          smooth: 0.4,
          symbol: "circle",
          symbolSize: 5,
          showSymbol: false,
          lineStyle: { color: "#ff5c3d", width: 2 },
          itemStyle: { color: "#ff5c3d" },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: "rgba(255,92,61,0.42)" },
              { offset: 1, color: "rgba(255,92,61,0.0)" },
            ]),
          },
          animationDuration: 800,
          animationEasing: "cubicOut",
        },
      ],
    });
  }

  resize() { this.chart.resize(); }
}
