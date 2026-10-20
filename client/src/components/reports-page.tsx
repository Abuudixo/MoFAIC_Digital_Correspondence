import { useQuery } from "@tanstack/react-query";
import { api } from "../api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Skeleton } from "./ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import {
  Department,
  EmptyRow,
  humanize,
  Metric,
  PageHeading,
  QueryError,
} from "./workspace-shared";

export function ReportsPage({ token }: { token: string }) {
  const me = useQuery({
    queryKey: ["me"],
    queryFn: async () =>
      api<{ user: { permissions: string[] } }>("/auth/me").then(
        (response) => response.user,
      ),
    enabled: Boolean(token),
  });
  const canReadArchive =
    me.data?.permissions.includes("correspondence:read:archive") ?? false;
  const canReviewRetention =
    me.data?.permissions.includes("reports:read") &&
    me.data?.permissions.includes("correspondence:read:archive");
  const summary = useQuery({
    queryKey: ["summary"],
    queryFn: async () => {
      const response = await api<{
        report: {
          totals: Record<string, number>;
          groups: {
            byDepartment: Array<{ department?: Department; count: number }>;
            byClassification: Array<{ classification: string; count: number }>;
            byMonth: Array<{ month: string; volume: number }>;
          };
        };
      }>("/reports/summary?includeArchived=false");
      return response.report;
    },
    enabled: Boolean(token),
  });
  const archivedSummary = useQuery({
    queryKey: ["archived-summary"],
    queryFn: async () => {
      const response = await api<{
        report: {
          totals: Record<string, number>;
          groups: {
            byDepartment: Array<{ department?: Department; count: number }>;
            byClassification: Array<{ classification: string; count: number }>;
            byMonth: Array<{ month: string; volume: number }>;
          };
        };
      }>("/reports/summary?includeArchived=true");
      return response.report;
    },
    enabled: Boolean(token && canReadArchive),
  });
  const actionSummary = useQuery({
    queryKey: ["actionSummary"],
    queryFn: async () => {
      const response = await api<{
        report: {
          total: number;
          overdue: number;
          byStatus: Array<{ status: string; count: number }>;
        };
      }>("/actions/report");
      return response.report;
    },
    enabled: Boolean(token),
  });
  const retention = useQuery({
    queryKey: ["retention-review"],
    queryFn: async () =>
      api<{
        items: Array<{
          id: string;
          referenceNumber: string;
          subject: string;
          retentionCategory?: string | null;
        }>;
      }>("/reports/retention-review"),
    enabled: Boolean(token && canReviewRetention),
  });
  const totals = summary.data?.totals ?? {};
  const pendingActions = actionSummary.data?.byStatus
    .filter((entry) => entry.status !== "COMPLETED")
    .reduce((total, entry) => total + entry.count, 0);
  const completionRate = summary.data
    ? summary.data.totals.total
      ? (summary.data.totals.closed / summary.data.totals.total) * 100
      : 0
    : undefined;
  return (
    <section className="space-y-5">
      <PageHeading
        eyebrow="Management information"
        title="Reports & analytics"
        description="Live correspondence, action and retention metrics returned by the API."
      />
      {me.isError ? <QueryError message={me.error.message} /> : null}
      {summary.isError ? <QueryError message={summary.error.message} /> : null}
      {archivedSummary.isError ? (
        <QueryError message={archivedSummary.error.message} />
      ) : null}
      {actionSummary.isError ? (
        <QueryError message={actionSummary.error.message} />
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Metric
          label="Incoming"
          value={totals.incoming}
          loading={summary.isLoading}
        />
        <Metric
          label="Outgoing"
          value={totals.outgoing}
          loading={summary.isLoading}
        />
        <Metric
          label="Overdue correspondence"
          value={totals.overdue}
          loading={summary.isLoading}
        />
        <Metric
          label="Pending actions"
          value={pendingActions}
          loading={actionSummary.isLoading}
        />
        <Metric
          label="Overdue actions"
          value={actionSummary.data?.overdue}
          loading={actionSummary.isLoading}
        />
        <Metric
          label="Completion rate (closed / active)"
          loading={summary.isLoading}
          displayValue={
            completionRate === undefined
              ? undefined
              : `${completionRate.toFixed(1)}%`
          }
        />
        {canReadArchive ? (
          <Metric
            label="Archived records"
            value={archivedSummary.data?.totals.archived}
            loading={archivedSummary.isLoading}
          />
        ) : null}
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Correspondence by month</CardTitle>
            <CardDescription>
              Volume from the backend management report.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(summary.data?.groups.byMonth ?? []).map((entry) => (
              <div
                key={entry.month}
                className="grid grid-cols-[90px_1fr_45px] items-center gap-3 text-sm"
              >
                <span className="text-slate-600">{entry.month}</span>
                <div className="h-2 rounded-full bg-slate-100">
                  <div
                    className="h-2 rounded-full bg-[#1d4f68]"
                    style={{
                      width: `${Math.min(100, (entry.volume / Math.max(1, ...summary.data!.groups.byMonth.map((point) => point.volume))) * 100)}%`,
                    }}
                  />
                </div>
                <span className="text-right font-medium">{entry.volume}</span>
              </div>
            ))}
            {!summary.data?.groups.byMonth.length ? (
              <p className="text-sm text-slate-500">
                No monthly data returned.
              </p>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Correspondence workflow</CardTitle>
            <CardDescription>
              Current record counts by configured workflow status.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              ["Registered", "open", totals.open],
              ["Under action", "in-progress", totals.inProgress],
              ["Review", "pending-approval", totals.pendingApproval],
              ["Approved", "approved", totals.approved],
              ["Dispatch", "dispatched", totals.dispatched],
              ["Closed", "closed", totals.closed],
              ...(archivedSummary.data
                ? [
                    [
                      "Archived",
                      "archived",
                      archivedSummary.data.totals.archived,
                    ] as const,
                  ]
                : []),
            ].map(([label, key, count]) => (
              <div
                key={key}
                className="flex items-center justify-between border-b border-slate-100 pb-2 text-sm"
              >
                <span>{label}</span>
                <span className="font-semibold">
                  {typeof count === "number" ? count.toLocaleString() : "—"}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Department workload</CardTitle>
            <CardDescription>
              Correspondence counts grouped by responsible unit.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(summary.data?.groups.byDepartment ?? []).map((entry) => (
              <div
                key={entry.department?.id ?? entry.department?.name}
                className="flex items-center justify-between border-b border-slate-100 pb-2 text-sm"
              >
                <span>{entry.department?.name ?? "Department"}</span>
                <span className="font-semibold">{entry.count}</span>
              </div>
            ))}
            {!summary.data?.groups.byDepartment.length ? (
              <p className="text-sm text-slate-500">
                No department data returned.
              </p>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Action status</CardTitle>
            <CardDescription>
              Current distribution across action workflow stages.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(actionSummary.data?.byStatus ?? []).map((entry) => (
              <div
                key={entry.status}
                className="flex items-center justify-between border-b border-slate-100 pb-2 text-sm"
              >
                <span>{humanize(entry.status)}</span>
                <span className="font-semibold">{entry.count}</span>
              </div>
            ))}
            {!actionSummary.data?.byStatus.length ? (
              <p className="text-sm text-slate-500">No action data returned.</p>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Classification distribution</CardTitle>
            <CardDescription>
              Records grouped by their controlled classification.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(summary.data?.groups.byClassification ?? []).map((entry) => (
              <div
                key={entry.classification}
                className="flex items-center justify-between border-b border-slate-100 pb-2 text-sm"
              >
                <span>{humanize(entry.classification)}</span>
                <span className="font-semibold">{entry.count}</span>
              </div>
            ))}
            {!summary.data?.groups.byClassification.length ? (
              <p className="text-sm text-slate-500">
                No classification data returned.
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>
      {canReviewRetention ? (
        <Card>
          <CardHeader>
            <CardTitle>Retention review</CardTitle>
            <CardDescription>
              Records returned by the server retention-review report.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {retention.isError ? (
              <QueryError message={retention.error.message} />
            ) : null}
            {retention.isLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Reference</TableHead>
                      <TableHead>Subject</TableHead>
                      <TableHead>Retention category</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(retention.data?.items ?? []).map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">
                          {item.referenceNumber}
                        </TableCell>
                        <TableCell>{item.subject}</TableCell>
                        <TableCell>{item.retentionCategory ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                    {!retention.data?.items.length ? (
                      <EmptyRow
                        colSpan={3}
                        message="No records require retention review."
                      />
                    ) : null}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}
    </section>
  );
}
