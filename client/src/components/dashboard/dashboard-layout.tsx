import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Archive,
  BarChart3,
  Bell,
  CheckCircle2,
  ClipboardList,
  LogOut,
  Mail,
  UserRound,
  Users,
} from "lucide-react";
import { api } from "../../api";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import type { WorkspacePageName } from "../workspace-pages";

export type DashboardPageName =
  | "dashboard"
  | "profile"
  | "users"
  | "notifications"
  | WorkspacePageName;

export function DashboardLayout({
  activePage,
  onPageChange,
  onSignOut,
  children,
  title,
  departmentDashboard = false,
  compactDashboard = departmentDashboard,
  workspaceLabel,
  canManageUsers = false,
}: {
  activePage: DashboardPageName;
  onPageChange: (page: DashboardPageName) => void;
  onSignOut: () => void;
  children: React.ReactNode;
  title?: string;
  departmentDashboard?: boolean;
  compactDashboard?: boolean;
  workspaceLabel?: string;
  canManageUsers?: boolean;
}) {
  return (
    <div
      className={`min-h-screen ${
        compactDashboard ? "bg-[#f3f6fa]" : "bg-slate-100"
      }`}
    >
      <WorkspaceSidebar
        activePage={activePage}
        onPageChange={onPageChange}
        onSignOut={onSignOut}
        canManageUsers={canManageUsers}
      />
      <main
        className={`mx-auto min-h-screen px-4 py-5 sm:px-6 lg:ml-64 ${
          compactDashboard
            ? "max-w-[1680px] lg:px-7"
            : "max-w-7xl lg:px-8 lg:py-6"
        }`}
      >
        <DashboardHeader
          title={
            title ??
            (activePage === "profile"
              ? "Personal profile"
              : activePage === "users"
                ? "User management"
                : activePage === "notifications"
                  ? "Notifications"
                : "Digital Correspondence")
          }
          compactDashboard={compactDashboard}
          workspaceLabel={workspaceLabel}
          onPageChange={onPageChange}
        />
        {children}
      </main>
    </div>
  );
}

function WorkspaceSidebar({
  activePage,
  onPageChange,
  onSignOut,
  canManageUsers,
}: {
  activePage: DashboardPageName;
  onPageChange: (page: DashboardPageName) => void;
  onSignOut: () => void;
  canManageUsers: boolean;
}) {
  const links = [
    { id: "dashboard", label: "Dashboard", icon: ClipboardList },
    { id: "correspondence", label: "Correspondence", icon: Mail },
    { id: "actions", label: "Action tracker", icon: CheckCircle2 },
    { id: "archive", label: "Archive", icon: Archive },
    { id: "reports", label: "Reports & analytics", icon: BarChart3 },
    { id: "notifications", label: "Notifications", icon: Bell },
    ...(canManageUsers
      ? [{ id: "users" as const, label: "Users", icon: Users }]
      : []),
  ] as const;

  return (
    <aside className="border-b border-[#0b2037] bg-[#102b49] text-white lg:fixed lg:inset-y-0 lg:left-0 lg:z-20 lg:flex lg:w-64 lg:flex-col lg:border-b-0 lg:border-r">
      <div className="flex items-center gap-3 px-5 py-5">
        <img
          src="/mofaic-logo.jpg"
          alt="Ministry of Foreign Affairs and International Cooperation, Federal Republic of Somalia"
          className="h-12 w-12 shrink-0 rounded-full bg-white object-cover shadow-sm"
        />
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            MOFAIC · WORKSPACE
          </p>
          <p className="text-sm font-semibold text-white">
            Digital Correspondence
          </p>
        </div>
      </div>
      <nav
        className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-1 lg:flex-col lg:gap-1 lg:overflow-y-auto lg:px-3 lg:py-5"
        aria-label="Workspace"
      >
        <p className="hidden px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 lg:block">
          NAVIGATION
        </p>
        {links.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => onPageChange(id)}
            aria-current={activePage === id ? "page" : undefined}
            className={`flex shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors lg:w-full ${
              activePage === id
                ? "bg-[#216ca5] text-white shadow-sm"
                : "text-slate-300 hover:bg-white/10 hover:text-white"
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </button>
        ))}
      </nav>
      <div className="flex flex-col gap-3 border-t border-white/10 px-4 py-4 sm:flex-row sm:items-center sm:justify-between lg:mt-auto lg:flex-col lg:items-stretch lg:gap-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => onPageChange("profile")}
          aria-current={activePage === "profile" ? "page" : undefined}
          className={`shrink-0 border-white/20 bg-transparent text-slate-200 hover:bg-white/10 hover:text-white sm:w-auto lg:w-full lg:justify-start ${
            activePage === "profile" ? "bg-white/10 text-white" : ""
          }`}
        >
          <UserRound className="mr-2 h-4 w-4" />
          Personal profile
        </Button>
        <Button
          variant="outline"
          onClick={onSignOut}
          className="shrink-0 border-white/20 bg-transparent text-slate-200 hover:bg-white/10 hover:text-white sm:w-auto lg:w-full lg:justify-start"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Log out
        </Button>
      </div>
    </aside>
  );
}

function DashboardHeader({
  title,
  compactDashboard,
  workspaceLabel,
  onPageChange,
}: {
  title: string;
  compactDashboard: boolean;
  workspaceLabel?: string;
  onPageChange: (page: DashboardPageName) => void;
}) {
  const notificationsQuery = useQuery({
    queryKey: ["notifications"],
    queryFn: async () =>
      (
        await api<{
          items: Array<{
            id: string;
            message: string;
            kind: string;
            readAt: string | null;
            createdAt: string;
          }>;
        }>("/notifications")
      ).items,
  });
  const unreadCount =
    notificationsQuery.data?.filter((notification) => !notification.readAt)
      .length ?? 0;

  return (
    <header
      className={`mb-5 flex flex-col justify-between gap-3 border border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center ${
        compactDashboard ? "rounded-md shadow-none" : "rounded-xl shadow-sm"
      }`}
    >
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
          {compactDashboard
            ? "MOFAIC · DIGITAL CORRESPONDENCE"
            : "Ministry dashboard"}
        </p>
        {!compactDashboard ? (
          <h1 className="mt-0.5 text-lg font-semibold text-[#173653]">
            {title}
          </h1>
        ) : null}
      </div>
      <div className="flex items-center justify-between gap-3 sm:justify-end">
        {compactDashboard ? (
          <span className="text-xs font-medium text-slate-500">
            {workspaceLabel ?? "Department workspace"}
          </span>
        ) : null}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="relative shrink-0 border-slate-200 text-slate-600"
              aria-label={
                unreadCount
                  ? `Notifications, ${unreadCount} unread`
                  : "Notifications"
              }
            >
              <Bell className="h-4 w-4" />
              {unreadCount ? (
                <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-semibold leading-none text-white">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              ) : null}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 p-0">
            <div className="border-b border-slate-100 px-4 py-3">
              <p className="text-sm font-semibold text-slate-900">
                Notifications
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                {unreadCount
                  ? `${unreadCount} unread`
                  : "You're all caught up"}
              </p>
            </div>
            {notificationsQuery.isError ? (
              <p role="alert" className="px-4 py-3 text-sm text-rose-700">
                Could not load notifications.
              </p>
            ) : notificationsQuery.isLoading ? (
              <p className="px-4 py-3 text-sm text-slate-500">
                Loading notifications...
              </p>
            ) : notificationsQuery.data?.length ? (
              <div className="max-h-80 overflow-y-auto py-1">
                {notificationsQuery.data.slice(0, 5).map((notification) => (
                  <DropdownMenuItem
                    key={notification.id}
                    onSelect={() => onPageChange("notifications")}
                    className="block cursor-pointer whitespace-normal px-4 py-3"
                  >
                    <span className="flex items-start gap-2">
                      <span
                        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                          notification.readAt ? "bg-slate-200" : "bg-sky-600"
                        }`}
                      />
                      <span className="min-w-0">
                        <span className="block text-sm leading-5 text-slate-800">
                          {notification.message}
                        </span>
                        <span className="mt-1 block text-xs text-slate-500">
                          {new Date(notification.createdAt).toLocaleString()}
                        </span>
                      </span>
                    </span>
                  </DropdownMenuItem>
                ))}
              </div>
            ) : (
              <p className="px-4 py-3 text-sm text-slate-500">
                No recent notifications.
              </p>
            )}
            <div className="border-t border-slate-100 p-1">
              <DropdownMenuItem
                onSelect={() => onPageChange("notifications")}
                className="justify-center font-medium text-sky-700"
              >
                View all notifications
              </DropdownMenuItem>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
