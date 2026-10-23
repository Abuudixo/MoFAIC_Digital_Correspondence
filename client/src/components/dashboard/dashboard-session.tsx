import * as React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Layers3,
  ShieldCheck,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  api,
  getAccessToken,
  setAccessToken,
  unauthorizedEvent,
} from "../../api";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Input } from "../ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Skeleton } from "../ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { WorkspacePage } from "../workspace-pages";
import { LoginScreen } from "../auth/login-screen";
import {
  KpiCard,
  MiniStat,
  formatStatus,
  badgeVariant,
  statusPieData,
} from "./dashboard-widgets";
import { DashboardLayout, type DashboardPageName } from "./dashboard-layout";
import { PersonalProfile } from "./personal-profile";
import { DepartmentDirectorDashboard } from "./department-director-dashboard";
import { UsersPage } from "./users-page";
import { NotificationsPage } from "./notifications-page";
import { RecordDetails } from "../record-details";

export type DashboardSummary = {
  totals: Record<string, number>;
  groups: {
    byDepartment: Array<{
      department?: { id?: string; name?: string; code?: string };
      count: number;
    }>;
    byClassification: Array<{ classification: string; count: number }>;
    byMonth: Array<{ month: string; volume: number }>;
    byOfficer?: Array<{
      officerId: string | null;
      officerName: string;
      count: number;
    }>;
    byAge?: Array<{ range: string; count: number }>;
  };
};

export type OverdueItem = {
  id: string;
  referenceNumber: string;
  dueDate?: string | null;
  status: string;
};

export type CorrespondenceItem = {
  id: string;
  referenceNumber: string;
  subject: string;
  departmentId: string;
  department?: { id?: string; name?: string; code?: string };
  status: string;
  dueDate?: string | null;
  priority?: string;
  dateClosed?: string | null;
  assignedTo?: { id: string; name: string } | null;
};

const dashboardPagePaths: Record<DashboardPageName, string> = {
  dashboard: "/",
  profile: "/profile",
  users: "/users",
  notifications: "/notifications",
  correspondence: "/correspondence",
  actions: "/actions",
  archive: "/archive",
  reports: "/reports",
};

function pageForPath(pathname: string): DashboardPageName {
  switch (pathname) {
    case "/profile":
      return "profile";
    case "/users":
      return "users";
    case "/notifications":
      return "notifications";
    case "/correspondence":
      return "correspondence";
    case "/actions":
      return "actions";
    case "/archive":
      return "archive";
    case "/reports":
      return "reports";
    default:
      return "dashboard";
  }
}

export function DashboardPage() {
  const queryClient = useQueryClient();
  const [token, setTokenState] = React.useState<string | null>(() =>
    getAccessToken(),
  );
  const [authMessage, setAuthMessage] = React.useState("");

  const handleAuthChange = (nextToken: string | null) => {
    setAccessToken(nextToken);
    setTokenState(nextToken);
    if (nextToken) setAuthMessage("");
    else queryClient.clear();
  };

  React.useEffect(() => {
    const handleUnauthorized = () => {
      queryClient.clear();
      setAuthMessage("Your session expired. Please sign in again.");
      setTokenState(null);
    };
    window.addEventListener(unauthorizedEvent, handleUnauthorized);
    return () =>
      window.removeEventListener(unauthorizedEvent, handleUnauthorized);
  }, [queryClient]);

  if (!token) {
    return (
      <LoginScreen message={authMessage} onSignedIn={handleAuthChange} />
    );
  }

  return (
    <DashboardSession token={token} onSignOut={() => handleAuthChange(null)} />
  );
}

export function DashboardSession({
  token,
  onSignOut,
}: {
  token: string;
  onSignOut: () => void;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const activePage = pageForPath(location.pathname);
  const setActivePage = React.useCallback(
    (page: DashboardPageName) => navigate(dashboardPagePaths[page]),
    [navigate],
  );
  const meQuery = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const response = await api<{
        user: {
          name: string;
          email: string;
          isActive: boolean;
          role: { name: string };
          department: { id: string; name: string; code: string } | null;
          createdAt: string;
          permissions: string[];
        };
      }>("/auth/me");
      return response.user;
    },
    enabled: Boolean(token),
  });
  const isDepartmentDashboardUser = ["DEPARTMENT_HEAD", "STAFF"].includes(
    meQuery.data?.role.name ?? "",
  );
  const isDepartmentHead = meQuery.data?.role.name === "DEPARTMENT_HEAD";
  const isAdmin = meQuery.data?.role.name === "ADMIN";
  const canManageUsers = isAdmin;
  const canApprove =
    meQuery.data?.permissions.includes("correspondence:approve") ?? false;
  const departmentId = isDepartmentDashboardUser
    ? meQuery.data?.department?.id
    : undefined;
  const departmentQuery = departmentId
    ? `&departmentId=${encodeURIComponent(departmentId)}`
    : "";
  const departmentDashboardQuery =
    isDepartmentHead && departmentId
      ? "&departmentDashboard=true"
      : "";
  const scopedQueriesEnabled = Boolean(
    token && meQuery.isSuccess && (!isDepartmentDashboardUser || departmentId),
  );

  const summaryQuery = useQuery({
    queryKey: ["summary", isDepartmentDashboardUser ? departmentId : "all"],
    queryFn: async () => {
      const response = await api<{ report: DashboardSummary }>(
        `/reports/summary?includeArchived=false${departmentQuery}${departmentDashboardQuery}`,
      );
      return response.report;
    },
    enabled: scopedQueriesEnabled,
  });

  const actionQuery = useQuery({
    queryKey: [
      "actionSummary",
      isDepartmentDashboardUser ? departmentId : "all",
    ],
    queryFn: async () => {
      const response = await api<{
        report: {
          total: number;
          overdue: number;
          byStatus: Array<{ status: string; count: number }>;
        };
      }>(
        `/actions/report${departmentId ? `?departmentId=${encodeURIComponent(departmentId)}` : ""}`,
      );
      return response.report;
    },
    enabled: scopedQueriesEnabled,
  });

  const overdueQuery = useQuery({
    queryKey: ["overdue", isDepartmentDashboardUser ? departmentId : "all"],
    queryFn: async () => {
      const response = await api<{ items: OverdueItem[] }>(
        `/reports/overdue${departmentId ? `?departmentId=${encodeURIComponent(departmentId)}` : ""}`,
      );
      return response.items;
    },
    enabled: scopedQueriesEnabled,
  });

  const correspondenceQuery = useQuery({
    queryKey: [
      "correspondence",
      isDepartmentDashboardUser ? departmentId : "all",
    ],
    queryFn: async () => {
      const response = await api<{ items: CorrespondenceItem[] }>(
        `/correspondence?limit=100&sortBy=dueDate&sortOrder=asc${departmentQuery}`,
      );
      return response.items;
    },
    enabled: scopedQueriesEnabled,
  });
  const notificationQuery = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const response = await api<{
        items: Array<{
          id: string;
          kind: string;
          message: string;
          createdAt: string;
        }>;
      }>("/notifications");
      return response.items;
    },
    enabled: Boolean(token && (isDepartmentDashboardUser || isAdmin)),
  });
  const canReadArchive =
    meQuery.data?.permissions.includes("correspondence:read:archive") ?? false;
  const archiveSummaryQuery = useQuery({
    queryKey: [
      "archived-summary",
      isDepartmentDashboardUser ? departmentId : "all",
    ],
    queryFn: async () => {
      const response = await api<{ report: DashboardSummary }>(
        `/reports/summary?includeArchived=true${departmentQuery}`,
      );
      return response.report;
    },
    enabled: Boolean(
      scopedQueriesEnabled && canReadArchive && !isDepartmentDashboardUser,
    ),
  });

  const [filter, setFilter] = React.useState<"all" | "overdue" | "pending">(
    "all",
  );
  const [search, setSearch] = React.useState("");
  const [selectedCorrespondenceId, setSelectedCorrespondenceId] =
    React.useState<string | null>(null);

  const summary = summaryQuery.data;
  const totals = summary?.totals ?? {};
  const totalVolume = Number(totals.total ?? 0);
  const pendingVolume = Number(totals.pending ?? 0);
  const overdueVolume = Number(totals.overdue ?? 0);
  const closedVolume = Number(totals.closed ?? 0);
  const pendingActionCount = (actionQuery.data?.byStatus ?? [])
    .filter((entry) => entry.status !== "COMPLETED")
    .reduce((total, entry) => total + entry.count, 0);

  const monthlyData = summary?.groups.byMonth ?? [];
  const departmentData = summary?.groups.byDepartment ?? [];
  const classificationData = summary?.groups.byClassification ?? [];

  const rows = React.useMemo<CorrespondenceItem[]>(() => {
    const items = correspondenceQuery.data ?? [];
    const overdueItems = overdueQuery.data ?? [];
    const list = [...items];

    for (const overdue of overdueItems) {
      if (!list.some((item) => item.id === overdue.id)) {
        list.push({
          id: overdue.id,
          referenceNumber: overdue.referenceNumber,
          subject: "Past due correspondence",
          departmentId: "",
          status: overdue.status,
          dueDate: overdue.dueDate,
          priority: "MEDIUM",
        });
      }
    }

    return list.filter((item) => {
      const matchesSearch =
        search.trim().length === 0 ||
        item.referenceNumber
          .toLowerCase()
          .includes(search.trim().toLowerCase()) ||
        item.subject.toLowerCase().includes(search.trim().toLowerCase());

      const matchesFilter =
        filter === "all" ||
        (filter === "overdue" &&
          overdueItems.some((overdue) => overdue.id === item.id)) ||
        (filter === "pending" &&
          ["OPEN", "IN_PROGRESS", "PENDING_APPROVAL"].includes(item.status));

      return matchesSearch && matchesFilter;
    });
  }, [correspondenceQuery.data, overdueQuery.data, filter, search]);

  const isLoading =
    summaryQuery.isLoading ||
    actionQuery.isLoading ||
    overdueQuery.isLoading ||
    correspondenceQuery.isLoading ||
    meQuery.isLoading ||
    (canReadArchive &&
      !isDepartmentDashboardUser &&
      archiveSummaryQuery.isLoading);

  const pieData = statusPieData({
    ...totals,
    ...(archiveSummaryQuery.data
      ? { archived: archiveSummaryQuery.data.totals.archived }
      : {}),
  });
  const dashboardErrors = [
    summaryQuery,
    actionQuery,
    overdueQuery,
    correspondenceQuery,
    meQuery,
    ...(canReadArchive && !isDepartmentDashboardUser
      ? [archiveSummaryQuery]
      : []),
    ...(isDepartmentDashboardUser ? [notificationQuery] : []),
    ...(isAdmin ? [notificationQuery] : []),
  ]
    .filter((query) => query.isError)
    .map((query) =>
      query.error instanceof Error ? query.error.message : String(query.error),
    );
  if (
    (isDepartmentDashboardUser || isAdmin) &&
    activePage === "dashboard" &&
    meQuery.data
  ) {
    return (
      <>
        <DepartmentDirectorDashboard
          user={meQuery.data}
          isAdmin={isAdmin}
          canManageUsers={canManageUsers}
          canApprove={canApprove}
          summary={summary}
          actionSummary={actionQuery.data}
          correspondence={correspondenceQuery.data ?? []}
          overdueItems={overdueQuery.data ?? []}
          notifications={notificationQuery.data ?? []}
          isLoading={isLoading}
          errors={dashboardErrors}
          onPageChange={setActivePage}
          onOpenCorrespondence={setSelectedCorrespondenceId}
          onSignOut={onSignOut}
        />
        <RecordDetails
          id={selectedCorrespondenceId}
          onClose={() => setSelectedCorrespondenceId(null)}
          token={token}
        />
      </>
    );
  }
  return (
    <DashboardLayout
      activePage={activePage}
      onPageChange={setActivePage}
      onSignOut={onSignOut}
      canManageUsers={canManageUsers}
    >
      {activePage === "dashboard" ? (
        <>
          {summaryQuery.isError ||
          actionQuery.isError ||
          overdueQuery.isError ||
          correspondenceQuery.isError ||
          meQuery.isError ||
          (canReadArchive && archiveSummaryQuery.isError) ? (
            <Alert className="mb-6 border-rose-200 bg-rose-50 text-rose-900">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Data load issue</AlertTitle>
              <AlertDescription>{dashboardErrors.join(" ")}</AlertDescription>
            </Alert>
          ) : null}

          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton
                  key={index}
                  className="h-28 rounded-xl border border-slate-200 bg-white"
                />
              ))}
            </div>
          ) : (
            <>
              <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <KpiCard
                  label="Total"
                  value={totalVolume.toLocaleString()}
                  description="All correspondence"
                  accent="bg-sky-600"
                  icon={<ClipboardList className="h-5 w-5" />}
                />
                <KpiCard
                  label="Pending"
                  value={pendingVolume.toLocaleString()}
                  description="Open or in progress"
                  accent="bg-emerald-600"
                  icon={<Activity className="h-5 w-5" />}
                />
                <KpiCard
                  label="Overdue"
                  value={overdueVolume.toLocaleString()}
                  description="Past due items"
                  accent="bg-amber-600"
                  icon={<CalendarClock className="h-5 w-5" />}
                />
                <KpiCard
                  label="Closed"
                  value={closedVolume.toLocaleString()}
                  description="Completed records"
                  accent="bg-slate-700"
                  icon={<CheckCircle2 className="h-5 w-5" />}
                />
              </div>

              <div className="grid gap-6 xl:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Correspondence volume</CardTitle>
                    <CardDescription>
                      Monthly trend based on the PostgreSQL summary dataset
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={monthlyData}>
                          <defs>
                            <linearGradient
                              id="volumeFill"
                              x1="0"
                              x2="0"
                              y1="0"
                              y2="1"
                            >
                              <stop
                                offset="5%"
                                stopColor="#1d4f68"
                                stopOpacity={0.38}
                              />
                              <stop
                                offset="95%"
                                stopColor="#1d4f68"
                                stopOpacity={0.04}
                              />
                            </linearGradient>
                          </defs>
                          <CartesianGrid
                            strokeDasharray="3 3"
                            vertical={false}
                            stroke="#e2e8f0"
                          />
                          <XAxis
                            dataKey="month"
                            tickFormatter={(value) => value.slice(5)}
                            tick={{ fontSize: 11 }}
                          />
                          <YAxis
                            allowDecimals={false}
                            tick={{ fontSize: 11 }}
                          />
                          <Tooltip
                            formatter={(value: number) =>
                              Number(value).toLocaleString()
                            }
                          />
                          <Area
                            type="monotone"
                            dataKey="volume"
                            stroke="#1d4f68"
                            fill="url(#volumeFill)"
                            strokeWidth={3}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Status distribution</CardTitle>
                    <CardDescription>
                      Workflow stages across the live correspondence records
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={pieData}
                            dataKey="value"
                            nameKey="name"
                            innerRadius={54}
                            outerRadius={82}
                            paddingAngle={2}
                          >
                            {pieData.map((entry) => (
                              <Cell key={entry.name} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(value: number) =>
                              Number(value).toLocaleString()
                            }
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">
                      Dashboard analytics
                    </h2>
                    <p className="text-sm text-slate-500">
                      Department, action and archive indicators
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Layers3 className="mr-2 h-4 w-4" />
                          Quick actions
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem
                          onSelect={() => setActivePage("archive")}
                        >
                          Open archive review
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() => setActivePage("actions")}
                        >
                          View overdue actions
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() => {
                            setFilter("overdue");
                            setActivePage("dashboard");
                          }}
                        >
                          Show overdue correspondence
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                <Tabs defaultValue="overview" className="w-full">
                  <TabsList className="mb-4">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="analytics">Analytics</TabsTrigger>
                  </TabsList>

                  <TabsContent value="overview">
                    <div className="grid gap-6 lg:grid-cols-2">
                      <Card className="border-slate-200">
                        <CardHeader>
                          <CardTitle>Department workload</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={departmentData.slice(0, 7)}>
                                <CartesianGrid
                                  vertical={false}
                                  strokeDasharray="3 3"
                                  stroke="#e2e8f0"
                                />
                                <XAxis
                                  dataKey="department.name"
                                  tick={{ fontSize: 10 }}
                                />
                                <YAxis
                                  allowDecimals={false}
                                  tick={{ fontSize: 11 }}
                                />
                                <Tooltip
                                  formatter={(value: number) =>
                                    Number(value).toLocaleString()
                                  }
                                />
                                <Bar
                                  dataKey="count"
                                  radius={[6, 6, 0, 0]}
                                  fill="#1d4f68"
                                />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="border-slate-200">
                        <CardHeader>
                          <CardTitle>Classification mix</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-4">
                            {classificationData.slice(0, 5).map((entry) => {
                              const total =
                                classificationData.reduce(
                                  (sum, item) => sum + item.count,
                                  0,
                                ) || 1;
                              const percent = Math.round(
                                (entry.count / total) * 100,
                              );
                              return (
                                <div key={entry.classification}>
                                  <div className="mb-1 flex items-center justify-between text-xs text-slate-600">
                                    <span>{entry.classification}</span>
                                    <span>{percent}%</span>
                                  </div>
                                  <div className="h-2.5 rounded-full bg-slate-100">
                                    <div
                                      className="h-2.5 rounded-full bg-indigo-600"
                                      style={{ width: `${percent}%` }}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </TabsContent>

                  <TabsContent value="analytics">
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                      <MiniStat
                        label="Incoming"
                        value={Number(totals.incoming ?? 0).toLocaleString()}
                        icon={<ArrowRight className="h-4 w-4" />}
                      />
                      <MiniStat
                        label="Outgoing"
                        value={Number(totals.outgoing ?? 0).toLocaleString()}
                        icon={<TrendingUp className="h-4 w-4" />}
                      />
                      {canReadArchive && archiveSummaryQuery.data ? (
                        <MiniStat
                          label="Archived"
                          value={Number(
                            archiveSummaryQuery.data?.totals.archived ?? 0,
                          ).toLocaleString()}
                          icon={<ShieldCheck className="h-4 w-4" />}
                        />
                      ) : null}
                      <MiniStat
                        label="Pending actions"
                        value={pendingActionCount.toLocaleString()}
                        icon={<Users className="h-4 w-4" />}
                      />
                    </div>
                  </TabsContent>
                </Tabs>
              </div>

              <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">
                      Overdue / pending correspondence
                    </h2>
                    <p className="text-sm text-slate-500">
                      Operational backlog driven by the backend reports
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      className="w-full sm:w-56"
                      placeholder="Search records"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                    />
                    <Select
                      value={filter}
                      onValueChange={(value: string) =>
                        setFilter(value as "all" | "overdue" | "pending")
                      }
                    >
                      <SelectTrigger className="w-36">
                        <SelectValue placeholder="Filter" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="overdue">Overdue</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Reference</TableHead>
                        <TableHead>Subject</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead>Due</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={6}
                            className="text-center text-sm text-slate-500"
                          >
                            No matching correspondence found.
                          </TableCell>
                        </TableRow>
                      ) : (
                        rows.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell className="font-medium text-slate-900">
                              {row.referenceNumber}
                            </TableCell>
                            <TableCell>{row.subject}</TableCell>
                            <TableCell>
                              {row.department?.name ?? row.departmentId ?? "�"}
                            </TableCell>
                            <TableCell>
                              {row.dueDate
                                ? new Date(row.dueDate).toLocaleDateString()
                                : "—"}
                            </TableCell>
                            <TableCell>
                              <Badge variant={badgeVariant(row.status)}>
                                {formatStatus(row.status)}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button variant="outline" size="sm">
                                    Open
                                  </Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>
                                      {row.referenceNumber}
                                    </DialogTitle>
                                    <DialogDescription>
                                      {row.subject}
                                    </DialogDescription>
                                  </DialogHeader>
                                  <div className="space-y-2 text-sm text-slate-600">
                                    <p>
                                      <span className="font-medium text-slate-900">
                                        Status:
                                      </span>{" "}
                                      {formatStatus(row.status)}
                                    </p>
                                    <p>
                                      <span className="font-medium text-slate-900">
                                        Department:
                                      </span>{" "}
                                      {row.department?.name ??
                                        row.departmentId ??
                                        "—"}
                                    </p>
                                    <p>
                                      <span className="font-medium text-slate-900">
                                        Due date:
                                      </span>{" "}
                                      {row.dueDate
                                        ? new Date(
                                            row.dueDate,
                                          ).toLocaleDateString()
                                        : "—"}
                                    </p>
                                  </div>
                                </DialogContent>
                              </Dialog>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </>
          )}
        </>
      ) : activePage === "profile" ? (
        meQuery.isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : meQuery.isError ? (
          <Alert className="border-rose-200 bg-rose-50 text-rose-900">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Profile load issue</AlertTitle>
            <AlertDescription>
              {meQuery.error instanceof Error
                ? meQuery.error.message
                : "Could not load your profile."}
            </AlertDescription>
          </Alert>
        ) : meQuery.data ? (
          <PersonalProfile user={meQuery.data} />
        ) : null
      ) : activePage === "users" ? (
        canManageUsers && meQuery.data ? (
          <UsersPage
            isAdmin={isAdmin}
            department={meQuery.data.department}
          />
        ) : null
      ) : activePage === "notifications" ? (
        <NotificationsPage />
      ) : (
        <WorkspacePage page={activePage} token={token} />
      )}
    </DashboardLayout>
  );
}
