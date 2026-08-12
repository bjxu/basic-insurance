// /admin/login — single password field compared against ADMIN_SECRET (REQ-22).
// No user table, no JWT — one env variable, one HttpOnly cookie.

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { timingSafeEqual } from "node:crypto";

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

async function login(formData: FormData) {
  "use server";
  const password = formData.get("password");
  const secret = process.env.ADMIN_SECRET;

  if (typeof password === "string" && secret && safeEqual(password, secret)) {
    const cookieStore = await cookies();
    cookieStore.set("admin_token", secret, {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      path: "/",
    });
    redirect("/admin");
  }
  redirect("/admin/login?error=1");
}

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="min-h-screen flex items-center justify-center bg-surface-variant">
      <form action={login} className="bg-surface border border-outline-variant rounded-lg shadow-sm p-8 w-full max-w-sm">
        <h1 className="text-title-large text-on-surface mb-4">Admin-Login</h1>
        <label htmlFor="password" className="block text-label-large text-on-surface-variant mb-1.5">
          Passwort
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          className="w-full h-10 px-3 rounded-md border border-outline-variant text-[15px] outline-none focus:border-primary mb-3"
        />
        {error && <p className="text-sm text-error mb-3">Falsches Passwort.</p>}
        <button type="submit" className="w-full h-10 rounded-md bg-primary text-on-primary font-semibold">
          Anmelden
        </button>
      </form>
    </main>
  );
}
