import { Badge } from "../ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { PageHeading } from "../workspace-shared";

export type PersonalProfileData = {
  name: string;
  email: string;
  isActive: boolean;
  role: { name: string };
  department: { name: string; code: string } | null;
  createdAt: string;
};

export function PersonalProfile({ user }: { user: PersonalProfileData }) {
  return (
    <section className="space-y-5">
      <PageHeading
        eyebrow="Account"
        title="Personal profile"
        description="Review your account information and ministry access."
      />
      <Card>
        <CardHeader>
          <CardTitle>Account information</CardTitle>
          <CardDescription>
            Profile details associated with your ministry account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
            <ProfileField label="Full name" value={user.name} />
            <ProfileField label="Email address" value={user.email} />
            <ProfileField label="Role" value={user.role.name} />
            <ProfileField
              label="Department"
              value={
                user.department
                  ? `${user.department.name} (${user.department.code})`
                  : "Not assigned"
              }
            />
            <div>
              <dt className="text-sm font-medium text-slate-500">
                Account status
              </dt>
              <dd className="mt-1">
                <Badge variant={user.isActive ? "success" : "secondary"}>
                  {user.isActive ? "Active" : "Inactive"}
                </Badge>
              </dd>
            </div>
            <ProfileField
              label="Member since"
              value={new Date(user.createdAt).toLocaleDateString()}
            />
          </dl>
        </CardContent>
      </Card>
    </section>
  );
}

function ProfileField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-sm font-medium text-slate-500">{label}</dt>
      <dd className="mt-1 break-words text-sm text-slate-900">{value}</dd>
    </div>
  );
}
