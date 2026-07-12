import type { ReactNode } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./Sidebar";
import { Navbar } from "./Navbar";
import { AtmosphereBackground } from "./AtmosphereBackground";

export function Layout({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <div className="app-shell flex min-h-screen w-full">
        <AtmosphereBackground />
        <AppSidebar />
        <div className="app-main-panel flex min-w-0 flex-1 flex-col">
          <Navbar />
          <main className="flex-1 p-3 sm:p-5 lg:p-6">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
