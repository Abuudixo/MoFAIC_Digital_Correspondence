import * as React from "react";
import { Archive } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Skeleton } from "./ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import {
  EmptyRow,
  formatDate,
  humanize,
  PageHeading,
  QueryError,
  RecordSummary,
} from "./workspace-shared";
import { RecordDetails } from "./record-details";

export function ArchivePage({ token }: { token: string }) {
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [pageNumber, setPageNumber] = React.useState(1);
  const records = useQuery({
    queryKey: ["archive-records", pageNumber],
    queryFn: async () =>
      api<{
        items: RecordSummary[];
        pagination: { page: number; total: number; totalPages: number };
      }>(
        `/correspondence?includeArchived=true&status=ARCHIVED&limit=20&page=${pageNumber}`,
      ),
    enabled: Boolean(token),
  });
  return (
    <section className="space-y-5">
      <PageHeading
        eyebrow="Records retention"
        title="Archive"
        description="Browse archived correspondence while preserving its record, workflow and document history."
      >
        <Archive className="h-5 w-5 text-slate-500" />
      </PageHeading>
      {records.isError ? <QueryError message={records.error.message} /> : null}
      <Card>
        <CardHeader>
          <CardTitle>Archived correspondence</CardTitle>
          <CardDescription>
            {records.data?.pagination.total ?? 0} archived records accessible to
            your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          {records.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Reference</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Classification</TableHead>
                    <TableHead>Archived on</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(records.data?.items ?? []).map((item) => (
                    <TableRow
                      key={item.id}
                      className="cursor-pointer"
                      onClick={() => setSelectedId(item.id)}
                    >
                      <TableCell className="font-medium">
                        {item.referenceNumber}
                      </TableCell>
                      <TableCell>{item.subject}</TableCell>
                      <TableCell>{item.department?.name ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {humanize(item.confidentiality)}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDate(item.archivedAt)}</TableCell>
                    </TableRow>
                  ))}
                  {!records.data?.items.length ? (
                    <EmptyRow
                      colSpan={5}
                      message="No accessible archived records."
                    />
                  ) : null}
                </TableBody>
              </Table>
            </div>
          )}
          <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
            <span>
              Page {records.data?.pagination.page ?? pageNumber} of{" "}
              {Math.max(1, records.data?.pagination.totalPages ?? 1)}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={pageNumber <= 1}
                onClick={() => setPageNumber((page) => page - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={
                  pageNumber >= (records.data?.pagination.totalPages ?? 1)
                }
                onClick={() => setPageNumber((page) => page + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      <RecordDetails
        id={selectedId}
        onClose={() => setSelectedId(null)}
        token={token}
        archived
      />
    </section>
  );
}
