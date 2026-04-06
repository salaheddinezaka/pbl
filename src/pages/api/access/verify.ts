import type { APIRoute } from "astro";
import manifest from "../../../generated/protected-pages.json";
import {
  emailInAllowlist,
  safeNextPath,
  signAccessEmail,
} from "../../../lib/access-gate";
import { normalizePath } from "../../../lib/cms-pages";

export const prerender = false;

const ACCESS_COOKIE = "pbl_access";

type ProtectedManifest = Record<string, { allowedEmails: string[] }>;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const secret = import.meta.env.ACCESS_COOKIE_SECRET as string | undefined;
  if (!secret) {
    return new Response("Server configuration error", { status: 500 });
  }

  const ct = request.headers.get("content-type") ?? "";
  if (
    !ct.includes("application/x-www-form-urlencoded") &&
    !ct.includes("multipart/form-data")
  ) {
    return new Response(null, { status: 404 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return new Response(null, { status: 404 });
  }

  const emailRaw = form.get("email");
  const nextRaw = form.get("next");
  const email = typeof emailRaw === "string" ? emailRaw.trim() : "";
  const nextStr = typeof nextRaw === "string" ? nextRaw : null;

  if (!email || !nextStr) {
    return new Response(null, { status: 404 });
  }

  const siteOrigin = new URL(request.url).origin;
  const nextPath = safeNextPath(nextStr, siteOrigin);
  if (!nextPath) {
    return new Response(null, { status: 404 });
  }

  const pathname = new URL(nextPath, siteOrigin).pathname;
  const key = normalizePath(pathname);
  const man = manifest as ProtectedManifest;
  const entry = man[key];
  if (!entry) {
    return new Response(null, { status: 404 });
  }

  if (!emailInAllowlist(email, entry.allowedEmails)) {
    return new Response(null, { status: 404 });
  }

  const jwt = await signAccessEmail(email, secret);
  cookies.set(ACCESS_COOKIE, jwt, {
    path: "/",
    httpOnly: true,
    secure: import.meta.env.PROD,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
  });

  return redirect(nextPath, 302);
};
