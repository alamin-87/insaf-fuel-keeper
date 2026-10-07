import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getBrandingFn, saveBrandingFn, type AppBranding } from "@/lib/settings.functions";

const STORAGE_FAVICON_KEY = "insaf-custom-favicon";
const STORAGE_LOGO_KEY = "insaf-custom-logo";

const DEFAULT_FAVICON = "/favicon.png?v=4";
const DEFAULT_LOGO = "/favicon.png?v=4";

export type BrandingContextValue = {
  favicon: string;
  logo: string;
  customFavicon: string;
  customLogo: string;
  isLoading: boolean;
  isSaving: boolean;
  setCustomFavicon: (favicon: string) => Promise<void>;
  setCustomLogo: (logo: string) => Promise<void>;
  saveBranding: (branding: { favicon?: string; logo?: string }) => Promise<void>;
};

const BrandingContext = createContext<BrandingContextValue | null>(null);

function readLocalBranding() {
  if (typeof window === "undefined") return { favicon: "", logo: "" };
  try {
    const favicon = localStorage.getItem(STORAGE_FAVICON_KEY) || "";
    const logo = localStorage.getItem(STORAGE_LOGO_KEY) || "";
    return { favicon, logo };
  } catch {
    return { favicon: "", logo: "" };
  }
}

function applyFaviconToDom(faviconUrl: string) {
  if (typeof document === "undefined") return;
  const href = faviconUrl || DEFAULT_FAVICON;
  
  // Find or create favicon link elements
  let iconLinks = document.querySelectorAll<HTMLLinkElement>("link[rel*='icon']");
  if (iconLinks.length === 0) {
    const link = document.createElement("link");
    link.rel = "icon";
    link.href = href;
    document.head.appendChild(link);
  } else {
    iconLinks.forEach((link) => {
      link.href = href;
    });
  }

  // Apple touch icon
  let appleLink = document.querySelector<HTMLLinkElement>("link[rel='apple-touch-icon']");
  if (appleLink) {
    appleLink.href = href;
  }
}

function applyOgToDom(logoUrl: string) {
  if (typeof document === "undefined") return;
  const href = logoUrl || DEFAULT_LOGO;
  
  const ogImg = document.querySelector<HTMLMetaElement>("meta[property='og:image']");
  if (ogImg) ogImg.content = href;

  const twImg = document.querySelector<HTMLMetaElement>("meta[name='twitter:image']");
  if (twImg) twImg.content = href;
}

export function BrandingProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [local, setLocal] = useState(() => readLocalBranding());

  const { data: serverBranding, isLoading } = useQuery({
    queryKey: ["branding"],
    queryFn: () => getBrandingFn(),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Apply initial cached branding immediately to avoid flashing
  useEffect(() => {
    const initial = readLocalBranding();
    if (initial.favicon) applyFaviconToDom(initial.favicon);
    if (initial.logo) applyOgToDom(initial.logo);
  }, []);

  // Sync server branding with local storage and DOM
  useEffect(() => {
    if (serverBranding) {
      const nextFavicon = serverBranding.favicon ?? "";
      const nextLogo = serverBranding.logo ?? "";
      setLocal({ favicon: nextFavicon, logo: nextLogo });
      
      try {
        localStorage.setItem(STORAGE_FAVICON_KEY, nextFavicon);
        localStorage.setItem(STORAGE_LOGO_KEY, nextLogo);
      } catch {}

      applyFaviconToDom(nextFavicon);
      applyOgToDom(nextLogo);
    }
  }, [serverBranding]);

  const saveMutation = useMutation({
    mutationFn: (data: { favicon?: string; logo?: string }) => saveBrandingFn({ data }),
    onSuccess: (saved: AppBranding) => {
      const nextFavicon = saved.favicon ?? "";
      const nextLogo = saved.logo ?? "";
      setLocal({ favicon: nextFavicon, logo: nextLogo });
      
      try {
        localStorage.setItem(STORAGE_FAVICON_KEY, nextFavicon);
        localStorage.setItem(STORAGE_LOGO_KEY, nextLogo);
      } catch {}

      applyFaviconToDom(nextFavicon);
      applyOgToDom(nextLogo);
      qc.setQueryData(["branding"], saved);
    },
  });

  const saveBranding = useCallback(
    async (branding: { favicon?: string; logo?: string }) => {
      await saveMutation.mutateAsync(branding);
    },
    [saveMutation],
  );

  const setCustomFavicon = useCallback(
    async (favicon: string) => {
      await saveMutation.mutateAsync({ favicon, logo: local.logo });
    },
    [saveMutation, local.logo],
  );

  const setCustomLogo = useCallback(
    async (logo: string) => {
      await saveMutation.mutateAsync({ favicon: local.favicon, logo });
    },
    [saveMutation, local.favicon],
  );

  const value = useMemo<BrandingContextValue>(
    () => ({
      favicon: local.favicon || DEFAULT_FAVICON,
      logo: local.logo || DEFAULT_LOGO,
      customFavicon: local.favicon,
      customLogo: local.logo,
      isLoading,
      isSaving: saveMutation.isPending,
      setCustomFavicon,
      setCustomLogo,
      saveBranding,
    }),
    [local, isLoading, saveMutation.isPending, setCustomFavicon, setCustomLogo, saveBranding],
  );

  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>;
}

export function useBranding() {
  const ctx = useContext(BrandingContext);
  if (!ctx) {
    // Fallback if rendered outside provider
    return {
      favicon: DEFAULT_FAVICON,
      logo: DEFAULT_LOGO,
      customFavicon: "",
      customLogo: "",
      isLoading: false,
      isSaving: false,
      setCustomFavicon: async () => {},
      setCustomLogo: async () => {},
      saveBranding: async () => {},
    };
  }
  return ctx;
}
