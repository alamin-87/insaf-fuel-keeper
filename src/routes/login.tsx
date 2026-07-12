import { useCallback, useState } from "react";
import { createFileRoute, redirect, useNavigate, useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Building2, Calculator, ClipboardCheck, HardHat, Languages, Shield, Sparkles, Truck, Users, Warehouse,
} from "lucide-react";
import { loginFn, getSessionFn } from "@/lib/auth.functions";
import { LoginGateOverlay } from "@/components/auth/LoginGateOverlay";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useT, useI18n } from "@/i18n";
import type { AppRole } from "@/lib/settings-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Login · Insaf Gas Corp" }] }),
  beforeLoad: async () => {
    try {
      const session = await getSessionFn();
      if (session?.user) throw redirect({ to: "/" });
    } catch (e) {
      if (e && typeof e === "object" && "to" in e) throw e;
    }
  },
  component: LoginPage,
  validateSearch: (s: Record<string, unknown>) => ({
    redirect: typeof s.redirect === "string" ? s.redirect : "/",
  }),
});

const QUICK_ACCESS: Array<{ username: string; displayName: string; role: AppRole }> = [
  { username: "operator", displayName: "Operator", role: "Administrator" },
  { username: "manager", displayName: "Plant Manager", role: "Manager" },
  { username: "sales1", displayName: "Sales Desk", role: "Sales" },
  { username: "warehouse", displayName: "Warehouse Lead", role: "Warehouse" },
  { username: "accounts", displayName: "Accounts Officer", role: "Accounts" },
  { username: "hr1", displayName: "HR Officer", role: "HR" },
  { username: "delivery1", displayName: "Delivery Lead", role: "Delivery" },
  { username: "auditor", displayName: "Internal Auditor", role: "Auditor" },
];

const ROLE_META: Record<AppRole, { icon: typeof Shield; tone: string; glow: string }> = {
  Administrator: { icon: Shield, tone: "from-emerald-500/35 to-teal-900/20 border-emerald-400/35", glow: "group-hover:shadow-emerald-500/25" },
  Manager: { icon: HardHat, tone: "from-sky-500/30 to-blue-900/20 border-sky-400/35", glow: "group-hover:shadow-sky-500/25" },
  Sales: { icon: Users, tone: "from-amber-500/30 to-orange-900/20 border-amber-400/35", glow: "group-hover:shadow-amber-500/25" },
  Warehouse: { icon: Warehouse, tone: "from-violet-500/30 to-purple-900/20 border-violet-400/35", glow: "group-hover:shadow-violet-500/25" },
  Accounts: { icon: Calculator, tone: "from-cyan-500/30 to-teal-900/20 border-cyan-400/35", glow: "group-hover:shadow-cyan-500/25" },
  HR: { icon: Building2, tone: "from-rose-500/30 to-pink-900/20 border-rose-400/35", glow: "group-hover:shadow-rose-500/25" },
  Delivery: { icon: Truck, tone: "from-lime-500/30 to-green-900/20 border-lime-400/35", glow: "group-hover:shadow-lime-500/25" },
  Auditor: { icon: ClipboardCheck, tone: "from-slate-400/25 to-slate-800/20 border-slate-400/35", glow: "group-hover:shadow-slate-400/20" },
};

const QUICK_PASSWORD = "insaf123";

function LoginPage() {
  const t = useT();
  const { locale, setLocale } = useI18n();
  const navigate = useNavigate();
  const router = useRouter();
  const { redirect: redirectTo } = Route.useSearch();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [quickUser, setQuickUser] = useState<string | null>(null);
  const [gateActive, setGateActive] = useState(false);
  const [gateUser, setGateUser] = useState<{ name: string; role?: string }>({ name: "" });
  const [pendingNav, setPendingNav] = useState<string | null>(null);

  const finishGate = useCallback(() => {
    if (pendingNav) {
      navigate({ to: pendingNav });
    }
  }, [navigate, pendingNav]);

  const doLogin = async (user: string, pass: string, meta?: { displayName: string; role: AppRole }) => {
    setPending(true);
    setQuickUser(user);
    try {
      const result = await loginFn({ data: { username: user, password: pass } });
      if (!result.ok) {
        toast.error(result.error === "Invalid username or password" ? t("login.invalid") : result.error);
        return;
      }
      setGateUser({
        name: result.user.displayName || meta?.displayName || user,
        role: result.user.role || meta?.role,
      });
      setPendingNav(redirectTo || "/");
      setGateActive(true);
      await router.invalidate();
    } catch (err: any) {
      toast.error(err?.message || t("login.failed"));
    } finally {
      setPending(false);
      setQuickUser(null);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await doLogin(username, password);
  };

  return (
    <div className="login-page login-ambient relative text-slate-50">
      <div className="login-grid-lines pointer-events-none absolute inset-0" />
      <div className="login-orb pointer-events-none absolute -left-20 top-1/4 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />
      <div className="login-orb pointer-events-none absolute -right-16 bottom-1/4 h-48 w-48 rounded-full bg-cyan-500/10 blur-3xl" style={{ animationDelay: "-3s" }} />

      <div className="relative mx-auto flex h-full max-w-[1400px] flex-col px-3 py-3 sm:px-5 sm:py-4">
        <header className="login-enter flex shrink-0 items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500 text-base font-bold text-slate-950 shadow-lg shadow-emerald-500/30 sm:h-10 sm:w-10">
              ই
            </div>
            <div className="min-w-0 truncate">
              <p className="truncate font-display text-sm font-semibold sm:text-base">{t("brand.name")}</p>
              <p className="truncate text-[10px] text-slate-400 sm:text-xs">{t("brand.tagline")}</p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 shrink-0 gap-1 border-slate-700/80 bg-slate-900/60 px-2.5 text-xs hover:bg-slate-800"
            onClick={() => setLocale(locale === "bn" ? "en" : "bn")}
          >
            <Languages className="h-3.5 w-3.5" />
            {locale === "bn" ? "EN" : "বাং"}
          </Button>
        </header>

        <main className="login-enter login-enter-delay-1 mt-3 grid min-h-0 flex-1 gap-3 lg:grid-cols-[1.2fr_0.75fr] lg:gap-4">
          <section className="flex min-h-0 flex-col gap-2 overflow-hidden">
            <div className="shrink-0">
              <div className="flex items-center gap-2">
                <Badge className="h-5 bg-emerald-500/15 px-2 text-[10px] text-emerald-300 hover:bg-emerald-500/15">
                  <Sparkles className="mr-1 h-3 w-3" />
                  {t("login.quickAccess")}
                </Badge>
              </div>
              <h1 className="mt-1.5 font-display text-lg font-bold leading-tight tracking-tight sm:text-xl lg:text-2xl">
                {t("login.homeTitle")}
              </h1>
              <p className="mt-0.5 line-clamp-1 text-[11px] text-slate-400 sm:text-xs">{t("login.homeHint")}</p>
            </div>

            <div className="grid min-h-0 flex-1 grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-2.5 lg:grid-cols-4">
              {QUICK_ACCESS.map((u, i) => {
                const meta = ROLE_META[u.role] ?? ROLE_META.Auditor;
                const Icon = meta.icon;
                const busy = pending && quickUser === u.username;
                return (
                  <button
                    key={u.username}
                    type="button"
                    disabled={pending || gateActive}
                    onClick={() => doLogin(u.username, QUICK_PASSWORD, u)}
                    style={{ animationDelay: `${0.05 + i * 0.04}s` }}
                    className={cn(
                      "login-role-btn login-card-enter group flex flex-col rounded-xl border bg-gradient-to-br p-2.5 text-left sm:p-3",
                      "shadow-lg shadow-black/20",
                      meta.tone,
                      meta.glow,
                      busy && "ring-2 ring-emerald-400/60",
                    )}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-950/50 text-emerald-300 sm:h-8 sm:w-8">
                        <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      </div>
                      <span className="truncate rounded border border-white/10 bg-black/25 px-1 py-0.5 text-[8px] font-medium uppercase tracking-wide text-slate-300 sm:text-[9px]">
                        {u.role.split(" ")[0]}
                      </span>
                    </div>
                    <p className="mt-1.5 truncate text-[11px] font-semibold leading-tight sm:text-xs">{u.displayName}</p>
                    <p className="truncate font-mono text-[9px] text-slate-500">{u.username}</p>
                    <p className="mt-auto pt-1.5 text-[9px] font-medium text-emerald-300/80 group-hover:text-emerald-200 sm:text-[10px]">
                      {busy ? t("login.submitting") : "→"}
                    </p>
                  </button>
                );
              })}
            </div>
            <p className="shrink-0 text-center text-[9px] text-slate-600 sm:text-[10px]">{t("login.quickPassHint")}</p>
          </section>

          <aside className="login-enter login-enter-delay-2 flex min-h-0 flex-col justify-center">
            <div className="rounded-2xl border border-slate-800/80 bg-slate-900/70 p-4 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-5">
              <div className="mb-3">
                <h2 className="font-display text-base font-semibold sm:text-lg">{t("login.title")}</h2>
                <p className="text-[11px] text-slate-400 sm:text-xs">{t("login.subtitle")}</p>
              </div>
              <form onSubmit={onSubmit} className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="username" className="text-[11px] text-slate-300">{t("login.username")}</Label>
                  <Input
                    id="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="username"
                    disabled={gateActive}
                    className="h-9 border-slate-700/80 bg-slate-950/80 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="password" className="text-[11px] text-slate-300">{t("login.password")}</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    disabled={gateActive}
                    className="h-9 border-slate-700/80 bg-slate-950/80 text-sm"
                  />
                </div>
                <Button
                  type="submit"
                  className="h-9 w-full bg-emerald-500 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/25 hover:bg-emerald-400"
                  disabled={pending || gateActive}
                >
                  {pending && !quickUser ? t("login.submitting") : t("login.submit")}
                </Button>
                <p className="text-center text-[10px] text-slate-500">
                  {t("login.defaultHint")} <span className="font-mono text-slate-400">operator</span> / <span className="font-mono text-slate-400">insaf123</span>
                </p>
              </form>
            </div>
          </aside>
        </main>
      </div>

      <LoginGateOverlay
        active={gateActive}
        displayName={gateUser.name}
        role={gateUser.role}
        onComplete={finishGate}
      />
    </div>
  );
}
