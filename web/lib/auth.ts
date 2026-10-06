import { compareSync, genSaltSync, hashSync } from "bcryptjs";
import { store } from "./store";

export function verifyAdminPassword(password: string): boolean {
  const sec = store.security.get();
  if (sec.passwordHash) return compareSync(String(password ?? ""), sec.passwordHash);
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return String(password ?? "") === "admin" && process.env.NODE_ENV !== "production";
  return String(password ?? "") === expected;
}

export function hashAdminPassword(password: string): string {
  return hashSync(String(password), genSaltSync(10));
}
