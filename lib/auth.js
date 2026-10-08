import { cookies } from "next/headers";
import { parseSession, sessionCookieName } from "./session";
import { findAuthorizedUser } from "./data";
export * from "./policy";

export async function getCurrentUser() {
  const store = await cookies();
  const session = parseSession(store.get(sessionCookieName())?.value);
  // Recheck current access so deactivation and scope changes take effect immediately.
  if (!session) return null;
  return findAuthorizedUser(session.email);
}
