import * as React from "react";
import { Activity } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { Badge } from "./ui/badge";
import { Card, CardContent, CardDescription, CardHeader } from "./ui/card";
import { Skeleton } from "./ui/skeleton";
import { TableCell, TableRow } from "./ui/table";

export type Department = { id: string; name: string; code: string };

export type RecordSummary = {
  id: string;
  referenceNumber: string;
  documentNumber?: string | null;
  direction: string;
  type: string;
  subject: string;
  sender: string;
  recipient: string;
  organization?: string | null;
  countryMission?: string | null;
  departmentId: string;
  department?: Department;
  priority: string;
  confidentiality: string;
  status: string;
  dueStatus?: string;
  dueDate?: string | null;
  dateReceived?: string | null;
  dateSent?: string | null;
  dateClosed?: string | null;
  archivedAt?: string | null;
};

export type ActionItem = {
  id: string;
  requiredAction: string;
  status: string;
  priority: string;
  dueDate: string;
  createdAt: string;
  completionDate?: string | null;
  remarks?: string | null;
  department?: Department;
  assignedTo?: { id: string; name: string } | null;
  correspondence: { id: string; referenceNumber: string; subject: string };
};

export type ReferenceLists = {
  directions: string[];
  documentTypes: string[];
  classifications: string[];
  statuses: string[];
  priorities: string[];
  actionStatuses: string[];
  departments: Department[];
};

export type RecordDetail = RecordSummary & {
  notes?: string | null;
  currentActionLocation?: string | null;
  fileLocation?: string | null;
  workflows?: Array<{
    id: string;
    toStatus: string;
    note?: string | null;
    createdAt: string;
    actor?: { name: string };
  }>;
  documents?: Array<{
    id: string;
    fileName: string;
    originalFileName?: string | null;
    mimeType: string;
    fileSize: string;
    version?: number;
    createdAt: string;
  }>;
  actionItems?: ActionItem[];
};

export function useReferenceData(token: string) {
  return useQuery({
    queryKey: ["reference-lists"],
    queryFn: async () => {
      const response = await api<{ lists: ReferenceLists }>("/lists");
      return response.lists;
    },
    enabled: Boolean(token),
  });
}

export function PageHeading({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#547184]">
          {eyebrow}
        </p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
          {title}
        </h2>
        <p className="mt-1 max-w-3xl text-sm text-slate-500">{description}</p>
      </div>
      {children}
    </div>
  );
}

export function DueIndicator({ value }: { value?: string }) {
  if (!value) return null;
  const variant =
    value === "OVERDUE"
      ? "danger"
      : value === "ON TRACK"
        ? "success"
        : "secondary";
  return <Badge variant={variant}>{humanize(value)}</Badge>;
}

export function Field({
  label,
  required,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label
      className={`space-y-1.5 text-sm font-medium text-slate-700 ${className ?? ""}`}
    >
      <span>
        {label}
        {required ? <span className="text-rose-600"> *</span> : null}
      </span>
      {children}
    </label>
  );
}

export function SelectField({
  name,
  values,
  items,
}: {
  name: string;
  values?: string[];
  items?: Array<{ value: string; label: string }>;
}) {
  const options =
    items ?? (values ?? []).map((value) => ({ value, label: humanize(value) }));
  return (
    <select
      name={name}
      required
      className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-400"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

export function Detail({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 break-words font-medium text-slate-800">
        {value || "—"}
      </p>
    </div>
  );
}

export function Metric({
  label,
  value,
  displayValue,
  loading = false,
}: {
  label: string;
  value?: number;
  displayValue?: string;
  loading?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-9 w-24" />
        ) : (
          <p className="text-3xl font-semibold tracking-tight">
            {displayValue ?? value?.toLocaleString() ?? "—"}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function QueryError({ message }: { message: string }) {
  return (
    <Alert className="border-rose-200 bg-rose-50 text-rose-900">
      <Activity className="h-4 w-4" />
      <AlertTitle>Request failed</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

export function EmptyRow({ colSpan, message }: { colSpan: number; message: string }) {
  return (
    <TableRow>
      <TableCell
        colSpan={colSpan}
        className="py-9 text-center text-sm text-slate-500"
      >
        {message}
      </TableCell>
    </TableRow>
  );
}

export function StatusBadge({ value }: { value: string }) {
  const tone = ["CLOSED", "COMPLETED", "APPROVED"].includes(value)
    ? "success"
    : ["IN_PROGRESS", "PENDING_APPROVAL", "DISPATCHED"].includes(value)
      ? "info"
      : value === "ARCHIVED" || value === "OVERDUE"
        ? "warning"
        : "secondary";
  return <Badge variant={tone}>{humanize(value)}</Badge>;
}

export function priorityVariant(value: string): "danger" | "warning" | "secondary" {
  if (value === "URGENT") return "danger";
  if (value === "HIGH") return "warning";
  return "secondary";
}

export function humanize(value: string) {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleDateString() : "—";
}
