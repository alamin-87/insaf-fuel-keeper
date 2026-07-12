import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n";

type Phase = "auth" | "open" | "done";

export function LoginGateOverlay({
  active,
  displayName,
  role,
  onComplete,
}: {
  active: boolean;
  displayName: string;
  role?: string;
  onComplete: () => void;
}) {
  const t = useT();
  const [phase, setPhase] = useState<Phase>("auth");
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!active) {
      setPhase("auth");
      setProgress(0);
      return;
    }
    setPhase("auth");
    setProgress(12);
    const t1 = window.setTimeout(() => setProgress(48), 280);
    const t2 = window.setTimeout(() => {
      setPhase("open");
      setProgress(78);
    }, 720);
    const t3 = window.setTimeout(() => setProgress(100), 1100);
    const t4 = window.setTimeout(() => {
      setPhase("done");
      onComplete();
    }, 1650);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, [active, onComplete]);

  if (!active) return null;

  return (
    <div
      className={cn(
        "login-gate-overlay fixed inset-0 z-[100] flex items-center justify-center overflow-hidden",
        phase === "done" && "pointer-events-none opacity-0 transition-opacity duration-300",
      )}
      aria-live="polite"
      aria-busy="true"
    >
      <div className="login-gate-bg absolute inset-0" />
      <div className="login-gate-scan absolute inset-0 opacity-40" />

      {/* Industrial gate panels */}
      <div
        className={cn(
          "login-gate-panel login-gate-panel-left absolute inset-y-0 left-0 w-1/2 border-r border-emerald-500/20",
          phase === "open" || phase === "done" ? "login-gate-open-left" : "",
        )}
      />
      <div
        className={cn(
          "login-gate-panel login-gate-panel-right absolute inset-y-0 right-0 w-1/2 border-l border-emerald-500/20",
          phase === "open" || phase === "done" ? "login-gate-open-right" : "",
        )}
      />

      <div className="relative z-10 flex w-full max-w-sm flex-col items-center px-6 text-center">
        <div className="login-gate-emblem relative mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500 text-2xl font-bold text-slate-950 shadow-[0_0_40px_rgba(16,185,129,0.45)]">
          ই
          <span className="login-gate-ring absolute inset-0 rounded-2xl border border-emerald-300/60" />
        </div>
        <p className="font-display text-lg font-semibold tracking-tight text-white">
          {phase === "auth" ? t("login.gateAuth") : t("login.gateOpen")}
        </p>
        <p className="mt-1 text-sm text-emerald-200/80">{displayName}</p>
        {role && (
          <span className="mt-2 rounded-full border border-white/10 bg-white/5 px-3 py-0.5 text-[10px] uppercase tracking-widest text-slate-300">
            {role}
          </span>
        )}
        <div className="login-gate-track mt-6 h-1 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="login-gate-bar h-full rounded-full bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-500 transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">
          Insaf Gas Corp · ERP
        </p>
      </div>
    </div>
  );
}
