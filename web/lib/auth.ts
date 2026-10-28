import { compareSync, genSaltSync, hashSync } from "bcryptjs";
import { store } from "./store";

export async function verifyAdminPassword(password: string): Promise<boolean> {
  const sec = await store.security.get();
  if (sec.passwordHash) return compareSync(String(password ?? ""), sec.passwordHash);
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return String(password ?? "") === "admin" && process.env.NODE_ENV !== "production";
  return String(password ?? "") === expected;
}

export async function hashAdminPassword(password: string): Promise<string> {
  return hashSync(String(password), genSaltSync(10));
}
