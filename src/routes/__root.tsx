import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet, Link, createRootRouteWithContext, useRouter, useRouterState,
  HeadContent, Scripts, redirect,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import { Layout } from "@/components/layout/Layout";
import { getSessionFn } from "@/lib/auth.functions";
import type { AuthUser } from "@/types";

import appCss from "../styles.css?url";
import { I18nProvider, useT } from "@/i18n";
import { ThemeProvider } from "@/lib/theme";
import { reportLovableError } from "../lib/lovable-error-reporting";

/** Fallback client if route context is unavailable during a hard navigation. */
const fallbackQueryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

function NotFoundComponent() {
  return (
    <I18nProvider>
      <NotFoundInner />
    </I18nProvider>
  );
}

function NotFoundInner() {
  const t = useT();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold">{t("error.404")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t("error.404hint")}</p>
        <div className="mt-6">
          <Link to="/login" search={{ redirect: "/" }} className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            {t("common.home")}
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <I18nProvider>
      <ErrorInner error={error} reset={reset} />
    </I18nProvider>
  );
}

function ErrorInner({ error, reset }: { error: Error; reset: () => void }) {
  const t = useT();
  const router = useRouter();
  useEffect(() => { reportLovableError(error, { boundary: "tanstack_root_error_component" }); }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">{t("error.title")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("error.hint")}</p>
        {error?.message && (
          <p className="mt-3 break-words rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-left font-mono text-xs text-destructive">
            {error.message}
          </p>
        )}
        <div className="mt-6 flex justify-center gap-2">
          <button
            type="button"
            onClick={() => { router.invalidate(); reset(); }}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            {t("common.tryAgain")}
          </button>
          <a href="/login" className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent">{t("common.home")}</a>
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
    const isLogin = location.pathname === "/login";
    try {
      const session = await getSessionFn();
      const user = session?.user ?? null;
      if (!user && !isLogin) {
        throw redirect({
          to: "/login",
          search: { redirect: location.href },
        });
      }
      return { user };
    } catch (e) {
      if (e && typeof e === "object" && "to" in e) throw e;
      // Session/Mongo failure should not block the login homepage.
      if (isLogin) return { user: null };
      throw redirect({ to: "/login", search: { redirect: location.href } });
    }
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
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&family=Noto+Sans+Bengali:wght@400;500;600;700&family=Outfit:wght@500;600;700&family=Sora:wght@400;500;600;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="bn">
      <head><HeadContent /></head>
      <body>
        <QueryClientProvider client={fallbackQueryClient}>
          <I18nProvider>
            <ThemeProvider>
              {children}
            </ThemeProvider>
          </I18nProvider>
        </QueryClientProvider>
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const ctx = Route.useRouteContext();
  const queryClient = ctx.queryClient ?? fallbackQueryClient;
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const isLogin = pathname === "/login";
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <QueryClientProvider client={queryClient}>
      {isLogin ? <Outlet /> : <Layout><Outlet /></Layout>}
      {mounted && <Toaster richColors position="top-right" />}
    </QueryClientProvider>
  );
}
