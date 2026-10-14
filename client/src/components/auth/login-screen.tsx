import * as React from "react";
import { AlertTriangle } from "lucide-react";
import { api } from "../../api";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

export function LoginScreen({
  onSignedIn,
}: {
  onSignedIn: (token: string | null) => void;
}) {
  const [error, setError] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const payload = {
      email: String(formData.get("email") ?? "").trim(),
      password: String(formData.get("password") ?? ""),
    };

    if (!payload.email || !payload.password) {
      setError("Please provide both email and password.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const response = await api<{ accessToken: string }>("/auth/login", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      onSignedIn(response.accessToken);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Invalid credentials.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/80">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-sm font-bold text-white">
            MC
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              MoFAIC
            </div>
            <div className="text-lg font-semibold text-slate-900">
              Dashboard
            </div>
          </div>
        </div>

        <h1 className="mb-2 text-2xl font-semibold text-slate-900">Sign in</h1>
        <p className="mb-6 text-sm text-slate-500">
          Use your authorized ministry account to view live analytics and
          operational data.
        </p>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label
              className="text-sm font-medium text-slate-700"
              htmlFor="email"
            >
              Email
            </label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="you@ministry.gov"
              required
            />
          </div>
          <div className="space-y-2">
            <label
              className="text-sm font-medium text-slate-700"
              htmlFor="password"
            >
              Password
            </label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="Enter your password"
              required
            />
          </div>

          {error ? (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Login issue</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <Button className="w-full" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Signing in..." : "Continue"}
          </Button>
        </form>
      </div>
    </div>
  );
}
