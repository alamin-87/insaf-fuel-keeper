import { getDb } from "./mongo.server";
import { seedAppUsers } from "./seed-data";
import type { AppRole } from "./settings-store";
import type { AppUserDoc, PublicAppUser } from "./users.types";

export type { AppUserDoc, PublicAppUser } from "./users.types";

const clean = <T,>(doc: any): T => {
  if (!doc) return doc;
  const { _id, ...rest } = doc;
  return rest as T;
};

async function ensureUsers() {
  const db = await getDb();
  const coll = db.collection("appUsers");
  try { await coll.createIndex({ id: 1 }, { unique: true }); } catch {}
  try { await coll.createIndex({ username: 1 }, { unique: true }); } catch {}
  const count = await coll.estimatedDocumentCount();
  if (count === 0) {
    try {
      await coll.insertMany(seedAppUsers.map((u) => ({ ...u })), { ordered: false });
    } catch {}
  }
}

function toPublic(u: AppUserDoc): PublicAppUser {
  const { password: _p, ...rest } = u;
  return { ...rest, hasPassword: Boolean(_p) };
}

export async function findUserByCredentials(username: string, password: string): Promise<AppUserDoc | null> {
  await ensureUsers();
  const db = await getDb();
  const doc = await db.collection("appUsers").findOne({
    username: username.trim().toLowerCase(),
    active: true,
  });
  if (!doc) return null;
  const user = clean<AppUserDoc>(doc);
  if (user.password !== password) return null;
  return user;
}

export async function listLoginDirectory(): Promise<Array<{
  username: string;
  displayName: string;
  role: AppRole;
}>> {
  await ensureUsers();
  const db = await getDb();
  const docs = await db.collection("appUsers").find({ active: true }).sort({ role: 1 }).toArray();
  return docs.map((d) => {
    const u = clean<AppUserDoc>(d);
    return { username: u.username, displayName: u.displayName, role: u.role };
  });
}

export async function listAppUsers(): Promise<PublicAppUser[]> {
  await ensureUsers();
  const db = await getDb();
  const docs = await db.collection("appUsers").find({}).sort({ createdAt: 1 }).toArray();
  return docs.map((d) => toPublic(clean<AppUserDoc>(d)));
}

export async function upsertAppUser(data: {
  id?: string;
  username: string;
  displayName: string;
  role: AppRole;
  password?: string;
  active?: boolean;
}): Promise<PublicAppUser> {
  await ensureUsers();
  const db = await getDb();
  const username = data.username.trim().toLowerCase();
  if (!username || !data.displayName.trim()) throw new Error("Username and display name required");

  if (data.id) {
    const existing = await db.collection("appUsers").findOne({ id: data.id });
    if (!existing) throw new Error("User not found");
    const clash = await db.collection("appUsers").findOne({ username, id: { $ne: data.id } });
    if (clash) throw new Error("Username already taken");
    const patch: Record<string, unknown> = {
      username,
      displayName: data.displayName.trim(),
      role: data.role,
      active: data.active ?? existing.active ?? true,
    };
    if (data.password && data.password.trim()) patch.password = data.password.trim();
    await db.collection("appUsers").updateOne({ id: data.id }, { $set: patch });
    const doc = await db.collection("appUsers").findOne({ id: data.id });
    return toPublic(clean<AppUserDoc>(doc));
  }

  const clash = await db.collection("appUsers").findOne({ username });
  if (clash) throw new Error("Username already taken");
  if (!data.password?.trim()) throw new Error("Password required");
  const id = Math.random().toString(36).slice(2, 10);
  const doc: AppUserDoc = {
    id,
    username,
    password: data.password.trim(),
    displayName: data.displayName.trim(),
    role: data.role,
    active: data.active ?? true,
    createdAt: new Date().toISOString(),
  };
  await db.collection("appUsers").insertOne(doc);
  return toPublic(doc);
}

export async function removeAppUser(id: string) {
  await ensureUsers();
  const db = await getDb();
  const existing = await db.collection("appUsers").findOne({ id });
  if (!existing) throw new Error("User not found");
  if (clean<AppUserDoc>(existing).username === "operator") {
    throw new Error("Cannot delete the primary operator account");
  }
  await db.collection("appUsers").deleteOne({ id });
  return { ok: true as const };
}
