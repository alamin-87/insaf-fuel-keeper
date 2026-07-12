import { Card, CardContent } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatCard({
  title, value, icon: Icon, hint, tone = "default",
}: {
  title: string;
  value: string;
  icon: LucideIcon;
  hint?: string;
  tone?: "default" | "positive" | "warning" | "danger" | "info";
}) {
  const toneMap = {
    default: "bg-primary/10 text-primary",
    positive: "bg-success/15 text-success",
    warning: "bg-warning/20 text-warning-foreground",
    danger: "bg-destructive/10 text-destructive",
    info: "bg-info/15 text-info",
  } as const;
  return (
    <Card className="relative overflow-hidden border-border/60 shadow-sm transition hover:shadow-md">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary/60 via-primary/30 to-transparent" />
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
            <p className="mt-1.5 text-xl font-bold tracking-tight sm:text-2xl">{value}</p>
            {hint && <p className="mt-1 truncate text-xs text-muted-foreground">{hint}</p>}
          </div>
          <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", toneMap[tone])}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
