"use client";

import dynamic from "next/dynamic";

const DynamicDonutChart = dynamic(
  async () => {
    const module = await import("@cnbs/charts");
    return module.DonutChart;
  },
  {
    ssr: false,
    loading: () => (
      <div
        style={{
          height: 360,
          borderRadius: 24,
          background: "linear-gradient(90deg, rgba(226,232,240,0.9) 25%, rgba(241,245,249,0.9) 50%, rgba(226,232,240,0.9) 75%)",
          backgroundSize: "200% 100%",
          animation: "cnbs-skeleton 1.4s ease-in-out infinite"
        }}
      />
    )
  }
);

export interface LazyDonutDatum {
  label: string;
  value: number;
}

export function LazyDonutChart({ title, data }: { title: string; data: LazyDonutDatum[] }) {
  return <DynamicDonutChart title={title} data={data} />;
}
