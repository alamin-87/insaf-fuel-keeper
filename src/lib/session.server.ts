import { useSession } from "@tanstack/react-start/server";
import type { AuthUser } from "@/types";

type SessionData = {
  user?: AuthUser;
};

function sessionPassword() {
  const secret = process.env.SESSION_SECRET;
  if (secret && secret.length >= 32) return secret;
  // Dev fallback — replace via SESSION_SECRET in production.
  return "insaf-gas-corp-dev-session-secret-32chars";
}

export function useAppSession() {
  return useSession<SessionData>({
    name: "insaf-session",
    password: sessionPassword(),
    maxAge: 60 * 60 * 24 * 7,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    },
  });
}

export async function requireUser(): Promise<AuthUser> {
  const session = await useAppSession();
  const user = session.data.user;
  if (!user) throw new Error("Unauthorized");
  return user;
}

export function getAuthCredentials() {
  return {
    username: process.env.AUTH_USER || "operator",
    password: process.env.AUTH_PASSWORD || "insaf123",
    displayName: process.env.AUTH_DISPLAY_NAME || "Operator",
  };
}
