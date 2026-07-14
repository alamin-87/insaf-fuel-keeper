import { useQuery } from "@tanstack/react-query";
import { useRouteContext } from "@tanstack/react-router";
import { getPowerMatrixFn } from "@/lib/settings.functions";
import { canRoleAccess, pathToModule, urlToModule, type AppModule } from "@/lib/access";

export function usePowerMatrix() {
  return useQuery({
    queryKey: ["powerMatrix"],
    queryFn: () => getPowerMatrixFn(),
    staleTime: 60_000,
  });
}

export function useModuleAccess() {
  const { user } = useRouteContext({ from: "__root__" });
  const { data: matrix, isLoading } = usePowerMatrix();
  const role = user?.role;

  const canAccess = (moduleId: AppModule) => canRoleAccess(matrix, role, moduleId);
  const canAccessPath = (pathname: string) => {
    const mod = pathToModule(pathname);
    if (!mod) return true;
    return canAccess(mod);
  };
  const canAccessUrl = (url: string) => canAccess(urlToModule(url));

  return {
    role,
    matrix,
    isLoading,
    canAccess,
    canAccessPath,
    canAccessUrl,
    isAdmin: role === "Administrator",
  };
}
