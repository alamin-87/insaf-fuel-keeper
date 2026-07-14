import { getDb } from "./mongo.server";
import {
  APP_MODULES,
  APP_ROLES,
  defaultMatrix,
  type AppModule,
  type AppRole,
  type PowerMatrix,
} from "./settings-store";

export type { PowerMatrix };

const DOC_ID = "power-matrix";

function sanitizeMatrix(raw: unknown): PowerMatrix {
  const base = defaultMatrix();
  if (!raw || typeof raw !== "object") return base;
  const input = raw as Record<string, Record<string, boolean>>;
  for (const role of APP_ROLES) {
    const row = input[role] ?? base[role];
    base[role] = Object.fromEntries(
      APP_MODULES.map((m) => [m.id, Boolean(row?.[m.id])]),
    ) as Record<AppModule, boolean>;
    // Administrator always has full access
    if (role === "Administrator") {
      base[role] = Object.fromEntries(APP_MODULES.map((m) => [m.id, true])) as Record<AppModule, boolean>;
    }
  }
  return base;
}

async function ensureSettingsColl() {
  const db = await getDb();
  const coll = db.collection("appSettings");
  try { await coll.createIndex({ id: 1 }, { unique: true }); } catch {}
  return coll;
}

export async function getPowerMatrix(): Promise<PowerMatrix> {
  const coll = await ensureSettingsColl();
  const doc = await coll.findOne({ id: DOC_ID });
  if (!doc?.matrix) return defaultMatrix();
  return sanitizeMatrix(doc.matrix);
}

export async function savePowerMatrixDoc(matrix: PowerMatrix): Promise<PowerMatrix> {
  const sanitized = sanitizeMatrix(matrix);
  const coll = await ensureSettingsColl();
  await coll.updateOne(
    { id: DOC_ID },
    {
      $set: {
        id: DOC_ID,
        matrix: sanitized,
        updatedAt: new Date().toISOString(),
      },
    },
    { upsert: true },
  );
  return sanitized;
}

export async function roleCanAccess(role: string | undefined, moduleId: AppModule): Promise<boolean> {
  if (!role) return false;
  if (role === "Administrator") return true;
  if (!APP_ROLES.includes(role as AppRole)) return false;
  const matrix = await getPowerMatrix();
  return Boolean(matrix[role as AppRole]?.[moduleId]);
}
