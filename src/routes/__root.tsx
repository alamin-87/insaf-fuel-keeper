import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet, Link, createRootRouteWithContext, useRouter, useRouterState,
  HeadContent, Scripts, redirect,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import { Layout } from "@/components/layout/Layout";
import { getSessionFn } from "@/lib/auth.functions";
import type { AuthUser } from "@/types";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist.
        </p>
        <div className="mt-6">
          <Link to="/" className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            Go to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  useEffect(() => { reportLovableError(error, { boundary: "tanstack_root_error_component" }); }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">Try again or head back home.</p>
        <div className="mt-6 flex justify-center gap-2">
          <button onClick={() => { router.invalidate(); reset(); }}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            Try again
          </button>
          <a href="/" className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent">Home</a>
        </div>
      </div>
    </div>
  );
}

export type RouterContext = {
  queryClient: QueryClient;
  user: AuthUser | null;
};

export const Route = createRootRouteWithContext<RouterContext>()({
  beforeLoad: async ({ location }): Promise<{ user: AuthUser | null }> => {
    const session = await getSessionFn();
    const user = session?.user ?? null;
    const isLogin = location.pathname === "/login";
    if (!user && !isLogin) {
      throw redirect({
        to: "/login",
        search: { redirect: location.href },
      });
    }
    return { user };
  },
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Insaf Gas Corp ERP" },
      { name: "description", content: "Enterprise resource planning for Insaf Gas Corp — sales, cylinders, deliveries and master data." },
      { property: "og:title", content: "Insaf Gas Corp ERP" },
      { property: "og:description", content: "Enterprise resource planning for Insaf Gas Corp — sales, cylinders, deliveries and master data." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Insaf Gas Corp ERP" },
      { name: "twitter:description", content: "Enterprise resource planning for Insaf Gas Corp — sales, cylinders, deliveries and master data." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/b5532679-0732-497b-bcb7-c52b3737b8bd/id-preview-f9751d6a--0437e65c-0746-4831-a1f7-57f4f32ad9b5.lovable.app-1783891601779.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/b5532679-0732-497b-bcb7-c52b3737b8bd/id-preview-f9751d6a--0437e65c-0746-4831-a1f7-57f4f32ad9b5.lovable.app-1783891601779.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head><HeadContent /></head>
      <body>{children}<Scripts /></body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const isLogin = pathname === "/login";

  return (
    <QueryClientProvider client={queryClient}>
      {isLogin ? <Outlet /> : <Layout><Outlet /></Layout>}
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  );
}
