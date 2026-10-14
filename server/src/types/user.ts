export type AuthenticatedUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  departmentId: string | null;
  permissions: string[];
};
