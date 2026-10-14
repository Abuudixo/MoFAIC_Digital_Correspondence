import { useQuery } from "@tanstack/react-query";
import { api } from "../../api";
import { PageHeading } from "../workspace-shared";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";

type NotificationItem = {
  id: string;
  kind: string;
  message: string;
  createdAt: string;
};

export function NotificationsPage() {
  const notificationsQuery = useQuery({
    queryKey: ["notifications"],
    queryFn: async () =>
      (await api<{ items: NotificationItem[] }>("/notifications")).items,
  });

  return (
    <section className="space-y-5">
      <PageHeading
        eyebrow="Updates"
        title="Notifications"
        description="Recent correspondence updates visible to your account."
      />
      <Card>
        <CardHeader>
          <CardTitle>Recent notifications</CardTitle>
          <CardDescription>
            The latest {notificationsQuery.data?.length ?? 0} notifications
            available to you.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {notificationsQuery.isError ? (
            <p role="alert" className="text-sm text-rose-700">
              Could not load notifications:{" "}
              {notificationsQuery.error instanceof Error
                ? notificationsQuery.error.message
                : String(notificationsQuery.error)}
            </p>
          ) : notificationsQuery.isLoading ? (
            <p className="text-sm text-slate-500">Loading notifications...</p>
          ) : notificationsQuery.data?.length ? (
            <ul className="divide-y divide-slate-100">
              {notificationsQuery.data.map((notification) => (
                <li key={notification.id} className="py-4 first:pt-0 last:pb-0">
                  <p className="text-sm font-medium text-slate-800">
                    {notification.message}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {notification.kind.replaceAll("_", " ")} ·{" "}
                    {new Date(notification.createdAt).toLocaleString()}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">No recent notifications.</p>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
