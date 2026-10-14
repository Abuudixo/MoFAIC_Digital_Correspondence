import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

type RoleOption = { id: string; name: string };
type DepartmentOption = { id: string; name: string; code: string };
type NewUser = {
  name: string;
  email: string;
  password: string;
  roleId: string;
  departmentId: string;
};

const emptyUser: NewUser = {
  name: "",
  email: "",
  password: "",
  roleId: "",
  departmentId: "",
};

export function UsersPage({
  isAdmin,
  department,
}: {
  isAdmin: boolean;
  department: DepartmentOption | null;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = React.useState<NewUser>(emptyUser);
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
    onSuccess: async () => {
      setForm(emptyUser);
      await queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });

  const optionsError = rolesQuery.error ?? departmentsQuery.error;
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    createUser.mutate(form);
  };

  return (
    <section className="space-y-5">
      <PageHeading
        eyebrow={isAdmin ? "Administration" : "Department"}
        title="User management"
        description={
          isAdmin
            ? "Create department directors and review all ministry accounts."
            : "Create users for your department and review its accounts."
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>
            {isAdmin ? "Create a director" : "Create a department user"}
          </CardTitle>
          <CardDescription>
            {isAdmin
              ? "Assign the director to the department they manage."
              : `New accounts will be assigned to ${department?.name ?? "your department"}.`}
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
          {createUser.isSuccess ? (
            <p role="status" className="mb-4 text-sm text-emerald-700">
              User created successfully.
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
                  setForm((current) => ({
                    ...current,
                    roleId: event.target.value,
                  }))
                }
                disabled={rolesQuery.isLoading || rolesQuery.isError}
                className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400 disabled:opacity-50"
              >
                <option value="">Select a role</option>
                {(rolesQuery.data ?? []).map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
            </label>
            {isAdmin ? (
              <label className="space-y-1.5 text-sm font-medium text-slate-700 sm:col-span-2">
                Department
                <select
                  required
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

      <Card>
        <CardHeader>
          <CardTitle>{isAdmin ? "All users" : "Department users"}</CardTitle>
          <CardDescription>
            {usersQuery.data
              ? `${usersQuery.data.length} user${usersQuery.data.length === 1 ? "" : "s"}`
              : "Accounts registered in the system."}
          </CardDescription>
        </CardHeader>
        <CardContent>
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {usersQuery.data.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium text-slate-900">
                      {user.name}
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>{user.role.name}</TableCell>
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
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-slate-500">No users found.</p>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
