import { createServerFn } from "@tanstack/react-start";
import { getAuthCredentials, useAppSession } from "./session.server";
import type { AuthUser } from "@/types";

export const getSessionFn = createServerFn({ method: "GET" }).handler(async (): Promise<{ user: AuthUser } | null> => {
  const session = await useAppSession();
  return session.data.user ? { user: session.data.user } : null;
});

export const loginFn = createServerFn({ method: "POST" })
  .inputValidator((d: { username: string; password: string }) => d)
  .handler(async ({ data }): Promise<{ ok: true; user: AuthUser } | { ok: false; error: string }> => {
    const creds = getAuthCredentials();
    if (
      data.username.trim().toLowerCase() !== creds.username.toLowerCase() ||
      data.password !== creds.password
    ) {
      return { ok: false, error: "Invalid username or password" };
    }
    const user: AuthUser = {
      username: creds.username,
      displayName: creds.displayName,
    };
    const session = await useAppSession();
    await session.update({ user });
    return { ok: true, user };
  });

export const logoutFn = createServerFn({ method: "POST" }).handler(async () => {
  const session = await useAppSession();
  await session.clear();
  return { ok: true as const };
});
