import { createServerFn } from "@tanstack/react-start";
import type { PowerMatrix } from "./settings-store";

export type { PowerMatrix };

export const getPowerMatrixFn = createServerFn({ method: "GET" }).handler(async (): Promise<PowerMatrix> => {
  const { requireUser } = await import("./session.server");
  const { getPowerMatrix } = await import("./settings.server");
  await requireUser();
  return getPowerMatrix();
});

export const savePowerMatrixFn = createServerFn({ method: "POST" })
  .inputValidator((d: { matrix: PowerMatrix }) => d)
  .handler(async ({ data }): Promise<PowerMatrix> => {
    const { requireUser } = await import("./session.server");
    const { savePowerMatrixDoc, roleCanAccess } = await import("./settings.server");
    const user = await requireUser();
    const allowed = user.role === "Administrator" || (await roleCanAccess(user.role, "settings"));
    if (!allowed) throw new Error("Not allowed to update permissions");
    return savePowerMatrixDoc(data.matrix);
  });

export const resetPowerMatrixFn = createServerFn({ method: "POST" }).handler(async (): Promise<PowerMatrix> => {
  const { requireUser } = await import("./session.server");
  const { savePowerMatrixDoc } = await import("./settings.server");
  const { defaultMatrix } = await import("./settings-store");
  const user = await requireUser();
  if (user.role !== "Administrator") throw new Error("Only Administrator can reset permissions");
  return savePowerMatrixDoc(defaultMatrix());
});
