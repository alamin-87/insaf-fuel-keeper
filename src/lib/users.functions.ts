import { createServerFn } from "@tanstack/react-start";
import type { AppRole } from "./settings-store";
import type { PublicAppUser } from "./users.types";

export type { AppUserDoc, PublicAppUser } from "./users.types";

export const listAppUsersFn = createServerFn({ method: "GET" }).handler(async (): Promise<PublicAppUser[]> => {
  const { requireUser } = await import("./session.server");
  const { listAppUsers } = await import("./users.server");
  await requireUser();
  return listAppUsers();
});

export const listLoginDirectoryFn = createServerFn({ method: "GET" }).handler(async () => {
  const { listLoginDirectory } = await import("./users.server");
  return listLoginDirectory();
});

export const upsertAppUserFn = createServerFn({ method: "POST" })
  .inputValidator((d: {
    id?: string;
    username: string;
    displayName: string;
    role: AppRole;
    password?: string;
    active?: boolean;
  }) => d)
  .handler(async ({ data }): Promise<PublicAppUser> => {
    const { requireUser } = await import("./session.server");
    const { upsertAppUser } = await import("./users.server");
    await requireUser();
    return upsertAppUser(data);
  });

export const removeAppUserFn = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    const { requireUser } = await import("./session.server");
    const { removeAppUser } = await import("./users.server");
    await requireUser();
    return removeAppUser(data.id);
  });
