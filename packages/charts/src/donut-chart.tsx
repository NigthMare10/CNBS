"use client";

import ReactECharts from "echarts-for-react";

export interface DonutDatum {
  label: string;
  value: number;
}

export function DonutChart({ title, data }: { title: string; data: DonutDatum[] }) {
  return (
    <ReactECharts
      style={{ height: 360 }}
      option={{
        title: { text: title, left: 0, textStyle: { fontFamily: "sans-serif", fontWeight: 600, fontSize: 14 } },
        tooltip: { trigger: "item" },
        legend: { bottom: 0, textStyle: { color: "#475569" } },
        series: [
          {
            type: "pie",
            radius: ["42%", "70%"],
            center: ["50%", "45%"],
            avoidLabelOverlap: true,
            label: { color: "#334155", formatter: "{b}: {d}%" },
            data: data.map((item) => ({ name: item.label, value: item.value }))
          }
        ]
      }}
    />
  );
}
