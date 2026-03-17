"use client";

import * as React from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef
} from "@tanstack/react-table";

export function DataTable<TData>({
  columns,
  data,
  searchPlaceholder = "Buscar..."
}: {
  columns: ColumnDef<TData>[];
  data: TData[];
  searchPlaceholder?: string;
}) {
  const [globalFilter, setGlobalFilter] = React.useState("");
  const table = useReactTable({
    columns,
    data,
    state: { globalFilter },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onGlobalFilterChange: setGlobalFilter
  });

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <input
        placeholder={searchPlaceholder}
        value={globalFilter}
        onChange={(event) => setGlobalFilter(event.target.value)}
        style={{
          width: "100%",
          borderRadius: 16,
          border: "1px solid #cbd5e1",
          padding: "12px 16px",
          fontSize: 14,
          outline: "none"
        }}
      />
      <div style={{ overflow: "auto", borderRadius: 20, border: "1px solid #e2e8f0", background: "#fff" }}>
        <table style={{ minWidth: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead style={{ background: "#f8fafc" }}>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th key={header.id} style={{ padding: "14px 16px", textAlign: "left", fontWeight: 700, color: "#475569", borderBottom: "1px solid #e2e8f0" }}>
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} style={{ padding: "14px 16px", color: "#334155", borderBottom: "1px solid #f1f5f9" }}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
