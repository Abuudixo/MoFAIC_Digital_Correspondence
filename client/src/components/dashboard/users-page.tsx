import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import { api } from "../../api";
import { PageHeading } from "../workspace-shared";
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
} from "../ui/dialog";
import { Input } from "../ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";

type ManagedUser = {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  role: { id: string; name: string };
  department: { id: string; name: string; code: string } | null;
  createdAt: string;
};

type RoleOption = { id: string; name: string; description: string | null };
type DepartmentOption = { id: string; name: string; code: string };
type NewUser = {
  name: string;
  email: string;
  password: string;
  roleId: string;
  departmentId: string;
};
type UserEdit = Omit<NewUser, "password"> & {
  isActive: boolean;
  password: string;
};

const emptyUser: NewUser = {
  name: "",
  email: "",
  password: "",
  roleId: "",
  departmentId: "",
};

function roleLabel(name: string) {
  const labels: Record<string, string> = {
    ADMIN: "System Administrator",
    PERMANENT_SECRETARY: "Permanent Secretary",
    DEPARTMENT_HEAD: "Department Head",
    STAFF: "Department Staff / Office Secretary",
  };
  return labels[name] ?? name;
}

export function UsersPage({
  isAdmin,
  department,
}: {
  isAdmin: boolean;
  department: DepartmentOption | null;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = React.useState<NewUser>(emptyUser);
  const [createdUser, setCreatedUser] = React.useState<ManagedUser | null>(null);
  const [editingUser, setEditingUser] = React.useState<ManagedUser | null>(null);
  const [editForm, setEditForm] = React.useState<UserEdit | null>(null);
  const [updateMessage, setUpdateMessage] = React.useState("");
  const usersQuery = useQuery({
    queryKey: ["users"],
    queryFn: async () => (await api<{ items: ManagedUser[] }>("/users")).items,
  });
  const rolesQuery = useQuery({
    queryKey: ["roles"],
    queryFn: async () => (await api<{ items: RoleOption[] }>("/roles")).items,
  });
  const departmentsQuery = useQuery({
    queryKey: ["departments"],
    queryFn: async () =>
      (await api<{ items: DepartmentOption[] }>("/departments")).items,
    enabled: isAdmin,
  });
  const createUser = useMutation({
    mutationFn: async (input: NewUser) =>
      api<{ user: ManagedUser }>("/users", {
        method: "POST",
        body: JSON.stringify({
          ...input,
          departmentId: input.departmentId || null,
        }),
      }),
    onSuccess: async ({ user }) => {
      setForm(emptyUser);
      setCreatedUser(user);
      await queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });
  const updateUser = useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id: string;
      input: UserEdit;
    }) =>
      api<{ user: ManagedUser }>(`/users/${id}`, {
        method: "PATCH",
        body: JSON.stringify(
          input.password
            ? { ...input, departmentId: input.departmentId || null }
            : {
                name: input.name,
                email: input.email,
                roleId: input.roleId,
                departmentId: input.departmentId || null,
                isActive: input.isActive,
              },
        ),
      }),
    onSuccess: async ({ user }) => {
      setEditingUser(null);
      setEditForm(null);
      setUpdateMessage(`${user.name} was updated successfully.`);
      await queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });

  const optionsError = rolesQuery.error ?? departmentsQuery.error;
  const selectedRole = rolesQuery.data?.find((role) => role.id === form.roleId);
  const departmentRequired = selectedRole?.name !== "PERMANENT_SECRETARY";
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    createUser.mutate(form);
  };
  const openEditDialog = (user: ManagedUser) => {
    setUpdateMessage("");
    updateUser.reset();
    setEditingUser(user);
    setEditForm({
      name: user.name,
      email: user.email,
      roleId: user.role.id,
      departmentId: user.department?.id ?? "",
      isActive: user.isActive,
      password: "",
    });
  };
  const submitEdit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (editingUser && editForm) {
      updateUser.mutate({ id: editingUser.id, input: editForm });
    }
  };

  return (
    <section className="space-y-5">
      <PageHeading
        eyebrow={isAdmin ? "Administration" : "Department"}
        title="User management"
        description={
          isAdmin
            ? "Create Permanent Secretary, Department Head, and Staff accounts."
            : "Review department accounts."
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>
            {isAdmin ? "Create a user" : "Department users"}
          </CardTitle>
          <CardDescription>
            {isAdmin
              ? "Assign a department to Department Head and Staff accounts. The Permanent Secretary account is ministry-wide."
              : `Accounts are assigned to ${department?.name ?? "your department"}.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {optionsError ? (
            <p role="alert" className="mb-4 text-sm text-rose-700">
              Could not load role or department options:{" "}
              {optionsError instanceof Error
                ? optionsError.message
                : String(optionsError)}
            </p>
          ) : null}
          {createUser.isError ? (
            <p role="alert" className="mb-4 text-sm text-rose-700">
              {createUser.error instanceof Error
                ? createUser.error.message
                : "The user could not be created."}
            </p>
          ) : null}
          <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1.5 text-sm font-medium text-slate-700">
              Full name
              <Input
                required
                maxLength={160}
                autoComplete="name"
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({ ...current, name: event.target.value }))
                }
              />
            </label>
            <label className="space-y-1.5 text-sm font-medium text-slate-700">
              Email address
              <Input
                required
                type="email"
                maxLength={320}
                autoComplete="email"
                value={form.email}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    email: event.target.value,
                  }))
                }
              />
            </label>
            <label className="space-y-1.5 text-sm font-medium text-slate-700">
              Initial password
              <Input
                required
                type="password"
                minLength={12}
                maxLength={128}
                autoComplete="new-password"
                value={form.password}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    password: event.target.value,
                  }))
                }
              />
              <span className="block text-xs font-normal text-slate-500">
                Must be at least 12 characters.
              </span>
            </label>
            <label className="space-y-1.5 text-sm font-medium text-slate-700">
              Role
              <select
                required
                value={form.roleId}
                onChange={(event) =>
                  setForm((current) => {
                    const role = rolesQuery.data?.find(
                      (option) => option.id === event.target.value,
                    );
                    return {
                      ...current,
                      roleId: event.target.value,
                      ...(role?.name === "PERMANENT_SECRETARY"
                        ? { departmentId: "" }
                        : {}),
                    };
                  })
                }
                disabled={rolesQuery.isLoading || rolesQuery.isError}
                className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400 disabled:opacity-50"
              >
                <option value="">Select a role</option>
                {(rolesQuery.data ?? []).map((role) => (
                  <option key={role.id} value={role.id}>
                    {roleLabel(role.name)}
                  </option>
                ))}
              </select>
            </label>
            {isAdmin && departmentRequired ? (
              <label className="space-y-1.5 text-sm font-medium text-slate-700 sm:col-span-2">
                Department
                <select
                  required={departmentRequired}
                  value={form.departmentId}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      departmentId: event.target.value,
                    }))
                  }
                  disabled={
                    departmentsQuery.isLoading || departmentsQuery.isError
                  }
                  className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400 disabled:opacity-50"
                >
                  <option value="">Select a department</option>
                  {(departmentsQuery.data ?? []).map((departmentOption) => (
                    <option
                      key={departmentOption.id}
                      value={departmentOption.id}
                    >
                      {departmentOption.name} ({departmentOption.code})
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <div className="sm:col-span-2">
              <Button
                type="submit"
                disabled={
                  createUser.isPending ||
                  rolesQuery.isLoading ||
                  departmentsQuery.isLoading ||
                  Boolean(optionsError) ||
                  !rolesQuery.data?.length
                }
              >
                {createUser.isPending ? "Creating user..." : "Create user"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Dialog
        open={createdUser !== null}
        onOpenChange={(open) => {
          if (!open) setCreatedUser(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>User created successfully</DialogTitle>
            <DialogDescription>
              The new account is ready to use.
            </DialogDescription>
          </DialogHeader>
          {createdUser ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm">
              <p className="font-semibold text-emerald-950">{createdUser.name}</p>
              <p className="mt-1 text-emerald-800">{createdUser.email}</p>
              <p className="mt-2 text-emerald-800">
                {roleLabel(createdUser.role.name)}
                {createdUser.department
                  ? ` · ${createdUser.department.name}`
                  : ""}
              </p>
            </div>
          ) : null}
          <div className="flex justify-end">
            <Button type="button" onClick={() => setCreatedUser(null)}>
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle>All users</CardTitle>
          <CardDescription>
            {usersQuery.data
              ? `${usersQuery.data.length} user${usersQuery.data.length === 1 ? "" : "s"}`
              : "Accounts registered in the system."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {updateMessage ? (
            <p role="status" className="mb-4 text-sm text-emerald-700">
              {updateMessage}
            </p>
          ) : null}
          {usersQuery.isError ? (
            <p role="alert" className="text-sm text-rose-700">
              Could not load users:{" "}
              {usersQuery.error instanceof Error
                ? usersQuery.error.message
                : String(usersQuery.error)}
            </p>
          ) : usersQuery.isLoading ? (
            <p className="text-sm text-slate-500">Loading users...</p>
          ) : usersQuery.data?.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  {isAdmin ? <TableHead>Actions</TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {usersQuery.data.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium text-slate-900">
                      {user.name}
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>{roleLabel(user.role.name)}</TableCell>
                    <TableCell>
                      {user.department?.name ?? "Not assigned"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.isActive ? "success" : "secondary"}>
                        {user.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(user.createdAt).toLocaleDateString()}
                    </TableCell>
                    {isAdmin ? (
                      <TableCell>
                        {user.role.name !== "ADMIN" ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => openEditDialog(user)}
                          >
                            <Pencil className="h-4 w-4" />
                            Edit
                          </Button>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-slate-500">No users found.</p>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={editingUser !== null}
        onOpenChange={(open) => {
          if (!open && !updateUser.isPending) {
            setEditingUser(null);
            setEditForm(null);
            updateUser.reset();
          }
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Edit user</DialogTitle>
            <DialogDescription>
              Update this account’s details, role, department, or access status.
            </DialogDescription>
          </DialogHeader>
          {updateUser.isError ? (
            <p role="alert" className="text-sm text-rose-700">
              {updateUser.error instanceof Error
                ? updateUser.error.message
                : "The user could not be updated."}
            </p>
          ) : null}
          {editForm ? (
            <form onSubmit={submitEdit} className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1.5 text-sm font-medium text-slate-700">
                Full name
                <Input
                  required
                  maxLength={160}
                  autoComplete="name"
                  value={editForm.name}
                  onChange={(event) =>
                    setEditForm((current) =>
                      current ? { ...current, name: event.target.value } : current,
                    )
                  }
                />
              </label>
              <label className="space-y-1.5 text-sm font-medium text-slate-700">
                Email address
                <Input
                  required
                  type="email"
                  maxLength={320}
                  autoComplete="email"
                  value={editForm.email}
                  onChange={(event) =>
                    setEditForm((current) =>
                      current ? { ...current, email: event.target.value } : current,
                    )
                  }
                />
              </label>
              <label className="space-y-1.5 text-sm font-medium text-slate-700">
                New password
                <Input
                  type="password"
                  minLength={12}
                  maxLength={128}
                  autoComplete="new-password"
                  placeholder="Leave blank to keep current password"
                  value={editForm.password}
                  onChange={(event) =>
                    setEditForm((current) =>
                      current
                        ? { ...current, password: event.target.value }
                        : current,
                    )
                  }
                />
                <span className="block text-xs font-normal text-slate-500">
                  Optional. If set, must be at least 12 characters.
                </span>
              </label>
              <label className="space-y-1.5 text-sm font-medium text-slate-700">
                Role
                <select
                  required
                  value={editForm.roleId}
                  onChange={(event) =>
                    setEditForm((current) => {
                      if (!current) return current;
                      const role = rolesQuery.data?.find(
                        (option) => option.id === event.target.value,
                      );
                      return {
                        ...current,
                        roleId: event.target.value,
                        ...(role?.name === "PERMANENT_SECRETARY"
                          ? { departmentId: "" }
                          : {}),
                      };
                    })
                  }
                  className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400"
                >
                  <option value="">Select a role</option>
                  {(rolesQuery.data ?? []).map((role) => (
                    <option key={role.id} value={role.id}>
                      {roleLabel(role.name)}
                    </option>
                  ))}
                </select>
              </label>
              {rolesQuery.data?.find((role) => role.id === editForm.roleId)
                ?.name !== "PERMANENT_SECRETARY" ? (
                <label className="space-y-1.5 text-sm font-medium text-slate-700">
                  Department
                  <select
                    required
                    value={editForm.departmentId}
                    onChange={(event) =>
                      setEditForm((current) =>
                        current
                          ? { ...current, departmentId: event.target.value }
                          : current,
                      )
                    }
                    disabled={departmentsQuery.isLoading || departmentsQuery.isError}
                    className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400 disabled:opacity-50"
                  >
                    <option value="">Select a department</option>
                    {(departmentsQuery.data ?? []).map((departmentOption) => (
                      <option key={departmentOption.id} value={departmentOption.id}>
                        {departmentOption.name} ({departmentOption.code})
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700 sm:col-span-2">
                <input
                  type="checkbox"
                  checked={editForm.isActive}
                  onChange={(event) =>
                    setEditForm((current) =>
                      current
                        ? { ...current, isActive: event.target.checked }
                        : current,
                    )
                  }
                  className="h-4 w-4 rounded border-slate-300"
                />
                Account is active
              </label>
              <div className="flex justify-end gap-2 sm:col-span-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={updateUser.isPending}
                  onClick={() => {
                    setEditingUser(null);
                    setEditForm(null);
                    updateUser.reset();
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={updateUser.isPending}>
                  {updateUser.isPending ? "Saving..." : "Save changes"}
                </Button>
              </div>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}
