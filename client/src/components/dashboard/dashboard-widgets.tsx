import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader } from "../ui/card";

export function KpiCard({
  label,
  value,
  description,
  accent,
  icon,
}: {
  label: string;
  value: string;
  description: string;
  accent: string;
  icon: React.ReactNode;
}) {
  return (
    <Card className="overflow-hidden border-slate-200 shadow-sm">
      <div className={`h-1.5 w-full ${accent}`} />
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardDescription>{label}</CardDescription>
        <div className={`rounded-md p-2 text-white ${accent}`}>{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold text-slate-900">{value}</div>
        <p className="mt-2 text-xs text-slate-500">{description}</p>
      </CardContent>
    </Card>
  );
}

export function MiniStat({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium text-slate-600">{label}</span>
        <div className="rounded-md bg-slate-200 p-2 text-slate-700">{icon}</div>
      </div>
      <div className="text-2xl font-semibold text-slate-900">{value}</div>
    </div>
  );
}

export function formatStatus(value: string | undefined) {
  if (!value) return "Unknown";
  return value
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function badgeVariant(status: string) {
  const normalized = status.toUpperCase();
  if (["OPEN", "IN_PROGRESS", "PENDING_APPROVAL"].includes(normalized))
    return "info";
  if (["APPROVED", "DISPATCHED", "CLOSED"].includes(normalized))
    return "success";
  if (["OVERDUE", "ARCHIVED"].includes(normalized)) return "warning";
  return "secondary";
}

export function statusPieData(totals: Record<string, number>) {
  const palette = [
    "#0f766e",
    "#0284c7",
    "#f59e0b",
    "#22c55e",
    "#475569",
    "#7c3aed",
    "#be123c",
  ];
  const values = [
    { name: "Open", value: Number(totals.open ?? 0) },
    { name: "In progress", value: Number(totals.inProgress ?? 0) },
    { name: "Pending approval", value: Number(totals.pendingApproval ?? 0) },
    { name: "Approved", value: Number(totals.approved ?? 0) },
    { name: "Dispatched", value: Number(totals.dispatched ?? 0) },
    { name: "Closed", value: Number(totals.closed ?? 0) },
    { name: "Archived", value: Number(totals.archived ?? 0) },
  ].filter((item) => item.value > 0);

  return values.map((item, index) => ({
    ...item,
    color: palette[index % palette.length],
  }));
}
