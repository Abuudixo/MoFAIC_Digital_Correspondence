import * as React from "react";
import {
  Activity,
  ArrowDownToLine,
  ArrowUpFromLine,
  Bell,
  CalendarClock,
  CheckCheck,
  CircleAlert,
  ClipboardCheck,
  Clock3,
  FileText,
  FolderOpen,
  Plus,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react";
import type { DashboardPageName } from "./dashboard-layout";
import { DashboardLayout } from "./dashboard-layout";
import type {
  CorrespondenceItem,
  DashboardSummary,
  OverdueItem,
} from "./dashboard-session";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { Skeleton } from "../ui/skeleton";

type DirectorUser = {
  name: string;
  department: { id: string; name: string; code: string } | null;
};

type DirectorNotification = {
  id: string;
  kind: string;
  message: string;
  createdAt: string;
};

type DirectorActionSummary = {
  total: number;
  overdue: number;
  byStatus: Array<{ status: string; count: number }>;
};

type QueueFilter = "all" | "approval" | "overdue" | "due";

export function DepartmentDirectorDashboard({
  user,
  isAdmin = false,
  canManageUsers = isAdmin,
  canApprove,
  summary,
  actionSummary,
  correspondence,
  overdueItems,
  notifications,
  isLoading,
  errors,
  onPageChange,
  onSignOut,
}: {
  user: DirectorUser;
  isAdmin?: boolean;
  canManageUsers?: boolean;
  canApprove: boolean;
  summary?: DashboardSummary;
  actionSummary?: DirectorActionSummary;
  correspondence: CorrespondenceItem[];
  overdueItems: OverdueItem[];
  notifications: DirectorNotification[];
  isLoading: boolean;
  errors: string[];
  onPageChange: (page: DashboardPageName) => void;
  onSignOut: () => void;
}) {
  const [filter, setFilter] = React.useState<QueueFilter>("all");
  const [search, setSearch] = React.useState("");
  const totals = summary?.totals ?? {};
  const groups = summary?.groups;
  const overdueIds = React.useMemo(
    () => new Set(overdueItems.map((item) => item.id)),
    [overdueItems],
  );
  const filteredCorrespondence = correspondence.filter((item) => {
    const term = search.trim().toLowerCase();
    const matchesSearch =
      !term ||
      item.referenceNumber.toLowerCase().includes(term) ||
      item.subject.toLowerCase().includes(term) ||
      (isAdmin &&
        (item.department?.name ?? "")
          .toLowerCase()
          .includes(term));
    const isOpen = item.status !== "CLOSED" && item.status !== "ARCHIVED";
    const matchesFilter =
      filter === "all"
        ? isOpen
        : filter === "approval"
          ? isOpen && item.status === "PENDING_APPROVAL"
          : filter === "overdue"
            ? isOpen && overdueIds.has(item.id)
            : isOpen && isDueWithinWeek(item.dueDate);
    return matchesSearch && matchesFilter;
  });
  const pendingActions = (actionSummary?.byStatus ?? [])
    .filter(({ status }) => status !== "COMPLETED")
    .reduce((sum, item) => sum + item.count, 0);
  const workload = isAdmin
    ? (groups?.byDepartment ?? []).map((entry) => ({
        officerName: entry.department?.name ?? "Unassigned",
        count: entry.count,
      }))
    : (groups?.byOfficer ?? []);
  const ageBuckets = groups?.byAge ?? [];
  const maximumWorkload = Math.max(1, ...workload.map(({ count }) => count));
  const maximumAge = Math.max(1, ...ageBuckets.map(({ count }) => count));

  return (
    <DashboardLayout
      activePage="dashboard"
      onPageChange={onPageChange}
      onSignOut={onSignOut}
      title={
        isAdmin
          ? "Ministry administration"
          : user.department?.name ?? "Department dashboard"
      }
      departmentDashboard={!isAdmin}
      compactDashboard
      workspaceLabel={isAdmin ? "Ministry-wide workspace" : undefined}
      canManageUsers={canManageUsers}
    >
      <section className="space-y-4">
        <div className="flex flex-col justify-between gap-2 border-b border-slate-200 pb-3 sm:flex-row sm:items-end">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#2c74a8]">
              {isAdmin
                ? "Administration workspace · All departments"
                : `Department workspace${user.department ? ` · ${user.department.code}` : ""}`}
            </p>
            <h2 className="mt-0.5 text-xl font-semibold text-[#173653]">
              {isAdmin
                ? "Ministry correspondence overview"
                : user.department?.name ?? "Department not assigned"}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {isAdmin
                ? `Welcome, ${user.name}. Monitor ministry-wide correspondence and department workload.`
                : `Welcome, ${user.name}. Here is your department's current workload.`}
            </p>
          </div>
          <p className="text-xs text-slate-500">
            {new Intl.DateTimeFormat(undefined, {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            }).format(new Date())}
          </p>
        </div>

        {!isAdmin && !user.department ? (
          <div
            role="alert"
            className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
          >
            Your account has no department assigned. Ask an administrator to
            assign your department before using this dashboard.
          </div>
        ) : null}

        {errors.length > 0 ? (
          <div
            role="alert"
            className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900"
          >
            <p className="font-semibold">
              Some dashboard data could not be loaded.
            </p>
            <p className="mt-1">{errors.join(" ")}</p>
          </div>
        ) : null}

        {isLoading ? (
          <div
            className={`grid gap-3 sm:grid-cols-2 ${
              canApprove ? "xl:grid-cols-5" : "xl:grid-cols-4"
            }`}
          >
            {Array.from({ length: canApprove ? 5 : 4 }).map((_, index) => (
              <Skeleton key={index} className="h-24 rounded-md bg-white" />
            ))}
          </div>
        ) : null}

        <div
          className={`grid gap-3 sm:grid-cols-2 ${
            canApprove ? "xl:grid-cols-5" : "xl:grid-cols-4"
          }`}
        >
          {canApprove ? (
            <DirectorMetric
              label="Awaiting approval"
              value={totals.pendingApproval}
              hint="Items in your approval queue"
              icon={<ClipboardCheck className="h-4 w-4" />}
              tone="bg-[#eaf3fb] text-[#286c9f]"
              stripe="bg-[#2878b8]"
            />
          ) : null}
          <DirectorMetric
            label="Open files"
            value={totals.pending}
            hint="Not yet closed or archived"
            icon={<FolderOpen className="h-4 w-4" />}
            tone="bg-[#e8f5f2] text-[#16877f]"
            stripe="bg-[#1c9c91]"
          />
          <DirectorMetric
            label="Due this week"
            value={totals.dueThisWeek}
            hint="Active files due in the next 7 days"
            icon={<CalendarClock className="h-4 w-4" />}
            tone="bg-[#edf3f9] text-[#3976a5]"
            stripe="bg-[#548bb9]"
          />
          <DirectorMetric
            label="Overdue"
            value={totals.overdue}
            hint="Active files past their due date"
            icon={<CircleAlert className="h-4 w-4" />}
            tone="bg-[#fff4e7] text-[#d4862b]"
            stripe="bg-[#e39a3b]"
          />
          <DirectorMetric
            label="Closed this month"
            value={totals.closedThisMonth}
            hint={`Completed ${isAdmin ? "ministry" : "department"} files`}
            icon={<CheckCheck className="h-4 w-4" />}
            tone="bg-[#eaf5ed] text-[#35864d]"
            stripe="bg-[#4b9b5f]"
          />
        </div>

        <div className="grid items-start gap-3 xl:grid-cols-[minmax(0,1fr)_280px]">
          <div className="space-y-3">
            <Card className="min-w-0 rounded-md border-slate-200 shadow-none">
              <CardHeader className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-base text-[#173653]">
                    Work queue
                  </CardTitle>
                  <p className="mt-1 text-xs text-slate-500">
                    Review upcoming work and items that need attention.
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => onPageChange("correspondence")}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Register correspondence
                </Button>
              </CardHeader>
              <CardContent className="space-y-3 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        ["all", "All open"],
                        ...(canApprove
                          ? ([["approval", "Awaiting approval"]] as const)
                          : []),
                        ["overdue", "Overdue"],
                        ["due", "Due this week"],
                      ] as const
                    ).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={filter === value}
                        onClick={() => setFilter(value)}
                        className={`rounded-md px-3 py-1.5 text-[11px] font-medium transition-colors ${
                          filter === value
                            ? "bg-[#1e669d] text-white"
                            : "bg-[#edf2f7] text-slate-600 hover:bg-[#e3ebf3]"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <label className="relative block w-full lg:max-w-56">
                    <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <Input
                      className="pl-9"
                      aria-label={`Search ${isAdmin ? "ministry" : "department"} correspondence`}
                      placeholder="Search work queue"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                    />
                  </label>
                </div>

                {isLoading ? (
                  <div className="space-y-3">
                    {[0, 1, 2].map((item) => (
                      <Skeleton key={item} className="h-20 rounded-lg" />
                    ))}
                  </div>
                ) : filteredCorrespondence.length ? (
                  <div className="divide-y divide-slate-100">
                    {filteredCorrespondence.slice(0, 8).map((item) => (
                      <article
                        key={item.id}
                        className="grid gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-semibold text-slate-500">
                              {item.referenceNumber}
                            </span>
                            <Badge variant={statusVariant(item.status)}>
                              {humanize(item.status)}
                            </Badge>
                            {overdueIds.has(item.id) ? (
                              <Badge variant="warning">Overdue</Badge>
                            ) : null}
                          </div>
                          <h3 className="mt-1 truncate text-sm font-semibold text-slate-900">
                            {item.subject}
                          </h3>
                          <p className="mt-1 text-xs text-slate-500">
                            {isAdmin && item.department?.name
                              ? item.department.name
                              : item.assignedTo?.name
                                ? `Assigned to ${item.assignedTo.name}`
                                : "Unassigned"}
                            {item.dueDate
                              ? ` · Due ${new Date(item.dueDate).toLocaleDateString()}`
                              : " · No due date"}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="w-fit"
                          onClick={() => onPageChange("correspondence")}
                        >
                          Open file
                        </Button>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-md border border-dashed border-slate-200 px-4 py-8 text-center">
                    <FileText className="mx-auto h-6 w-6 text-slate-400" />
                    <p className="mt-2 text-sm font-medium text-slate-700">
                      No matching work items
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Try another filter or search term.
                    </p>
                  </div>
                )}
                {correspondence.length > 8 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-full"
                    onClick={() => onPageChange("correspondence")}
                  >
                    View all correspondence
                  </Button>
                ) : null}
              </CardContent>
            </Card>

            <div className="grid gap-3 lg:grid-cols-2">
              <DirectorBreakdown
                title={isAdmin ? "Open workload by department" : "Workload by officer"}
                emptyLabel={isAdmin ? "No department workload is available." : "No active assigned work."}
                rows={workload.map((entry) => ({
                  label: entry.officerName,
                  count: entry.count,
                }))}
                maximum={maximumWorkload}
                icon={<Users className="h-4 w-4 text-slate-400" />}
              />
              <DirectorBreakdown
                title="Age of open files"
                emptyLabel="No open files to age."
                rows={ageBuckets.map((entry) => ({
                  label: entry.range,
                  count: entry.count,
                }))}
                maximum={maximumAge}
                icon={<Clock3 className="h-4 w-4 text-slate-400" />}
              />
            </div>
          </div>

          <div className="space-y-3">
            <Card className="rounded-md border-slate-200 shadow-none">
              <CardHeader className="flex-row items-center justify-between space-y-0 p-4 pb-2">
                <CardTitle className="text-sm text-[#173653]">
                  Quick actions
                </CardTitle>
                <Activity className="h-4 w-4 text-slate-400" />
              </CardHeader>
              <CardContent className="space-y-2 p-4 pt-1">
                <QuickAction
                  icon={<Plus className="h-4 w-4" />}
                  label="Register correspondence"
                  onClick={() => onPageChange("correspondence")}
                />
                {canApprove ? (
                  <QuickAction
                    icon={<ClipboardCheck className="h-4 w-4" />}
                    label="Review approval queue"
                    onClick={() => {
                      setFilter("approval");
                      onPageChange("dashboard");
                    }}
                  />
                ) : null}
                <QuickAction
                  icon={<Clock3 className="h-4 w-4" />}
                  label="Open action tracker"
                  onClick={() => onPageChange("actions")}
                />
              </CardContent>
            </Card>

            <Card className="rounded-md border-slate-200 shadow-none">
              <CardHeader className="flex-row items-center justify-between space-y-0 p-4 pb-2">
                <CardTitle className="text-sm text-[#173653]">
                  Notifications
                </CardTitle>
                <Bell className="h-4 w-4 text-slate-400" />
              </CardHeader>
              <CardContent className="p-4 pt-1">
                {notifications.length ? (
                  <div className="space-y-3">
                    {notifications.slice(0, 4).map((notification) => (
                      <div
                        key={notification.id}
                        className="border-b border-slate-100 pb-3 last:border-0 last:pb-0"
                      >
                        <p className="text-xs leading-5 text-slate-700">
                          {notification.message}
                        </p>
                        <p className="mt-1 text-[11px] text-slate-400">
                          {new Date(notification.createdAt).toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">
                    No recent notifications.
                  </p>
                )}
              </CardContent>
            </Card>
            <Card className="rounded-md border-slate-200 shadow-none">
              <CardHeader className="flex-row items-center justify-between space-y-0 p-4 pb-2">
                <CardTitle className="text-sm text-[#173653]">
                  Recent activity
                </CardTitle>
                <FileText className="h-4 w-4 text-slate-400" />
              </CardHeader>
              <CardContent className="space-y-3 p-4 pt-1">
                {correspondence.slice(0, 4).map((item) => (
                  <div
                    key={item.id}
                    className="border-b border-slate-100 pb-2 last:border-0 last:pb-0"
                  >
                    <p className="truncate text-xs font-medium text-slate-700">
                      {item.subject}
                    </p>
                    <p className="mt-0.5 text-[10px] text-slate-500">
                      {item.referenceNumber} · {humanize(item.status)}
                    </p>
                  </div>
                ))}
                {!correspondence.length ? (
                  <p className="text-xs text-slate-500">
                    No recent activity yet.
                  </p>
                ) : null}
              </CardContent>
            </Card>
            <Card className="rounded-md border-slate-200 shadow-none">
              <CardHeader className="flex-row items-center justify-between space-y-0 p-4 pb-2">
                <CardTitle className="text-sm text-[#173653]">
                  Incoming and outgoing
                </CardTitle>
                <ArrowUpFromLine className="h-4 w-4 text-slate-400" />
              </CardHeader>
              <CardContent className="grid gap-4 p-4 pt-1 sm:grid-cols-2">
                <DirectionMetric
                  label="Incoming"
                  count={totals.incoming ?? 0}
                  total={totals.total ?? 0}
                  icon={<ArrowDownToLine className="h-4 w-4" />}
                  color="bg-sky-600"
                />
                <DirectionMetric
                  label="Outgoing"
                  count={totals.outgoing ?? 0}
                  total={totals.total ?? 0}
                  icon={<ArrowUpFromLine className="h-4 w-4" />}
                  color="bg-teal-600"
                />
                <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-sm">
                  <span className="flex items-center gap-2 text-slate-600">
                    <ShieldCheck className="h-4 w-4" />
                    Pending actions
                  </span>
                  <span className="font-semibold text-slate-900">
                    {pendingActions.toLocaleString()}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </DashboardLayout>
  );
}

function DirectorMetric({
  label,
  value,
  hint,
  icon,
  tone,
  stripe,
}: {
  label: string;
  value?: number;
  hint: string;
  icon: React.ReactNode;
  tone: string;
  stripe: string;
}) {
  return (
    <Card className="overflow-hidden rounded-md border-slate-200 shadow-none">
      <div className={`h-1 w-full ${stripe}`} />
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            {label}
          </p>
          <span className={`rounded-md p-1.5 ${tone}`}>{icon}</span>
        </div>
        <p className="mt-1 text-2xl font-semibold text-[#173653]">
          {typeof value === "number" ? value.toLocaleString() : "—"}
        </p>
        <p className="mt-0.5 text-[10px] text-slate-500">{hint}</p>
      </CardContent>
    </Card>
  );
}

function DirectorBreakdown({
  title,
  emptyLabel,
  rows,
  maximum,
  icon,
}: {
  title: string;
  emptyLabel: string;
  rows: Array<{ label: string; count: number }>;
  maximum: number;
  icon: React.ReactNode;
}) {
  return (
    <Card className="rounded-md border-slate-200 shadow-none">
      <CardHeader className="flex-row items-center justify-between space-y-0 p-4 pb-2">
        <CardTitle className="text-sm text-[#173653]">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent className="space-y-3 p-4 pt-1">
        {rows.length ? (
          rows.map((row) => (
            <div key={row.label}>
              <div className="mb-1 flex justify-between gap-3 text-xs">
                <span className="truncate text-slate-600">{row.label}</span>
                <span className="font-semibold text-slate-800">
                  {row.count}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-100">
                <div
                  className="h-1.5 rounded-full bg-[#2878b8]"
                  style={{
                    width: `${Math.max(3, (row.count / maximum) * 100)}%`,
                  }}
                />
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-slate-500">{emptyLabel}</p>
        )}
      </CardContent>
    </Card>
  );
}

function DirectionMetric({
  label,
  count,
  total,
  icon,
  color,
}: {
  label: string;
  count: number;
  total: number;
  icon: React.ReactNode;
  color: string;
}) {
  const width = total ? Math.min(100, (count / total) * 100) : 0;
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="flex items-center gap-2 text-slate-600">
          {icon}
          {label}
        </span>
        <span className="font-semibold text-slate-900">
          {count.toLocaleString()}
        </span>
      </div>
      <div className="h-2 rounded-full bg-slate-100">
        <div
          className={`h-2 rounded-full ${color}`}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

function QuickAction({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-md border border-slate-200 px-2.5 py-2 text-left text-xs font-medium text-slate-700 transition-colors hover:border-[#8bb7d8] hover:bg-[#f1f7fc]"
    >
      <span className="text-[#2878b8]">{icon}</span>
      {label}
    </button>
  );
}

function isDueWithinWeek(value?: string | null) {
  if (!value) return false;
  const date = new Date(value);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(today);
  end.setDate(end.getDate() + 7);
  return date >= today && date <= end;
}

function humanize(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function statusVariant(status: string) {
  if (status === "PENDING_APPROVAL") return "info";
  if (status === "CLOSED" || status === "APPROVED" || status === "DISPATCHED")
    return "success";
  if (status === "OPEN") return "secondary";
  return "warning";
}
