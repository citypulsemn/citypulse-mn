import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";

/**
 * Anonymous per-visitor identity for saved events (roadmap 3.3). A random,
 * unguessable token in an httpOnly cookie — no login. `get` reads it (safe
 * during render); `ensure` creates it if missing (Server Actions / routes only,
 * since only those may set cookies).
 */

const COOKIE = "cpid";
const ONE_YEAR = 60 * 60 * 24 * 365;

export async function getSaverToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(COOKIE)?.value ?? null;
}

export async function ensureSaverToken(): Promise<string> {
  const store = await cookies();
  const existing = store.get(COOKIE)?.value;
  if (existing) return existing;

  const token = randomUUID();
  store.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ONE_YEAR,
  });
  return token;
}

/**
 * Point this browser at an existing saver identity (roadmap 5.4 magic-link
 * restore). Server Actions / Route Handlers only — cookie writes are illegal
 * during render.
 */
export async function setSaverToken(token: string): Promise<void> {
  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ONE_YEAR,
  });
}
