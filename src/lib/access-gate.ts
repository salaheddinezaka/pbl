import * as jose from "jose";

const encoder = new TextEncoder();

export async function signAccessEmail(
  email: string,
  secret: string
): Promise<string> {
  const key = encoder.encode(secret);
  return new jose.SignJWT({})
    .setSubject(email.trim().toLowerCase())
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(key);
}

export async function verifyAccessEmail(
  token: string,
  secret: string
): Promise<string | null> {
  try {
    const key = encoder.encode(secret);
    const { payload } = await jose.jwtVerify(token, key, {
      algorithms: ["HS256"],
    });
    const sub = payload.sub;
    return typeof sub === "string" ? sub : null;
  } catch {
    return null;
  }
}

/** Netlify Identity / GoTrue JWT (nf_jwt) — HS256 with site JWT secret */
export async function verifyIdentityEmail(
  token: string,
  secret: string
): Promise<string | null> {
  try {
    const key = encoder.encode(secret);
    const { payload } = await jose.jwtVerify(token, key, {
      algorithms: ["HS256"],
    });
    const email =
      typeof payload.email === "string"
        ? payload.email
        : typeof payload.sub === "string"
          ? payload.sub
          : null;
    return email ? email.trim().toLowerCase() : null;
  } catch {
    return null;
  }
}

export function emailInAllowlist(email: string, allowed: string[]): boolean {
  const e = email.trim().toLowerCase();
  return allowed.some((a) => a.trim().toLowerCase() === e);
}

export function safeNextPath(
  next: string | null,
  siteOrigin: string
): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return null;
  try {
    const base = new URL(siteOrigin);
    const u = new URL(next, siteOrigin);
    if (u.origin !== base.origin) return null;
    const out = u.pathname + u.search;
    if (/[\r\n]/.test(out)) return null;
    return out;
  } catch {
    return null;
  }
}
