import { useNavigate, useRouteContext, useRouter } from "@tanstack/react-router";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Bell, LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { logoutFn } from "@/lib/auth.functions";

export function Navbar() {
  const navigate = useNavigate();
  const router = useRouter();
  const { user } = useRouteContext({ from: "__root__" });

  const onLogout = async () => {
    try {
      await logoutFn();
      await router.invalidate();
      toast.success("Signed out");
      navigate({ to: "/login", search: { redirect: "/" } });
    } catch (e: any) {
      toast.error(e?.message || "Logout failed");
    }
  };

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b bg-background/85 px-3 backdrop-blur-md sm:px-4">
      <SidebarTrigger />
      <div className="ml-1 flex min-w-0 flex-col leading-tight">
        <span className="truncate text-sm font-semibold">Insaf Gas Corp</span>
        <span className="hidden text-xs text-muted-foreground sm:block">Enterprise Resource Planning</span>
      </div>
      <div className="ml-auto flex items-center gap-1">
        <Button variant="ghost" size="icon" className="h-9 w-9"><Bell className="h-4 w-4" /></Button>
        <div className="hidden items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground sm:flex">
          <User className="h-3.5 w-3.5" />
          <span>{user?.displayName ?? "Operator"}</span>
        </div>
        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={onLogout} title="Sign out">
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
