import * as React from "react";
import { ArrowDownToLine, FilePlus2 } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, downloadFile } from "../api";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { Skeleton } from "./ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import {
  RecordDetail,
  useReferenceData,
  Detail,
  QueryError,
  StatusBadge,
  humanize,
  formatDate,
} from "./workspace-shared";
import { ActionAssignmentForm, WorkflowControls } from "./workflow-components";

export function RecordDetails({
  id,
  onClose,
  token,
  archived = false,
}: {
  id: string | null;
  onClose: () => void;
  token: string;
  archived?: boolean;
}) {
  const queryClient = useQueryClient();
  const references = useReferenceData(token);
  const currentUser = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const response = await api<{
        user: { permissions: string[] };
      }>("/auth/me");
      return response.user;
    },
    enabled: Boolean(token),
  });
  const canApprove =
    currentUser.data?.permissions.includes("correspondence:approve") ?? false;
  const [uploadError, setUploadError] = React.useState("");
  const [downloadError, setDownloadError] = React.useState("");
  const [isUploading, setIsUploading] = React.useState(false);
  const detail = useQuery({
    queryKey: ["record-detail", id],
    queryFn: async () => {
      const endpoint = archived
        ? `/correspondence/archive/${id}`
        : `/correspondence/${id}`;
      const response = await api<{ correspondence: RecordDetail }>(endpoint);
      return response.correspondence;
    },
    enabled: Boolean(id && token),
  });
  const history = useQuery({
    queryKey: ["record-workflow", id],
    queryFn: async () =>
      api<{ items: RecordDetail["workflows"] }>(
        `/correspondence/${id}/workflow`,
      ),
    enabled: Boolean(id && token),
  });
  const documents = useQuery({
    queryKey: ["record-documents", id],
    queryFn: async () =>
      api<{ items: NonNullable<RecordDetail["documents"]> }>(
        `/correspondence/${id}/documents`,
      ),
    enabled: Boolean(id && token),
  });

  const upload = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!id) return;
    const form = event.currentTarget;
    const file = new FormData(form).get("document");
    if (!(file instanceof File) || file.size === 0) return;
    const body = new FormData();
    body.set("document", file);
    const formData = new FormData(form);
    body.set("classification", String(formData.get("classification")));
    const actionId = String(formData.get("actionId") ?? "");
    if (actionId) body.set("actionId", actionId);
    setUploadError("");
    setIsUploading(true);
    try {
      await api(`/correspondence/${id}/documents`, { method: "POST", body });
      await queryClient.invalidateQueries({
        queryKey: ["record-documents", id],
      });
      await queryClient.invalidateQueries({ queryKey: ["record-detail", id] });
      form.reset();
    } catch (error) {
      setUploadError(
        error instanceof Error ? error.message : "Document upload failed.",
      );
    } finally {
      setIsUploading(false);
    }
  };
  const downloadDocument = async (
    document: NonNullable<RecordDetail["documents"]>[number],
  ) => {
    setDownloadError("");
    try {
      await downloadFile(
        `/documents/${document.id}/download`,
        document.originalFileName ?? document.fileName,
      );
    } catch (error) {
      setDownloadError(
        error instanceof Error ? error.message : "Document download failed.",
      );
    }
  };

  return (
    <Dialog open={Boolean(id)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        {detail.isLoading ? <Skeleton className="h-48 w-full" /> : null}
        {detail.isError ? <QueryError message={detail.error.message} /> : null}
        {detail.data ? (
          <>
            <DialogHeader>
              <DialogTitle>
                {detail.data.referenceNumber} · {detail.data.subject}
              </DialogTitle>
              <DialogDescription>
                {humanize(detail.data.direction)} ·{" "}
                {detail.data.department?.name ?? "No unit"}
              </DialogDescription>
            </DialogHeader>
            <Tabs defaultValue="details">
              <TabsList className="flex h-auto flex-wrap justify-start">
                <TabsTrigger value="details">Record details</TabsTrigger>
                <TabsTrigger value="actions">
                  Actions ({detail.data.actionItems?.length ?? 0})
                </TabsTrigger>
                <TabsTrigger value="workflow">Workflow history</TabsTrigger>
                <TabsTrigger value="documents">Documents</TabsTrigger>
              </TabsList>
              <TabsContent value="details">
                <div className="grid gap-3 rounded-lg border border-slate-200 p-4 text-sm sm:grid-cols-2">
                  <Detail label="Sender" value={detail.data.sender} />
                  <Detail label="Recipient" value={detail.data.recipient} />
                  <Detail label="Type" value={humanize(detail.data.type)} />
                  <Detail label="Status" value={humanize(detail.data.status)} />
                  <Detail
                    label="Priority"
                    value={humanize(detail.data.priority)}
                  />
                  <Detail
                    label="Classification"
                    value={humanize(detail.data.confidentiality)}
                  />
                  <Detail
                    label="Country / mission"
                    value={detail.data.countryMission}
                  />
                  <Detail
                    label="Organization"
                    value={detail.data.organization}
                  />
                  <Detail
                    label="Received"
                    value={formatDate(detail.data.dateReceived)}
                  />
                  <Detail
                    label="Sent"
                    value={formatDate(detail.data.dateSent)}
                  />
                  <Detail label="Due" value={formatDate(detail.data.dueDate)} />
                  <Detail label="Notes" value={detail.data.notes} />
                </div>
              </TabsContent>
              <TabsContent value="actions">
                {!archived ? (
                  <ActionAssignmentForm
                    correspondenceId={detail.data.id}
                    departments={references.data?.departments ?? []}
                    onCreated={() => {
                      void queryClient.invalidateQueries({
                        queryKey: ["record-detail", id],
                      });
                    }}
                  />
                ) : null}
                <div className="space-y-3">
                  {(detail.data.actionItems ?? []).map((item) => (
                    <div
                      key={item.id}
                      className="rounded-lg border border-slate-200 p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p className="font-medium text-slate-900">
                          {item.requiredAction}
                        </p>
                        <StatusBadge value={item.status} />
                      </div>
                      <p className="mt-2 text-xs text-slate-500">
                        {item.department?.name ?? "Unit"} ·{" "}
                        {item.assignedTo?.name ?? "Unassigned"} · Assigned{" "}
                        {formatDate(item.createdAt)} · Due{" "}
                        {formatDate(item.dueDate)} · Completed{" "}
                        {formatDate(item.completionDate)}
                      </p>
                      {item.remarks ? (
                        <p className="mt-2 text-sm text-slate-600">
                          {item.remarks}
                        </p>
                      ) : null}
                    </div>
                  ))}
                  {!detail.data.actionItems?.length ? (
                    <p className="rounded-lg border border-dashed p-5 text-center text-sm text-slate-500">
                      No actions have been assigned.
                    </p>
                  ) : null}
                </div>
              </TabsContent>
              <TabsContent value="workflow">
                {!archived ? (
                  <WorkflowControls
                    id={detail.data.id}
                    currentStatus={detail.data.status}
                    canApprove={canApprove}
                    onUpdated={() => {
                      void queryClient.invalidateQueries({
                        queryKey: ["record-detail", id],
                      });
                      void queryClient.invalidateQueries({
                        queryKey: ["record-workflow", id],
                      });
                    }}
                  />
                ) : null}
                <div className="space-y-3">
                  {(history.data?.items ?? detail.data.workflows ?? []).map(
                    (event) => (
                      <div
                        key={event.id}
                        className="flex gap-3 border-l-2 border-slate-200 pb-3 pl-4"
                      >
                        <div>
                          <p className="text-sm font-medium text-slate-900">
                            {humanize(event.toStatus)}
                          </p>
                          <p className="text-xs text-slate-500">
                            {event.actor?.name ?? "System"} ·{" "}
                            {new Date(event.createdAt).toLocaleString()}
                          </p>
                          {event.note ? (
                            <p className="mt-1 text-sm text-slate-600">
                              {event.note}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    ),
                  )}
                  {!history.data?.items?.length &&
                  !detail.data.workflows?.length ? (
                    <p className="text-sm text-slate-500">
                      No workflow events are available.
                    </p>
                  ) : null}
                </div>
              </TabsContent>
              <TabsContent value="documents">
                <div className="space-y-4">
                  {uploadError ? <QueryError message={uploadError} /> : null}
                  {downloadError ? (
                    <QueryError message={downloadError} />
                  ) : null}
                  {!archived ? (
                    <form
                      onSubmit={upload}
                      className="flex flex-wrap items-end gap-3 rounded-lg bg-slate-50 p-4"
                    >
                      <label className="min-w-[220px] flex-1 text-sm font-medium">
                        Attach document
                        <Input
                          className="mt-1"
                          name="document"
                          type="file"
                          accept=".pdf,application/pdf"
                          required
                        />
                      </label>
                      <label className="text-sm font-medium">
                        Classification
                        <select
                          name="classification"
                          className="mt-1 block h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
                        >
                          {(references.data?.classifications ?? []).map(
                            (classification) => (
                              <option
                                key={classification}
                                value={classification}
                              >
                                {humanize(classification)}
                              </option>
                            ),
                          )}
                        </select>
                      </label>
                      {detail.data.actionItems?.length ? (
                        <label className="text-sm font-medium">
                          Link to action
                          <select
                            name="actionId"
                            className="mt-1 block h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
                          >
                            <option value="">No action link</option>
                            {detail.data.actionItems.map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.requiredAction}
                              </option>
                            ))}
                          </select>
                        </label>
                      ) : null}
                      <Button type="submit" disabled={isUploading}>
                        <FilePlus2 className="h-4 w-4" />
                        {isUploading ? "Uploading..." : "Upload"}
                      </Button>
                    </form>
                  ) : null}
                  {documents.isError ? (
                    <QueryError message={documents.error.message} />
                  ) : null}
                  {(documents.data?.items ?? detail.data.documents ?? []).map(
                    (document) => (
                      <div
                        key={document.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {document.originalFileName ?? document.fileName}
                          </p>
                          <p className="text-xs text-slate-500">
                            {document.mimeType} ·{" "}
                            {formatDate(document.createdAt)}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void downloadDocument(document)}
                        >
                          <ArrowDownToLine className="h-4 w-4" />
                          Download
                        </Button>
                      </div>
                    ),
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
