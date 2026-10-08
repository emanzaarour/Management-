import crypto from "crypto";

const COOKIE_NAME = "maps_attendance_session";
const MAX_AGE_SECONDS = 60 * 60 * 12;

function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value) throw new Error("Missing SESSION_SECRET");
  return value;
}

function base64url(value) {
  return Buffer.from(value).toString("base64url");
}

function sign(value) {
  return crypto
    .createHmac("sha256", secret())
    .update(value)
    .digest("base64url");
}

export function makeSession(user) {
  const payload = {
    email: user.email,
    name: user.name,
    role: user.role,
    center: user.center,
    exp: Date.now() + MAX_AGE_SECONDS * 1000,
  };
  const encoded = base64url(JSON.stringify(payload));
  return `${encoded}.${sign(encoded)}`;
}

export function parseSession(token) {
  try {
    if (!token) return null;
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const [encoded, signature] = parts;
    if (!encoded || !signature) return null;
    const expected = sign(encoded);
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected)))
      return null;
    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    );
    if (
      !Number.isFinite(payload.exp) ||
      payload.exp < Date.now() ||
      typeof payload.email !== "string"
    )
      return null;
    return payload;
  } catch {
    return null;
  }
}

export function sessionCookieOptions() {
  return {
    name: COOKIE_NAME,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  };
}

export function sessionCookieName() {
  return COOKIE_NAME;
}
