import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, Users, Truck, Package, ShoppingCart, Cylinder, ClipboardList,
  Receipt, Warehouse, BookOpen, UserCog, BarChart3, ShoppingBag, Settings,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader,
} from "@/components/ui/sidebar";
import { useT, type MessageKey } from "@/i18n";

export function AppSidebar() {
  const t = useT();
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const isActive = (url: string) => (url === "/" ? pathname === "/" : pathname.startsWith(url));

  const groups: { labelKey: MessageKey; items: { titleKey: MessageKey; url: string; icon: typeof LayoutDashboard }[] }[] = [
    {
      labelKey: "nav.overview",
      items: [
        { titleKey: "nav.dashboard", url: "/", icon: LayoutDashboard },
        { titleKey: "nav.reports", url: "/reports", icon: BarChart3 },
      ],
    },
    {
      labelKey: "nav.masterData",
      items: [
        { titleKey: "nav.customers", url: "/customers", icon: Users },
        { titleKey: "nav.suppliers", url: "/suppliers", icon: Truck },
        { titleKey: "nav.products", url: "/products", icon: Package },
      ],
    },
    {
      labelKey: "nav.operations",
      items: [
        { titleKey: "nav.sales", url: "/sales", icon: ShoppingCart },
        { titleKey: "nav.purchases", url: "/purchases", icon: ShoppingBag },
        { titleKey: "nav.inventory", url: "/inventory", icon: Warehouse },
        { titleKey: "nav.cylinders", url: "/cylinders", icon: Cylinder },
        { titleKey: "nav.deliveries", url: "/deliveries", icon: ClipboardList },
      ],
    },
    {
      labelKey: "nav.financeHr",
      items: [
        { titleKey: "nav.accounting", url: "/accounting", icon: BookOpen },
        { titleKey: "nav.expenses", url: "/expenses", icon: Receipt },
        { titleKey: "nav.hr", url: "/hr", icon: UserCog },
      ],
    },
    {
      labelKey: "nav.system",
      items: [
        { titleKey: "nav.settings", url: "/settings", icon: Settings },
      ],
    },
  ];

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground font-bold">
            ই
          </div>
          <div className="flex flex-col leading-tight group-data-[collapsible=icon]:hidden">
            <span className="font-display text-sm font-semibold tracking-tight">{t("brand.name")}</span>
            <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">{t("brand.erp")}</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {groups.map((g) => (
          <SidebarGroup key={g.labelKey}>
            <SidebarGroupLabel>{t(g.labelKey)}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {g.items.map((item) => (
                  <SidebarMenuItem key={item.titleKey}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)}>
                      <Link to={item.url} className="flex items-center gap-2">
                        <item.icon className="h-4 w-4" />
                        <span>{t(item.titleKey)}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  );
}
