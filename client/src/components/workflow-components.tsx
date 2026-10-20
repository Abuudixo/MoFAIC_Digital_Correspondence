import * as React from "react";
import { Plus } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Department, Field, QueryError, humanize } from "./workspace-shared";

export function ActionAssignmentForm({
  correspondenceId,
  departments,
  onCreated,
}: {
  correspondenceId: string;
  departments: Department[];
  onCreated: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [departmentId, setDepartmentId] = React.useState("");
  const [error, setError] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const queryClient = useQueryClient();
  const assignees = useQuery({
    queryKey: ["department-assignees", departmentId],
    queryFn: async () =>
      api<{ items: Array<{ id: string; name: string }> }>(
        `/departments/${departmentId}/assignees`,
      ),
    enabled: Boolean(departmentId),
  });
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setError("");
    setSaving(true);
    try {
      await api(`/correspondence/${correspondenceId}/action-items`, {
        method: "POST",
        body: JSON.stringify({
          departmentId,
          assignedToId: String(formData.get("assignedToId") ?? "") || null,
          dueDate: formData.get("dueDate"),
          requiredAction: String(formData.get("requiredAction") ?? "").trim(),
          priority: String(formData.get("priority")),
          remarks: String(formData.get("remarks") ?? "").trim() || undefined,
        }),
      });
      await queryClient.invalidateQueries({
        queryKey: ["record-detail", correspondenceId],
      });
      await queryClient.invalidateQueries({ queryKey: ["actions"] });
      await queryClient.invalidateQueries({ queryKey: ["actionSummary"] });
      onCreated();
      setOpen(false);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not assign action.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mb-4">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen((current) => !current)}
      >
        <Plus className="h-4 w-4" />
        {open ? "Cancel action" : "Assign an action"}
      </Button>
      {open ? (
        <form
          onSubmit={submit}
          className="mt-3 grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2"
        >
          {error ? (
            <div className="sm:col-span-2">
              <QueryError message={error} />
            </div>
          ) : null}
          <Field label="Assigned unit" required>
            <select
              required
              value={departmentId}
              onChange={(event) => setDepartmentId(event.target.value)}
              className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
            >
              <option value="">Select a unit</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Assigned person" required>
            <select
              name="assignedToId"
              required
              disabled={!departmentId || assignees.isLoading}
              className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm disabled:bg-slate-100"
            >
              <option value="">
                {assignees.isLoading ? "Loading..." : "Select a person"}
              </option>
              {(assignees.data?.items ?? []).map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </select>
            {assignees.isError ? (
              <span className="text-xs text-rose-700">
                {assignees.error.message}
              </span>
            ) : null}
          </Field>
          <Field label="Date assigned">
            <Input value={new Date().toLocaleDateString()} readOnly />
          </Field>
          <Field label="Due date" required>
            <Input name="dueDate" type="date" required />
          </Field>
          <Field label="Required action" required className="sm:col-span-2">
            <textarea
              name="requiredAction"
              required
              maxLength={2000}
              rows={2}
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Priority">
            <select
              name="priority"
              className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
            >
              <option value="NORMAL">Normal</option>
              <option value="LOW">Low</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>
          </Field>
          <Field label="Remarks">
            <Input name="remarks" maxLength={2000} />
          </Field>
          <div className="flex justify-end sm:col-span-2">
            <Button
              type="submit"
              disabled={saving || !departmentId || assignees.isLoading}
            >
              {saving ? "Assigning..." : "Assign action"}
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}

export function WorkflowControls({
  id,
  currentStatus,
  canApprove,
  onUpdated,
}: {
  id: string;
  currentStatus: string;
  canApprove: boolean;
  onUpdated: () => void;
}) {
  const [error, setError] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [targetStatus, setTargetStatus] = React.useState("");
  const [comment, setComment] = React.useState("");
  const isAwaitingApproval = currentStatus === "PENDING_APPROVAL";
  const isTerminal = currentStatus === "CLOSED" || currentStatus === "ARCHIVED";
  const update = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const nextStatus = String(data.get("toStatus") ?? "");
    const note = String(data.get("comment") ?? "").trim();
    setError("");
    setSaving(true);
    try {
      if (nextStatus === "PENDING_APPROVAL" && !note) {
        throw new Error(
          "A comment is required when sending a record for approval.",
        );
      }
      await api(`/correspondence/${id}/actions`, {
        method: "POST",
        body: JSON.stringify({
          toStatus: nextStatus,
          comment: note || undefined,
        }),
      });
      onUpdated();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Workflow update failed.",
      );
    } finally {
      setSaving(false);
    }
  };
  const decideApproval = async (decision: "approve" | "reject") => {
    setError("");
    setSaving(true);
    try {
      await api(`/correspondence/${id}/${decision}`, {
        method: "POST",
        body: JSON.stringify({ comment: comment.trim() }),
      });
      setComment("");
      onUpdated();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Approval decision failed.",
      );
    } finally {
      setSaving(false);
    }
  };
  const statusOptions = [
    "IN_PROGRESS",
    "PENDING_APPROVAL",
    "DISPATCHED",
    "CLOSED",
  ].filter((status) => status !== currentStatus);
  return (
    <div className="mb-4 rounded-lg border border-slate-200 p-4">
      <p className="mb-3 text-sm font-semibold text-slate-800">
        Record workflow
      </p>
      {error ? (
        <div className="mb-3">
          <QueryError message={error} />
        </div>
      ) : null}
      {isAwaitingApproval && canApprove ? (
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
          <Field label="Approval / rejection comment" required>
            <Input
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              maxLength={2000}
              required
            />
          </Field>
          <Button
            type="button"
            disabled={saving || !comment.trim()}
            onClick={() => void decideApproval("approve")}
          >
            {saving ? "Submitting..." : "Approve"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={saving || !comment.trim()}
            onClick={() => void decideApproval("reject")}
          >
            Reject
          </Button>
        </div>
      ) : isAwaitingApproval ? (
        <p className="text-sm text-slate-600">
          This file is awaiting approval from an authorized approver.
        </p>
      ) : isTerminal ? (
        <p className="text-sm text-slate-500">
          {currentStatus === "CLOSED"
            ? "This record is closed and ready for authorized archiving."
            : "This record is archived and read-only."}
        </p>
      ) : (
        <form
          onSubmit={update}
          className="grid gap-3 sm:grid-cols-[1fr_2fr_auto] sm:items-end"
        >
          <Field label="Move to">
            <select
              name="toStatus"
              value={targetStatus || statusOptions[0] || ""}
              onChange={(event) => setTargetStatus(event.target.value)}
              className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
            >
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {humanize(status)}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="Review / transition comment"
            required={targetStatus === "PENDING_APPROVAL"}
          >
            <Input
              name="comment"
              maxLength={2000}
              required={targetStatus === "PENDING_APPROVAL"}
            />
          </Field>
          <Button type="submit" disabled={saving || statusOptions.length === 0}>
            {saving ? "Updating..." : "Update status"}
          </Button>
        </form>
      )}
      <p className="mt-2 text-xs text-slate-500">
        The server enforces allowed workflow transitions and closure
        requirements.
      </p>
    </div>
  );
}
