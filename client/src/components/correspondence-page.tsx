import * as React from "react";
import { Plus, Search } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { Skeleton } from "./ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import {
  DueIndicator,
  EmptyRow,
  Field,
  formatDate,
  humanize,
  PageHeading,
  QueryError,
  RecordSummary,
  SelectField,
  StatusBadge,
  useReferenceData,
} from "./workspace-shared";
import { RecordDetails } from "./record-details";

export function CorrespondencePage({ token }: { token: string }) {
  const [search, setSearch] = React.useState("");
  const [direction, setDirection] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [departmentId, setDepartmentId] = React.useState("");
  const [dateFrom, setDateFrom] = React.useState("");
  const [dateTo, setDateTo] = React.useState("");
  const [pageNumber, setPageNumber] = React.useState(1);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [showRegistration, setShowRegistration] = React.useState(false);
  const [formError, setFormError] = React.useState("");
  const [isSaving, setIsSaving] = React.useState(false);
  const references = useReferenceData(token);
  const queryClient = useQueryClient();
  const correspondence = useQuery({
    queryKey: [
      "register",
      search,
      direction,
      status,
      departmentId,
      dateFrom,
      dateTo,
      pageNumber,
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(pageNumber),
        limit: "20",
      });
      if (search.trim()) params.set("search", search.trim());
      if (direction) params.set("direction", direction);
      if (status) params.set("status", status);
      if (departmentId) params.set("departmentId", departmentId);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      return api<{
        items: RecordSummary[];
        pagination: { page: number; total: number; totalPages: number };
      }>(`/correspondence?${params}`);
    },
  });

  const createRecord = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const attachment = data.get("attachment");
    if (
      attachment instanceof File &&
      attachment.name &&
      (attachment.size === 0 ||
        !attachment.name.toLowerCase().endsWith(".pdf") ||
        attachment.size > 10 * 1024 * 1024)
    ) {
      setFormError("Choose a PDF file no larger than 10 MB.");
      return;
    }
    const optionalDate = (key: string) => String(data.get(key) ?? "") || null;
    const payload = {
      direction: String(data.get("direction")),
      type: String(data.get("type")),
      subject: String(data.get("subject") ?? "").trim(),
      sender: String(data.get("sender") ?? "").trim(),
      recipient: String(data.get("recipient") ?? "").trim(),
      departmentId: String(data.get("departmentId")),
      organization: String(data.get("organization") ?? "").trim() || null,
      countryMission: String(data.get("countryMission") ?? "").trim() || null,
      documentNumber: String(data.get("documentNumber") ?? "").trim() || null,
      priority: String(data.get("priority")),
      confidentiality: String(data.get("confidentiality")),
      dateReceived: optionalDate("dateReceived"),
      dateSent: optionalDate("dateSent"),
      dueDate: optionalDate("dueDate"),
      currentActionLocation:
        String(data.get("currentActionLocation") ?? "").trim() || null,
      notes: String(data.get("notes") ?? "").trim() || null,
    };
    setIsSaving(true);
    setFormError("");
    try {
      const response = await api<{ correspondence: RecordSummary }>(
        "/correspondence",
        {
          method: "POST",
          body: JSON.stringify(payload),
        },
      );
      let attachmentError = "";
      if (attachment instanceof File && attachment.size > 0) {
        const document = new FormData();
        document.set("document", attachment);
        document.set("classification", payload.confidentiality);
        try {
          await api(`/correspondence/${response.correspondence.id}/documents`, {
            method: "POST",
            body: document,
          });
        } catch (error) {
          attachmentError =
            error instanceof Error
              ? `Correspondence was registered, but the PDF attachment failed: ${error.message}`
              : "Correspondence was registered, but the PDF attachment failed.";
        }
      }
      await queryClient.invalidateQueries({ queryKey: ["register"] });
      await queryClient.invalidateQueries({ queryKey: ["summary"] });
      setShowRegistration(false);
      setSelectedId(response.correspondence.id);
      setFormError(attachmentError);
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : "Could not register correspondence.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const departments = references.data?.departments ?? [];
  return (
    <section className="space-y-5">
      <PageHeading
        eyebrow="Records"
        title="Correspondence register"
        description="Search, review and register correspondence using the controlled values and fields configured by the Ministry."
      >
        <Button
          onClick={() => setShowRegistration(true)}
          disabled={!departments.length}
        >
          <Plus className="h-4 w-4" />
          Register correspondence
        </Button>
      </PageHeading>
      {formError && !showRegistration ? (
        <div role="alert" className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {formError}
        </div>
      ) : null}

      {references.isError ? (
        <QueryError message={references.error.message} />
      ) : null}
      {correspondence.isError ? (
        <QueryError message={correspondence.error.message} />
      ) : null}

      <Card>
        <CardHeader className="gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <CardTitle>Registered correspondence</CardTitle>
            <CardDescription>
              {correspondence.data?.pagination.total ?? 0} accessible records
            </CardDescription>
          </div>
          <div className="grid w-full gap-2 sm:grid-cols-2 lg:max-w-4xl lg:grid-cols-3 xl:grid-cols-5">
            <div className="relative sm:col-span-2 xl:col-span-2">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <Input
                className="pl-9"
                placeholder="Search reference, subject or parties"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPageNumber(1);
                }}
              />
            </div>
            <select
              aria-label="Filter by direction"
              className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
              value={direction}
              onChange={(event) => {
                setDirection(event.target.value);
                setPageNumber(1);
              }}
            >
              <option value="">All directions</option>
              {(references.data?.directions ?? []).map((value) => (
                <option key={value} value={value}>
                  {humanize(value)}
                </option>
              ))}
            </select>
            <select
              aria-label="Filter by status"
              className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPageNumber(1);
              }}
            >
              <option value="">All statuses</option>
              {(references.data?.statuses ?? []).map((value) => (
                <option key={value} value={value}>
                  {humanize(value)}
                </option>
              ))}
            </select>
            <select
              aria-label="Filter by responsible unit"
              className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
              value={departmentId}
              onChange={(event) => {
                setDepartmentId(event.target.value);
                setPageNumber(1);
              }}
            >
              <option value="">All responsible units</option>
              {(references.data?.departments ?? []).map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
            <Input
              aria-label="Registered from"
              title="Registered from"
              type="date"
              value={dateFrom}
              onChange={(event) => {
                setDateFrom(event.target.value);
                setPageNumber(1);
              }}
            />
            <Input
              aria-label="Registered to"
              title="Registered to"
              type="date"
              value={dateTo}
              onChange={(event) => {
                setDateTo(event.target.value);
                setPageNumber(1);
              }}
            />
          </div>
        </CardHeader>
        <CardContent>
          {correspondence.isLoading ? (
            <div className="space-y-3">
              {[0, 1, 2, 3].map((item) => (
                <Skeleton key={item} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Reference</TableHead>
                      <TableHead>Official document ref.</TableHead>
                      <TableHead>Subject / parties</TableHead>
                      <TableHead>Direction</TableHead>
                      <TableHead>Type / received</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead>Due / indicator</TableHead>
                      <TableHead>Closed</TableHead>
                      <TableHead>Classification</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(correspondence.data?.items ?? []).map((item) => (
                      <TableRow
                        key={item.id}
                        className="cursor-pointer"
                        onClick={() => setSelectedId(item.id)}
                      >
                        <TableCell className="font-medium text-slate-900">
                          {item.referenceNumber}
                        </TableCell>
                        <TableCell>{item.documentNumber || "—"}</TableCell>
                        <TableCell>
                          <div className="max-w-[320px] truncate font-medium text-slate-800">
                            {item.subject}
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            {item.sender} → {item.recipient}
                          </div>
                        </TableCell>
                        <TableCell>{humanize(item.direction)}</TableCell>
                        <TableCell>
                          <div>{humanize(item.type)}</div>
                          <div className="text-xs text-slate-500">
                            {formatDate(item.dateReceived)}
                          </div>
                        </TableCell>
                        <TableCell>{item.department?.name ?? "—"}</TableCell>
                        <TableCell>
                          <div>{formatDate(item.dueDate)}</div>
                          <DueIndicator value={item.dueStatus} />
                        </TableCell>
                        <TableCell>{formatDate(item.dateClosed)}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {humanize(item.confidentiality)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <StatusBadge value={item.status} />
                        </TableCell>
                      </TableRow>
                    ))}
                    {!correspondence.data?.items.length ? (
                      <EmptyRow
                        colSpan={10}
                        message="No correspondence is available for this search."
                      />
                    ) : null}
                  </TableBody>
                </Table>
              </div>
              <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
                <span>
                  Page {correspondence.data?.pagination.page ?? pageNumber} of{" "}
                  {Math.max(1, correspondence.data?.pagination.totalPages ?? 1)}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pageNumber <= 1}
                    onClick={() => setPageNumber((current) => current - 1)}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={
                      pageNumber >=
                      (correspondence.data?.pagination.totalPages ?? 1)
                    }
                    onClick={() => setPageNumber((current) => current + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={showRegistration} onOpenChange={setShowRegistration}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Register correspondence</DialogTitle>
            <DialogDescription>
              The official system reference is assigned automatically after
              saving.
            </DialogDescription>
          </DialogHeader>
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={createRecord}>
            {formError ? (
              <div className="sm:col-span-2">
                <QueryError message={formError} />
              </div>
            ) : null}
            <Field label="Subject" required className="sm:col-span-2">
              <Input name="subject" required maxLength={500} />
            </Field>
            <Field label="Direction" required>
              <SelectField
                name="direction"
                values={references.data?.directions ?? []}
              />
            </Field>
            <Field label="Document type" required>
              <SelectField
                name="type"
                values={references.data?.documentTypes ?? []}
              />
            </Field>
            <Field label="Sender" required>
              <Input name="sender" required maxLength={300} />
            </Field>
            <Field label="Recipient" required>
              <Input name="recipient" required maxLength={300} />
            </Field>
            <Field label="Responsible unit" required>
              <SelectField
                name="departmentId"
                items={departments.map((department) => ({
                  value: department.id,
                  label: department.name,
                }))}
              />
            </Field>
            <Field label="External document reference">
              <Input name="documentNumber" maxLength={100} />
            </Field>
            <Field label="Country / mission">
              <Input name="countryMission" maxLength={200} />
            </Field>
            <Field label="Organization">
              <Input name="organization" maxLength={300} />
            </Field>
            <Field label="Priority">
              <SelectField
                name="priority"
                values={references.data?.priorities ?? []}
              />
            </Field>
            <Field label="Classification">
              <SelectField
                name="confidentiality"
                values={references.data?.classifications ?? []}
              />
            </Field>
            <Field label="Date received / drafted">
              <Input name="dateReceived" type="date" />
            </Field>
            <Field label="Date sent (outgoing)">
              <Input name="dateSent" type="date" />
            </Field>
            <Field label="Due date">
              <Input name="dueDate" type="date" />
            </Field>
            <Field label="Current action / location">
              <Input name="currentActionLocation" maxLength={500} />
            </Field>
            <Field label="PDF attachment">
              <Input
                name="attachment"
                type="file"
                accept=".pdf,application/pdf"
              />
              <span className="mt-1 block text-xs font-normal text-slate-500">
                Optional. PDF only, up to 10 MB.
              </span>
            </Field>
            <Field label="Notes" className="sm:col-span-2">
              <textarea
                name="notes"
                rows={3}
                maxLength={4000}
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400"
              />
            </Field>
            <div className="flex justify-end gap-2 sm:col-span-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowRegistration(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? "Saving..." : "Save record"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <RecordDetails
        id={selectedId}
        onClose={() => setSelectedId(null)}
        token={token}
      />
    </section>
  );
}
