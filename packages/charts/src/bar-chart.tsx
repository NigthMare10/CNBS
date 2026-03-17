"use client";

import ReactECharts from "echarts-for-react";

export interface BarDatum {
  label: string;
  value: number;
}

export function BarChart({ title, data, color = "#0f766e" }: { title: string; data: BarDatum[]; color?: string }) {
  return (
    <ReactECharts
      style={{ height: 360 }}
      option={{
        title: { text: title, left: 0, textStyle: { fontFamily: "sans-serif", fontWeight: 600, fontSize: 14 } },
        tooltip: { trigger: "axis" },
        grid: { top: 56, right: 12, bottom: 24, left: 80 },
        xAxis: { type: "value", axisLabel: { color: "#475569" } },
        yAxis: {
          type: "category",
          data: data.map((item) => item.label),
          axisLabel: { color: "#475569", width: 120, overflow: "truncate" }
        },
        series: [
          {
            type: "bar",
            data: data.map((item) => item.value),
            itemStyle: { color, borderRadius: [0, 6, 6, 0] }
          }
        ]
      }}
    />
  );
}
