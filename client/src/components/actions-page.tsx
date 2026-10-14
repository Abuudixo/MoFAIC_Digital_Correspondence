import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import { Badge } from "./ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Skeleton } from "./ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import {
  ActionItem,
  EmptyRow,
  formatDate,
  humanize,
  PageHeading,
  priorityVariant,
  QueryError,
} from "./workspace-shared";

export function ActionsPage({ token }: { token: string }) {
  const queryClient = useQueryClient();
  const [actionError, setActionError] = React.useState("");
  const actions = useQuery({
    queryKey: ["actions"],
    queryFn: async () => api<{ items: ActionItem[] }>("/actions"),
    enabled: Boolean(token),
  });
  const setStatus = async (item: ActionItem, status: string) => {
    setActionError("");
    try {
      await api(`/action-items/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await queryClient.invalidateQueries({ queryKey: ["actions"] });
      await queryClient.invalidateQueries({ queryKey: ["actionSummary"] });
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Could not update action.",
      );
    }
  };
  return (
    <section className="space-y-5">
      <PageHeading
        eyebrow="Workflow"
        title="Action tracker"
        description="Follow assigned unit actions, deadlines and completion states."
      />
      {actionError ? <QueryError message={actionError} /> : null}
      {actions.isError ? <QueryError message={actions.error.message} /> : null}
      <Card>
        <CardHeader>
          <CardTitle>Assigned actions</CardTitle>
          <CardDescription>
            Action data is permission-filtered by the API.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {actions.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Action / record ID</TableHead>
                    <TableHead>Required action</TableHead>
                    <TableHead>Unit / assignee</TableHead>
                    <TableHead>Assigned</TableHead>
                    <TableHead>Due</TableHead>
                    <TableHead>Completed</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(actions.data?.items ?? []).map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <p className="font-medium">{item.id.slice(0, 8)}</p>
                        <p className="text-xs text-slate-500">
                          {item.correspondence.referenceNumber}
                        </p>
                      </TableCell>
                      <TableCell className="max-w-[320px] whitespace-normal">
                        {item.requiredAction}
                      </TableCell>
                      <TableCell>
                        <p>{item.department?.name ?? "—"}</p>
                        <p className="text-xs text-slate-500">
                          {item.assignedTo?.name ?? "Unassigned"}
                        </p>
                      </TableCell>
                      <TableCell>{formatDate(item.createdAt)}</TableCell>
                      <TableCell>{formatDate(item.dueDate)}</TableCell>
                      <TableCell>{formatDate(item.completionDate)}</TableCell>
                      <TableCell>
                        <Badge variant={priorityVariant(item.priority)}>
                          {humanize(item.priority)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <select
                          className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm"
                          value={item.status}
                          onChange={(event) =>
                            void setStatus(item, event.target.value)
                          }
                        >
                          <option value="OPEN">Open</option>
                          <option value="IN_PROGRESS">In progress</option>
                          <option value="COMPLETED">Completed</option>
                        </select>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!actions.data?.items.length ? (
                    <EmptyRow
                      colSpan={8}
                      message="No accessible action items."
                    />
                  ) : null}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
