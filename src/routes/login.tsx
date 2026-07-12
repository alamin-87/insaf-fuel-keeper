import { useState } from "react";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { loginFn, getSessionFn } from "@/lib/auth.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Login · Insaf Gas Corp" }] }),
  beforeLoad: async () => {
    const session = await getSessionFn();
    if (session?.user) throw redirect({ to: "/" });
  },
  component: LoginPage,
  validateSearch: (s: Record<string, unknown>) => ({
    redirect: typeof s.redirect === "string" ? s.redirect : "/",
  }),
});

function LoginPage() {
  const navigate = useNavigate();
  const { redirect: redirectTo } = Route.useSearch();
  const [username, setUsername] = useState("operator");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    try {
      const result = await loginFn({ data: { username, password } });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Welcome, ${result.user.displayName}`);
      navigate({ to: redirectTo || "/" });
    } catch (err: any) {
      toast.error(err?.message || "Login failed");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(34,197,94,0.18),_transparent_55%)]" />
      <div className="pointer-events-none absolute -bottom-24 left-1/2 h-72 w-[40rem] -translate-x-1/2 rounded-full bg-emerald-500/10 blur-3xl" />
      <Card className="relative w-full max-w-md border-slate-800 bg-slate-900/90 text-slate-50 shadow-2xl">
        <CardHeader className="space-y-2 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500 text-lg font-bold text-slate-950">
            I
          </div>
          <CardTitle className="text-2xl">Insaf Gas Corp</CardTitle>
          <p className="text-sm text-slate-400">Sign in to the ERP workspace</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="username" className="text-slate-300">Username</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                className="border-slate-700 bg-slate-950 text-slate-50"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-slate-300">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="border-slate-700 bg-slate-950 text-slate-50"
              />
            </div>
            <Button type="submit" className="w-full bg-emerald-500 text-slate-950 hover:bg-emerald-400" disabled={pending}>
              {pending ? "Signing in…" : "Sign in"}
            </Button>
            <p className="text-center text-xs text-slate-500">
              Default: <span className="font-mono">operator</span> / <span className="font-mono">insaf123</span>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
