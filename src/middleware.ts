import type { MiddlewareHandler } from "astro";
import manifest from "./generated/protected-pages.json";
import {
  emailInAllowlist,
  verifyAccessEmail,
  verifyIdentityEmail,
} from "./lib/access-gate";
import { normalizePath } from "./lib/cms-pages";

const ACCESS_COOKIE = "pbl_access";
const IDENTITY_COOKIE = "nf_jwt";

type ProtectedManifest = Record<string, { allowedEmails: string[] }>;

function getProtectedEntry(
  pathname: string,
  man: ProtectedManifest
): { allowedEmails: string[] } | undefined {
  const key = normalizePath(pathname);
  return man[key];
}

function skipMiddleware(pathname: string): boolean {
  if (pathname.startsWith("/_astro")) return true;
  if (pathname.startsWith("/admin")) return true;
  if (pathname.startsWith("/access")) return true;
  if (pathname.startsWith("/api/")) return true;
  if (pathname.startsWith("/uploads")) return true;
  if (pathname.startsWith("/.netlify")) return true;
  if (pathname.startsWith("/.well-known")) return true;
  if (pathname === "/favicon.ico" || pathname === "/robots.txt") return true;
  return false;
}

async function resolveVisitorEmail(
  accessToken: string | undefined,
  nfJwt: string | undefined,
  accessSecret: string | undefined,
  identitySecret: string | undefined
): Promise<string | null> {
  if (identitySecret && nfJwt) {
    const fromId = await verifyIdentityEmail(nfJwt, identitySecret);
    if (fromId) return fromId;
  }
  if (accessSecret && accessToken) {
    const fromCookie = await verifyAccessEmail(accessToken, accessSecret);
    if (fromCookie) return fromCookie;
  }
  return null;
}

function notFoundHtml(): Response {
  return new Response(
    "<!DOCTYPE html><html lang=\"en\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"><title>404 — Not Found</title></head><body><h1>404 — Page Not Found</h1></body></html>",
    {
      status: 404,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    }
  );
}

export const onRequest: MiddlewareHandler = async (context, next) => {
  const pathname = context.url.pathname;

  if (skipMiddleware(pathname)) {
    return next();
  }

  const man = manifest as ProtectedManifest;
  const entry = getProtectedEntry(pathname, man);
  if (!entry) {
    return next();
  }

  const accessSecret = import.meta.env.ACCESS_COOKIE_SECRET as
    | string
    | undefined;
  const identitySecret = import.meta.env.IDENTITY_JWT_SECRET as
    | string
    | undefined;

  const accessToken = context.cookies.get(ACCESS_COOKIE)?.value;
  const nfJwt = context.cookies.get(IDENTITY_COOKIE)?.value;

  const email = await resolveVisitorEmail(
    accessToken,
    nfJwt,
    accessSecret,
    identitySecret
  );

  if (!email) {
    const returnTo = pathname + context.url.search;
    return context.redirect(
      `/access?next=${encodeURIComponent(returnTo)}`,
      302
    );
  }

  if (!emailInAllowlist(email, entry.allowedEmails)) {
    return notFoundHtml();
  }

  return next();
};
